/**
 * BOOKEA MEDIA — la lógica de `/api/media/*`.
 *
 * ⚠️ Server-only: habla con R2, con Cloudflare y con `service_role`.
 *
 * ── POR QUÉ ESTO NO VIVE EN LOS ROUTE HANDLERS ───────────────────────
 *
 * Un Route Handler de Next no se puede llamar desde un test sin montar
 * medio framework, y todo lo que hay acá —el orden de las validaciones,
 * qué se compensa cuando Cloudflare falla, qué código HTTP le toca a
 * cada respuesta de PostgreSQL— es exactamente lo que hay que poder
 * probar sin red. Los tres archivos de `src/app/api/media/` son diez
 * líneas de pegamento; la lógica está acá y recibe TODO por parámetro.
 *
 * ── LAS TRES REGLAS QUE ORDENAN ESTE ARCHIVO ─────────────────────────
 *
 *  1. EL CLIENTE NO ELIGE NADA QUE IMPORTE. Ni la clave de R2, ni la
 *     visibilidad, ni el propietario, ni la entidad en el flujo
 *     anónimo, ni la posición. Todo eso se deriva en el servidor o sale
 *     de la base. Lo único que manda el cliente es qué archivo quiere
 *     subir y un identificador de idempotencia.
 *
 *  2. LO QUE NO SE PUEDE DESHACER VA ÚLTIMO. Se reserva en SQL antes de
 *     firmar; se verifica el original antes de sellarlo; se sella R2
 *     antes de tocar Cloudflare. Cada paso deja el sistema en un estado
 *     del que se puede salir.
 *
 *  3. SI ALGO QUEDA A MEDIAS, ALGUIEN TIENE QUE ENTERARSE. Una imagen
 *     creada en Cloudflare que SQL no pudo registrar se borra; si el
 *     borrado también falla, su id queda escrito en la fila
 *     (`media_anotar_incidencia`). Nunca se la deja invisible.
 */

import "server-only";

import { autenticarMedia } from "./autenticacion";
import {
  LIMITES_ANONIMOS,
  MAX_BYTES_ANONIMO,
  TTL_CAPACIDAD_S,
  USOS_ALBUM,
  clavePorCapacidad,
  clavePorEntidad,
  clavePorIp,
  generarTokenCapacidad,
  hashDeToken,
  hmacDeIp,
  ipDeLaPeticion,
} from "./capacidad";
import { claveOriginal, extensionDeMime, nombreConExtension } from "./claves";
import { leerJsonLimitado, textoDe, uuidDe } from "./cuerpo-limitado";
import { revisarAlcance } from "./alcance";
import { analizarFirmaEnR2 } from "./firma-archivo";
import { borrarImagen, importarDesdeUrl } from "./cloudflare-images";
import {
  EXPIRACION_SUBIDA_S,
  borrarObjeto,
  existeObjeto,
  firmarDescarga,
  firmarSubida,
  verificarMetadatosOriginal,
} from "./r2";
import {
  codigoDePostgres,
  error as errorHttp,
  exito,
  type CodigoError,
  type ContextoRespuesta,
} from "./respuestas";
import {
  MAX_BYTES_IMAGEN,
  MIMES_IMAGEN,
  esEntidad,
  esVisibilidad,
  type EntidadMedia,
} from "./tipos";
import { verificarTurnstile } from "./turnstile";
import { origenPermitido } from "./autenticacion";
import { createAdminClient } from "@/lib/supabase/admin";

// ------------------------------------------------------------
// 1. La superficie mínima de Supabase que hace falta
// ------------------------------------------------------------

export type ErrorRpc = { code?: string | null; message?: string | null };

/**
 * Solo `rpc`. No se pide el `SupabaseClient` entero a propósito: con
 * esta forma, un test escribe un objeto de diez líneas en vez de simular
 * un SDK, y —más importante— queda a la vista que este módulo NO lee ni
 * escribe tablas directamente. Todo pasa por funciones de la base, que
 * son las que validan.
 */
export type ClienteRpc = {
  rpc(nombre: string, args?: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: ErrorRpc | null;
  }>;
};

/** Una fila de un `returns table (...)`, que PostgREST manda como arreglo. */
function filaDe(data: unknown): Record<string, unknown> | null {
  const bruto = Array.isArray(data) ? data[0] : data;
  return typeof bruto === "object" && bruto !== null ? (bruto as Record<string, unknown>) : null;
}

function txt(fila: Record<string, unknown> | null, campo: string): string | null {
  const v = fila?.[campo];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function num(fila: Record<string, unknown> | null, campo: string): number | null {
  const v = fila?.[campo];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bool(fila: Record<string, unknown> | null, campo: string): boolean {
  return fila?.[campo] === true;
}

type Llamada = { fila: Record<string, unknown> | null; error: ErrorRpc | null };

async function llamar(
  cliente: ClienteRpc,
  nombre: string,
  args: Record<string, unknown>,
): Promise<Llamada> {
  const { data, error } = await cliente.rpc(nombre, args);
  if (error) return { fila: null, error };
  return { fila: filaDe(data), error: null };
}

// ------------------------------------------------------------
// 2. Dependencias
// ------------------------------------------------------------

/**
 * Todo lo que toca el mundo exterior, inyectable.
 *
 * En producción no se pasa nada y se usan las implementaciones reales.
 * En los tests se pasa todo y no sale una sola petición de red.
 */
export type DependenciasServicio = {
  entorno?: NodeJS.ProcessEnv;
  autenticar?: typeof autenticarMedia;
  /** El cliente con `service_role`. `null` = falta configuración → 503. */
  admin?: () => ClienteRpc | null;
  /** Busca un álbum ACTIVO por slug. Devuelve su id, o null. */
  buscarAlbumActivo?: (slug: string) => Promise<string | null>;

  verificarTurnstile?: typeof verificarTurnstile;
  nuevoToken?: () => string;

  firmarSubida?: typeof firmarSubida;
  firmarDescarga?: typeof firmarDescarga;
  existeObjeto?: typeof existeObjeto;
  borrarObjeto?: typeof borrarObjeto;
  verificarMetadatos?: typeof verificarMetadatosOriginal;
  analizarFirma?: typeof analizarFirmaEnR2;

  importarImagen?: typeof importarDesdeUrl;
  borrarImagen?: typeof borrarImagen;

  /** Adónde van los diagnósticos. Nunca al cuerpo de la respuesta. */
  registrar?: (mensaje: string) => void;
};

type Resueltas = Required<Omit<DependenciasServicio, "entorno" | "admin" | "buscarAlbumActivo">> & {
  entorno: NodeJS.ProcessEnv;
  admin: () => ClienteRpc | null;
  buscarAlbumActivo: (slug: string) => Promise<string | null>;
};

function adminPorDefecto(): ClienteRpc | null {
  const c = createAdminClient();
  return c ? (c as unknown as ClienteRpc) : null;
}

async function albumPorDefecto(slug: string): Promise<string | null> {
  const c = createAdminClient();
  if (!c) return null;
  const { data } = await c
    .from("albumes")
    .select("id")
    .eq("slug", slug)
    .eq("estado", "activo")
    .maybeSingle();
  const id = (data as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : null;
}

function resolver(deps: DependenciasServicio): Resueltas {
  return {
    entorno: deps.entorno ?? process.env,
    autenticar: deps.autenticar ?? autenticarMedia,
    admin: deps.admin ?? adminPorDefecto,
    buscarAlbumActivo: deps.buscarAlbumActivo ?? albumPorDefecto,
    verificarTurnstile: deps.verificarTurnstile ?? verificarTurnstile,
    nuevoToken: deps.nuevoToken ?? generarTokenCapacidad,
    firmarSubida: deps.firmarSubida ?? firmarSubida,
    firmarDescarga: deps.firmarDescarga ?? firmarDescarga,
    existeObjeto: deps.existeObjeto ?? existeObjeto,
    borrarObjeto: deps.borrarObjeto ?? borrarObjeto,
    verificarMetadatos: deps.verificarMetadatos ?? verificarMetadatosOriginal,
    analizarFirma: deps.analizarFirma ?? analizarFirmaEnR2,
    importarImagen: deps.importarImagen ?? importarDesdeUrl,
    borrarImagen: deps.borrarImagen ?? borrarImagen,
    registrar: deps.registrar ?? ((m) => console.error(`[media] ${m}`)),
  };
}

// ------------------------------------------------------------
// 3. Lectura y validación del cuerpo
// ------------------------------------------------------------

type Cuerpo = Record<string, unknown>;

type LecturaCuerpo = { ok: true; cuerpo: Cuerpo } | { ok: false; codigo: CodigoError };

async function leerCuerpo(request: Request): Promise<LecturaCuerpo> {
  const r = await leerJsonLimitado(request);
  if (r.ok) return { ok: true, cuerpo: r.valor };
  return {
    ok: false,
    codigo: r.error.codigo === "muy-grande" ? "cuerpo-muy-grande" : "cuerpo-invalido",
  };
}

/**
 * Los campos que describen el archivo, iguales en los dos endpoints de
 * sesión.
 *
 * `bytes` se valida en tres pasos y no en uno: "no es un entero" es un
 * 400 y "pesa de más" es un **413**, y meterlos en el mismo `if` le
 * daría a quien sube una foto de 12 MB un "datos inválidos" que no
 * explica nada.
 */
type Archivo = { mime: string; bytes: number; nombre: string; solicitudId: string };

function leerArchivo(
  cuerpo: Cuerpo,
  topeBytes: number,
): { ok: true; archivo: Archivo } | { ok: false; codigo: CodigoError } {
  const solicitudId = uuidDe(cuerpo.solicitud_id);
  if (!solicitudId) return { ok: false, codigo: "campos-invalidos" };

  const mime = textoDe(cuerpo.mime, 100);
  if (!mime) return { ok: false, codigo: "campos-invalidos" };

  const nombre = textoDe(cuerpo.nombre, 300);
  if (!nombre) return { ok: false, codigo: "campos-invalidos" };

  const bytes = cuerpo.bytes;
  if (typeof bytes !== "number" || !Number.isInteger(bytes) || bytes <= 0) {
    return { ok: false, codigo: "campos-invalidos" };
  }
  if (bytes > topeBytes) return { ok: false, codigo: "archivo-muy-grande" };

  return {
    ok: true,
    archivo: { mime: mime.toLowerCase().split(";")[0].trim(), bytes, nombre, solicitudId },
  };
}

// ------------------------------------------------------------
// 4. De la reserva a la URL firmada
//
// El tramo que comparten los dos endpoints de sesión: con el asset ya
// reservado, derivar la clave, comprobar que el objeto no está, fijar la
// clave en SQL y firmar el PUT.
// ------------------------------------------------------------

type DatosClave = {
  propietarioId: string;
  entidad: EntidadMedia;
  entidadId: string;
  estado: string;
  mime: string;
};

async function leerDatosParaClave(
  admin: ClienteRpc,
  assetId: string,
): Promise<{ ok: true; datos: DatosClave } | { ok: false; codigo: CodigoError; registro: string }> {
  const { fila, error } = await llamar(admin, "media_datos_para_clave", { p_asset_id: assetId });
  if (error) {
    return { ok: false, codigo: codigoDePostgres(error.code), registro: `datos_para_clave: ${error.code}` };
  }
  const entidad = txt(fila, "entity_type");
  const entidadId = txt(fila, "entity_id");
  const mime = txt(fila, "mime");
  if (!fila || !entidad || !entidadId || !esEntidad(entidad) || !mime) {
    return { ok: false, codigo: "no-existe", registro: "datos_para_clave: sin fila" };
  }
  return {
    ok: true,
    datos: {
      // Un álbum sin cliente asignado no tiene dueño (`albumes.cliente_id`
      // es anulable). "compartido" es el prefijo que usa `claves.ts` para
      // lo que no cuelga de una cuenta — no un usuario inventado.
      propietarioId: txt(fila, "propietario_id") ?? "compartido",
      entidad,
      entidadId,
      estado: txt(fila, "estado") ?? "pendiente",
      mime,
    },
  };
}

type Firmada = {
  clave: string;
  url: string;
  cabeceras: Record<string, string>;
  expiraEnSegundos: number;
};

/**
 * Comprueba que el objeto no exista, fija la clave en SQL y firma.
 *
 * ── POR QUÉ SE MIRA R2 ANTES DE FIRMAR ───────────────────────────────
 *
 * La URL se firma con `If-None-Match: *`, así que un PUT contra una
 * clave ocupada devuelve 412. Si no se comprobara acá, quien repite una
 * solicitud ya usada recibiría una URL perfectamente válida que después
 * falla en el navegador con un error que no significa nada para nadie.
 * Es mejor un 409 con un mensaje claro.
 *
 * La excepción es el asset en `error`: ahí el objeto anterior puede
 * seguir en R2 y hay que borrarlo Y VOLVER A COMPROBAR antes de decirle
 * a la base que se puede reintentar. `p_objeto_previo_ausente` es
 * justamente eso: un dato que PostgreSQL no puede averiguar solo.
 */
async function prepararYFirmar(
  d: Resueltas,
  admin: ClienteRpc,
  params: {
    assetId: string;
    archivo: Archivo;
    datos: DatosClave;
    /** Cuál de los dos juegos de funciones: por actor o por capacidad. */
    autorizacion: { tipo: "actor"; actorId: string } | { tipo: "capacidad"; tokenHash: string };
  },
): Promise<{ ok: true; firmada: Firmada } | { ok: false; codigo: CodigoError; registro?: string }> {
  const clave = claveOriginal({
    propietarioId: params.datos.propietarioId,
    entidad: params.datos.entidad,
    entidadId: params.datos.entidadId,
    assetId: params.assetId,
    // El MIME manda sobre la extensión que haya mandado el navegador.
    nombre: nombreConExtension(params.archivo.nombre, params.archivo.mime),
  });

  const rEnR2 = { entorno: d.entorno };

  const existe = await d.existeObjeto({ clave }, rEnR2);
  if (!existe.ok) {
    if (existe.error.codigo === "config-incompleta") {
      return { ok: false, codigo: "sin-configuracion", registro: existe.error.mensaje };
    }
    return { ok: false, codigo: "fallo-almacenamiento", registro: existe.error.mensaje };
  }

  let ausente = !existe.valor;
  if (existe.valor) {
    // Un objeto presente sobre un asset que NO está en `error` es una
    // subida ya consumida: la URL no se vuelve a firmar.
    if (params.datos.estado !== "error") {
      return { ok: false, codigo: "objeto-existente" };
    }
    // Reintento de un rechazo: se borra el objeto malo y se COMPRUEBA
    // que se fue. Un borrado que "no falló" no es lo mismo que un objeto
    // ausente.
    await d.borrarObjeto({ clave }, rEnR2);
    const otraVez = await d.existeObjeto({ clave }, rEnR2);
    if (!otraVez.ok || otraVez.valor) {
      return { ok: false, codigo: "objeto-existente", registro: "no se pudo borrar el objeto previo" };
    }
    ausente = true;
  }

  const { fila, error } =
    params.autorizacion.tipo === "actor"
      ? await llamar(admin, "media_preparar_subida", {
          p_actor: params.autorizacion.actorId,
          p_asset_id: params.assetId,
          p_r2_key: clave,
          p_objeto_previo_ausente: ausente,
        })
      : await llamar(admin, "media_preparar_subida_cap", {
          p_token_hash: params.autorizacion.tokenHash,
          p_asset_id: params.assetId,
          p_r2_key: clave,
          p_objeto_previo_ausente: ausente,
        });

  if (error) {
    return { ok: false, codigo: codigoDePostgres(error.code), registro: `preparar: ${error.code}` };
  }

  const codigo = txt(fila, "codigo");
  switch (codigo) {
    case "asignada":
    case "reutilizada":
    case "reintentada":
      break;
    case "limpieza_en_curso":
      return { ok: false, codigo: "en-curso" };
    case "objeto_previo_presente":
      return { ok: false, codigo: "objeto-existente" };
    case "capacidad_invalida":
      return { ok: false, codigo: "sin-capacidad" };
    case "capacidad_vencida":
      return { ok: false, codigo: "capacidad-vencida" };
    case "no_cubre":
      return { ok: false, codigo: "sin-permiso" };
    default:
      return { ok: false, codigo: "fallo-interno", registro: `preparar: ${codigo}` };
  }

  const firma = await d.firmarSubida(
    {
      clave,
      mime: params.archivo.mime,
      bytes: params.archivo.bytes,
      expiraEnSegundos: EXPIRACION_SUBIDA_S,
    },
    rEnR2,
  );
  if (!firma.ok) {
    if (firma.error.codigo === "config-incompleta") {
      return { ok: false, codigo: "sin-configuracion", registro: firma.error.mensaje };
    }
    return { ok: false, codigo: "fallo-almacenamiento", registro: firma.error.mensaje };
  }

  return {
    ok: true,
    firmada: {
      clave,
      url: firma.valor.url,
      // `firmarSubida` ya devuelve SOLO las que el navegador puede
      // poner: Content-Type e If-None-Match. `Content-Length` es una
      // *forbidden header name* — `fetch` la ignora y la manda sola con
      // el tamaño real del Blob, que es el que se firmó. Pedirla acá
      // sería pedir algo imposible.
      cabeceras: firma.valor.cabeceras,
      expiraEnSegundos: firma.valor.expiraEnSegundos,
    },
  };
}

/** El cuerpo de una sesión, igual en los dos endpoints. */
function cuerpoDeSesion(params: {
  assetId: string;
  solicitudId: string;
  posicion: number | null;
  reservaExpiraEn: string | null;
  firmada: Firmada;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    asset_id: params.assetId,
    solicitud_id: params.solicitudId,
    posicion: params.posicion,
    reserva_expira_en: params.reservaExpiraEn,
    subida: {
      metodo: "PUT",
      url: params.firmada.url,
      cabeceras: params.firmada.cabeceras,
      expira_en_segundos: params.firmada.expiraEnSegundos,
    },
    // Qué hace falta para cerrar la subida. Se manda explícito para que
    // el cliente no tenga que deducirlo: la clave de R2 NO viaja nunca.
    confirmar: { ruta: "/api/media/confirmar", metodo: "POST", asset_id: params.assetId },
    ...(params.extra ?? {}),
  };
}

// ------------------------------------------------------------
// 5. `/api/media/sesion` — con sesión
// ------------------------------------------------------------

export async function manejarSesion(
  request: Request,
  deps: DependenciasServicio = {},
): Promise<Response> {
  const d = resolver(deps);
  const origen = request.headers.get("origin");
  const ctx: ContextoRespuesta = { origen, entorno: d.entorno };
  const falla = (c: CodigoError, registro?: string) => {
    if (registro) d.registrar(`sesion: ${registro}`);
    return errorHttp(c, ctx);
  };

  const lectura = await leerCuerpo(request);
  if (!lectura.ok) return falla(lectura.codigo);
  const cuerpo = lectura.cuerpo;

  const archivo = leerArchivo(cuerpo, MAX_BYTES_IMAGEN);
  if (!archivo.ok) return falla(archivo.codigo);

  const entityId = uuidDe(cuerpo.entity_id);
  if (!entityId) return falla("campos-invalidos");

  // `reemplaza_asset_id` es opcional, pero si viene tiene que ser un
  // uuid: un valor basura no se manda a la base para que lo rechace.
  const reemplaza =
    cuerpo.reemplaza_asset_id === undefined || cuerpo.reemplaza_asset_id === null
      ? null
      : uuidDe(cuerpo.reemplaza_asset_id);
  if (cuerpo.reemplaza_asset_id !== undefined && cuerpo.reemplaza_asset_id !== null && !reemplaza) {
    return falla("campos-invalidos");
  }

  const alcance = revisarAlcance(cuerpo.entity_type, archivo.archivo.mime);
  if (!alcance.ok) {
    return falla(alcance.http === 422 ? "fuera-de-alcance" : "mime-desconocido");
  }

  const auth = await d.autenticar(request, { entorno: d.entorno });
  if (!auth.ok) {
    if (auth.http === 503) return falla("sin-configuracion", auth.motivo);
    if (auth.http === 403) return falla("origen-invalido");
    return falla("sin-sesion");
  }

  const admin = d.admin();
  if (!admin) return falla("sin-configuracion", "sin service_role");

  // La reserva va CON EL CLIENTE DEL USUARIO, no con service_role:
  // `media_reservar` lee `auth.uid()` adentro, y con service_role sería
  // null. Es la única llamada de este archivo que no usa el admin.
  const usuario = auth.actor.supabase as unknown as ClienteRpc;
  const { fila, error } = await llamar(usuario, "media_reservar", {
    p_solicitud_id: archivo.archivo.solicitudId,
    p_entity_type: alcance.entidad,
    p_entity_id: entityId,
    p_mime: archivo.archivo.mime,
    p_bytes: archivo.archivo.bytes,
    p_nombre_original: archivo.archivo.nombre,
    p_reemplaza_asset_id: reemplaza,
  });
  if (error) return falla(codigoDePostgres(error.code), `reservar: ${error.code}`);

  const codigo = txt(fila, "codigo");
  if (codigo === "cupo_agotado") return falla("cupo-agotado");
  if (codigo === "demasiadas_reservas") return falla("demasiadas-reservas");
  if (codigo === "reemplazo_en_curso") return falla("en-curso");
  if (codigo === "conflicto_solicitud") return falla("conflicto-solicitud");
  if (codigo !== "creada" && codigo !== "reutilizada") {
    return falla("fallo-interno", `reservar: ${codigo}`);
  }

  const assetId = txt(fila, "asset_id");
  if (!assetId) return falla("fallo-interno", "reservar sin asset_id");

  const datos = await leerDatosParaClave(admin, assetId);
  if (!datos.ok) return falla(datos.codigo, datos.registro);

  const firmada = await prepararYFirmar(d, admin, {
    assetId,
    archivo: archivo.archivo,
    datos: datos.datos,
    autorizacion: { tipo: "actor", actorId: auth.actor.usuarioId },
  });
  if (!firmada.ok) return falla(firmada.codigo, firmada.registro);

  return exito(
    cuerpoDeSesion({
      assetId,
      solicitudId: archivo.archivo.solicitudId,
      posicion: num(fila, "posicion"),
      reservaExpiraEn: txt(fila, "reserva_expira_en"),
      firmada: firmada.firmada,
    }),
    ctx,
    codigo === "creada" ? 201 : 200,
  );
}

// ------------------------------------------------------------
// 6. `/api/media/sesion-anonima` — sin cuenta
//
// Dos esquemas CERRADOS. No hay un `entity_type` libre: `tipo` elige
// entre dos caminos y cada uno sabe de qué entidad habla.
//
// ── CUÁNDO SE EXIGE TURNSTILE ────────────────────────────────────────
//
//   álbum sin capacidad  → SÍ. Es el momento en que se EMITE el permiso.
//   álbum con capacidad  → no. El permiso ya se ganó y trae sus 10 usos
//                          contados; pedir un desafío por cada una de
//                          las 10 fotos serían 10 desafíos para subir
//                          una tanda, y los tokens de Turnstile son de
//                          un solo uso.
//   comprobante          → SIEMPRE. Es un uso único y el caso más
//                          sensible: un desafío por archivo.
// ------------------------------------------------------------

const ENTIDAD_DE_TIPO = { album: "album", comprobante: "comprobante" } as const;

type TipoAnonimo = keyof typeof ENTIDAD_DE_TIPO;

function esTipoAnonimo(v: unknown): v is TipoAnonimo {
  return v === "album" || v === "comprobante";
}

export async function manejarSesionAnonima(
  request: Request,
  deps: DependenciasServicio = {},
): Promise<Response> {
  const d = resolver(deps);
  const origen = request.headers.get("origin");
  const ctx: ContextoRespuesta = { origen, entorno: d.entorno };
  const falla = (c: CodigoError, registro?: string) => {
    if (registro) d.registrar(`sesion-anonima: ${registro}`);
    return errorHttp(c, ctx);
  };

  // Sin cuenta no hay bearer posible: la ÚNICA defensa contra que otra
  // página dispare esto es el Origin, y acá es obligatorio siempre.
  if (!origenPermitido(origen, d.entorno)) return falla("origen-invalido");

  const lectura = await leerCuerpo(request);
  if (!lectura.ok) return falla(lectura.codigo);
  const cuerpo = lectura.cuerpo;

  if (!esTipoAnonimo(cuerpo.tipo)) return falla("campos-invalidos");
  const tipo = cuerpo.tipo;

  const archivo = leerArchivo(cuerpo, MAX_BYTES_ANONIMO);
  if (!archivo.ok) return falla(archivo.codigo);

  // Álbumes y comprobantes son FOTOS. Video y audio no entran por acá,
  // y la base lo vuelve a comprobar en `media_reservar_con_capacidad`.
  if (!(MIMES_IMAGEN as readonly string[]).includes(archivo.archivo.mime)) {
    return falla("mime-desconocido");
  }

  const admin = d.admin();
  if (!admin) return falla("sin-configuracion", "sin service_role");

  const ip = ipDeLaPeticion(request);
  const ipHmac = hmacDeIp(ip, d.entorno);

  const limite = async (clave: string, l: number, ventana: number): Promise<boolean> => {
    const { fila, error } = await llamar(admin, "media_rate_limit_tomar", {
      p_clave: clave,
      p_limite: l,
      p_ventana_segundos: ventana,
    });
    // Un fallo del contador no puede abrir la puerta: se cierra.
    if (error) {
      d.registrar(`rate-limit: ${error.code}`);
      return false;
    }
    return bool(fila, "permitido");
  };

  // ---------- La capacidad ----------
  const tokenRecibido = textoDe(cuerpo.capacidad, 200);
  let token: string;
  let emitida = false;

  if (tipo === "comprobante") {
    // NUNCA se emite acá. La capacidad de un comprobante nace en el
    // flujo que crea la reserva —que es el único que sabe que esa
    // reserva es de quien la está pagando— y viaja desde ahí. Un
    // endpoint que emitiera contra un `reserva_id` suelto sería
    // exactamente el "endpoint genérico para cualquier comprobante" que
    // no se quiere: con un uuid ajeno, cualquiera adjuntaría archivos a
    // la reserva de otro.
    if (!tokenRecibido) return falla("sin-capacidad");
    token = tokenRecibido;

    const turn = await d.verificarTurnstile(
      { token: textoDe(cuerpo.turnstile, 4096), remoteip: ip },
      { entorno: d.entorno },
    );
    if (!turn.ok) {
      return falla(turn.codigo === "sin-configuracion" ? "sin-configuracion" : "antiabuso", turn.codigo);
    }
  } else if (tokenRecibido) {
    token = tokenRecibido;
  } else {
    // ---------- Emisión para un álbum ----------
    const turn = await d.verificarTurnstile(
      { token: textoDe(cuerpo.turnstile, 4096), remoteip: ip },
      { entorno: d.entorno },
    );
    if (!turn.ok) {
      return falla(turn.codigo === "sin-configuracion" ? "sin-configuracion" : "antiabuso", turn.codigo);
    }

    const slug = textoDe(cuerpo.album_slug, 200);
    if (!slug) return falla("campos-invalidos");

    const albumId = await d.buscarAlbumActivo(slug);
    if (!albumId) return falla("no-existe");

    // Dos contadores distintos: uno protege del que insiste desde una
    // IP, el otro protege UN álbum concreto de un ataque distribuido.
    // Sin sal no hay HMAC, y entonces no se cuenta por IP en vez de
    // contar por la IP en claro.
    if (ipHmac) {
      const ok = await limite(
        clavePorIp(ipHmac, "emision"),
        LIMITES_ANONIMOS.emisionPorIp.limite,
        LIMITES_ANONIMOS.emisionPorIp.ventanaSegundos,
      );
      if (!ok) return falla("demasiadas-peticiones");
    }
    const okEntidad = await limite(
      clavePorEntidad("album", albumId),
      LIMITES_ANONIMOS.emisionPorEntidad.limite,
      LIMITES_ANONIMOS.emisionPorEntidad.ventanaSegundos,
    );
    if (!okEntidad) return falla("demasiadas-peticiones");

    token = d.nuevoToken();
    const { fila, error } = await llamar(admin, "media_emitir_capacidad", {
      p_token_hash: hashDeToken(token),
      p_proposito: "album_subida",
      p_entity_id: albumId,
      p_usos: USOS_ALBUM,
      p_ttl_segundos: TTL_CAPACIDAD_S,
      p_max_bytes: MAX_BYTES_ANONIMO,
      p_ip_hmac: ipHmac,
    });
    if (error) return falla(codigoDePostgres(error.code), `emitir: ${error.code}`);
    if (txt(fila, "codigo") !== "emitida") return falla("no-existe");
    emitida = true;
  }

  const tokenHash = hashDeToken(token);

  const okCap = await limite(
    clavePorCapacidad(tokenHash),
    LIMITES_ANONIMOS.reservaPorCapacidad.limite,
    LIMITES_ANONIMOS.reservaPorCapacidad.ventanaSegundos,
  );
  if (!okCap) return falla("demasiadas-peticiones");

  // ---------- Reservar ----------
  // `entity_type`, `entity_id` y visibilidad NO son parámetros: salen de
  // la capacidad, dentro de la transacción que consume el uso.
  const { fila, error } = await llamar(admin, "media_reservar_con_capacidad", {
    p_token_hash: tokenHash,
    p_solicitud_id: archivo.archivo.solicitudId,
    p_mime: archivo.archivo.mime,
    p_bytes: archivo.archivo.bytes,
    p_nombre_original: archivo.archivo.nombre,
  });
  if (error) return falla(codigoDePostgres(error.code), `reservar-cap: ${error.code}`);

  const codigo = txt(fila, "codigo");
  if (codigo === "capacidad_invalida") return falla("sin-capacidad");
  if (codigo === "capacidad_vencida") return falla("capacidad-vencida");
  // Agotada = se usaron los 10 de la tanda. Es un tope de ritmo, no un
  // cupo del álbum: por eso 429 y no 409.
  if (codigo === "capacidad_agotada") return falla("demasiadas-peticiones");
  if (codigo === "cupo_agotado") return falla("cupo-agotado");
  if (codigo !== "creada" && codigo !== "reutilizada") {
    return falla("fallo-interno", `reservar-cap: ${codigo}`);
  }

  const assetId = txt(fila, "asset_id");
  if (!assetId) return falla("fallo-interno", "reservar-cap sin asset_id");

  const datos = await leerDatosParaClave(admin, assetId);
  if (!datos.ok) return falla(datos.codigo, datos.registro);

  // La capacidad decide la entidad, así que `tipo` tiene que coincidir
  // con lo que la base terminó creando. Si no coincide, el cliente mandó
  // una capacidad de álbum diciendo "comprobante" (o al revés): no hay
  // escalada —la entidad la puso la capacidad, no él— pero la respuesta
  // hablaría de algo que no es y conviene cortarlo acá.
  if (datos.datos.entidad !== ENTIDAD_DE_TIPO[tipo]) {
    return falla("sin-permiso", `tipo=${tipo} entidad=${datos.datos.entidad}`);
  }

  const firmada = await prepararYFirmar(d, admin, {
    assetId,
    archivo: archivo.archivo,
    datos: datos.datos,
    autorizacion: { tipo: "capacidad", tokenHash },
  });
  if (!firmada.ok) return falla(firmada.codigo, firmada.registro);

  return exito(
    cuerpoDeSesion({
      assetId,
      solicitudId: archivo.archivo.solicitudId,
      posicion: num(fila, "posicion"),
      reservaExpiraEn: txt(fila, "reserva_expira_en"),
      firmada: firmada.firmada,
      extra: {
        // El token EN CLARO vive dos lugares: acá y en la memoria del
        // navegador. En la base solo está su SHA-256, y en los logs no
        // está en ningún lado.
        capacidad: token,
        capacidad_emitida: emitida,
        usos_restantes: num(fila, "usos_restantes"),
      },
    }),
    ctx,
    codigo === "creada" ? 201 : 200,
  );
}

// ------------------------------------------------------------
// 7. `/api/media/confirmar`
// ------------------------------------------------------------

/** Con qué se autoriza la confirmación, y qué funciones toca cada una. */
type Autorizacion =
  | { tipo: "actor"; actorId: string }
  | { tipo: "capacidad"; tokenHash: string };

/** Los nombres de las funciones según quién autoriza. */
function funciones(a: Autorizacion) {
  const cap = a.tipo === "capacidad";
  return {
    tomar: cap ? "media_tomar_confirmacion_cap" : "media_tomar_confirmacion",
    registrarR2: cap ? "media_registrar_r2_cap" : "media_registrar_r2",
    finalizarR2: cap ? "media_finalizar_r2_cap" : "media_finalizar_r2",
    finalizarCf: cap ? "media_finalizar_cloudflare_cap" : "media_finalizar_cloudflare",
    liberar: cap ? "media_liberar_confirmacion_cap" : "media_liberar_confirmacion",
    soltar: cap ? "media_soltar_lease_cap" : "media_soltar_lease",
    rechazar: cap ? "media_rechazar_confirmacion_cap" : "media_rechazar_confirmacion",
  };
}

/** El primer argumento cambia de nombre según el juego de funciones. */
function argsDe(a: Autorizacion, resto: Record<string, unknown>): Record<string, unknown> {
  return a.tipo === "capacidad"
    ? { p_token_hash: a.tokenHash, ...resto }
    : { p_actor: a.actorId, ...resto };
}

export async function manejarConfirmar(
  request: Request,
  deps: DependenciasServicio = {},
): Promise<Response> {
  const d = resolver(deps);
  const origen = request.headers.get("origin");
  const ctx: ContextoRespuesta = { origen, entorno: d.entorno };
  const falla = (c: CodigoError, registro?: string) => {
    if (registro) d.registrar(`confirmar: ${registro}`);
    return errorHttp(c, ctx);
  };

  const lectura = await leerCuerpo(request);
  if (!lectura.ok) return falla(lectura.codigo);
  const cuerpo = lectura.cuerpo;

  const assetId = uuidDe(cuerpo.asset_id);
  if (!assetId) return falla("campos-invalidos");

  // ---------- Quién autoriza ----------
  const tokenRecibido = textoDe(cuerpo.capacidad, 200);
  let autorizacion: Autorizacion;

  if (tokenRecibido) {
    // Sin cuenta: el Origin es la única defensa contra el disparo
    // cross-site, igual que en la sesión anónima.
    if (!origenPermitido(origen, d.entorno)) return falla("origen-invalido");
    autorizacion = { tipo: "capacidad", tokenHash: hashDeToken(tokenRecibido) };
  } else {
    const auth = await d.autenticar(request, { entorno: d.entorno });
    if (!auth.ok) {
      if (auth.http === 503) return falla("sin-configuracion", auth.motivo);
      if (auth.http === 403) return falla("origen-invalido");
      return falla("sin-sesion");
    }
    autorizacion = { tipo: "actor", actorId: auth.actor.usuarioId };
  }

  const admin = d.admin();
  if (!admin) return falla("sin-configuracion", "sin service_role");

  const fn = funciones(autorizacion);
  const rEnR2 = { entorno: d.entorno };

  // ---------- 1. Tomar el lease ----------
  const tomado = await llamar(admin, fn.tomar, argsDe(autorizacion, { p_asset_id: assetId }));
  if (tomado.error) {
    return falla(codigoDePostgres(tomado.error.code), `tomar: ${tomado.error.code}`);
  }

  const cTomar = txt(tomado.fila, "codigo");
  switch (cTomar) {
    case "tomado":
      break;
    // Idempotente: confirmar dos veces algo terminado devuelve 200, no
    // un error, y NO vuelve a importar nada a Cloudflare.
    case "ya_listo":
      return exito({ asset_id: assetId, estado: "listo", ya_estaba: true }, ctx, 200);
    case "capacidad_invalida":
      return falla("sin-capacidad");
    case "capacidad_vencida":
      return falla("capacidad-vencida");
    case "no_cubre":
      return falla("sin-permiso");
    case "reserva_vencida":
      return falla("reserva-vencida");
    case "en_curso":
    case "limpieza_en_curso":
      return falla("en-curso");
    case "no_confirmable":
    case "estado_no_confirmable":
      return falla("estado-no-confirmable", `estado=${txt(tomado.fila, "estado")}`);
    default:
      return falla("fallo-interno", `tomar: ${cTomar}`);
  }

  const lease = txt(tomado.fila, "lease");
  const clave = txt(tomado.fila, "r2_key");
  const mime = txt(tomado.fila, "mime");
  const bytes = num(tomado.fila, "bytes");
  const entidad = txt(tomado.fila, "entity_type");
  const estado = txt(tomado.fila, "estado");
  const selloR2 = txt(tomado.fila, "r2_verificado_en");
  // La visibilidad sale de la FILA, no de una tabla de constantes: si
  // alguien la cambió, la entrega tiene que seguir el valor real. Con
  // una constante, un álbum reclasificado se serviría con el criterio
  // viejo — y ahí la diferencia es una URL abierta donde tenía que
  // haber una firmada.
  const visibilidad = txt(tomado.fila, "visibilidad");

  if (
    !lease ||
    !clave ||
    !mime ||
    bytes === null ||
    !entidad ||
    !esEntidad(entidad) ||
    !esVisibilidad(visibilidad)
  ) {
    return falla("fallo-interno", "tomar: fila incompleta");
  }

  // ---------- Ayudas de cierre ----------
  const soltar = async () => {
    const r = await llamar(admin, fn.soltar, argsDe(autorizacion, { p_asset_id: assetId, p_lease: lease }));
    if (r.error) d.registrar(`soltar: ${r.error.code}`);
  };

  const rechazar = async (codigoRechazo: string, detalle: string) => {
    const r = await llamar(
      admin,
      fn.rechazar,
      argsDe(autorizacion, {
        p_asset_id: assetId,
        p_lease: lease,
        p_codigo: codigoRechazo,
        p_detalle: detalle,
      }),
    );
    if (r.error) d.registrar(`rechazar: ${r.error.code}`);
  };

  /**
   * Compensación de un archivo que no pasó las comprobaciones.
   *
   * Se INTENTA borrar el objeto de R2 y se anota si se pudo o no. La
   * fila conserva `r2_key` en los dos casos —`media_rechazar_confirmacion`
   * no la borra nunca— porque es lo único que le permite al worker
   * volver a intentar el borrado. Decir "borrado" sin haberlo
   * comprobado sería perder el rastro del archivo.
   */
  const compensarYRechazar = async (codigoRechazo: string, detalle: string) => {
    const borrado = await d.borrarObjeto({ clave }, rEnR2);
    await rechazar(codigoRechazo, `${detalle} · r2=${borrado.ok ? "borrado" : "sin-borrar"}`);
  };

  /**
   * Suelta el lease de la forma que corresponda al estado.
   *
   * Con el sello de R2 puesto va `liberar` (que lo CONSERVA); sin sello,
   * `soltar`. Son dos funciones distintas en la base a propósito:
   * ninguna puede hacer el trabajo de la otra sin romper una invariante
   * —`liberar` exige el sello, `soltar` exige que no lo haya—.
   */
  const liberar = async () => {
    const r = await llamar(
      admin,
      fn.liberar,
      argsDe(autorizacion, { p_asset_id: assetId, p_lease: lease }),
    );
    if (r.error) d.registrar(`liberar: ${r.error.code}`);
  };

  // ---------- 2. Verificar el original ----------
  //
  // Con el sello de R2 ya puesto (`parcial_r2`) esto se SALTA: el
  // original está verificado y no cambió —la clave es de escritura
  // única—, así que un reintento va directo a la parte que falló. Es lo
  // que hace que un fallo de Cloudflare no obligue a resubir 5 MB.
  const yaVerificado = estado === "parcial_r2" && Boolean(selloR2);

  if (!yaVerificado) {
    const meta = await d.verificarMetadatos(
      { clave, bytesEsperados: bytes, mimeEsperado: mime },
      rEnR2,
    );
    if (!meta.ok) {
      switch (meta.error.codigo) {
        case "no-existe":
          // El PUT no llegó (o todavía viene en camino). No hay nada que
          // deshacer: se devuelve el lease en el acto para que el
          // reintento no tenga que esperar los 10 minutos.
          await soltar();
          return falla("subida-incompleta");
        case "tamano-distinto":
        case "mime-distinto":
          await compensarYRechazar("metadatos", meta.error.mensaje);
          return falla("metadatos-distintos", meta.error.mensaje);
        case "config-incompleta":
          await soltar();
          return falla("sin-configuracion", meta.error.mensaje);
        default:
          await soltar();
          return falla("fallo-almacenamiento", meta.error.mensaje);
      }
    }

    // ---------- 3. La firma REAL del archivo ----------
    const firma = await d.analizarFirma({ clave, mimeDeclarado: mime }, rEnR2);
    if (!firma.ok) {
      await soltar();
      return falla(
        firma.error.codigo === "config-incompleta" ? "sin-configuracion" : "fallo-almacenamiento",
        firma.error.mensaje,
      );
    }
    // `bloqueaSello` es un literal atado al veredicto por el tipo: acá
    // no se puede colar un "incompatible que no bloquea".
    if (firma.valor.bloqueaSello) {
      await compensarYRechazar("firma", `${firma.valor.veredicto}: ${firma.valor.motivo}`);
      return falla("firma-incompatible", firma.valor.motivo);
    }
  }

  const soloR2 = bool(tomado.fila, "solo_r2");

  // ---------- 4a. R2-only: termina acá ----------
  if (soloR2) {
    const r = await llamar(
      admin,
      fn.finalizarR2,
      argsDe(autorizacion, { p_asset_id: assetId, p_lease: lease }),
    );
    if (r.error) return falla(codigoDePostgres(r.error.code), `finalizar-r2: ${r.error.code}`);
    const c = txt(r.fila, "codigo");
    if (c === "finalizada" || c === "reutilizada") {
      return exito({ asset_id: assetId, estado: "listo", destino: "r2" }, ctx, 200);
    }
    if (c === "lease_invalido") return falla("en-curso", "finalizar-r2: lease vencido");
    return falla("fallo-interno", `finalizar-r2: ${c}`);
  }

  // ---------- 4b. Sellar R2 antes de tocar Cloudflare ----------
  if (!yaVerificado) {
    const r = await llamar(
      admin,
      fn.registrarR2,
      argsDe(autorizacion, { p_asset_id: assetId, p_lease: lease }),
    );
    if (r.error) return falla(codigoDePostgres(r.error.code), `registrar-r2: ${r.error.code}`);
    const c = txt(r.fila, "codigo");
    if (c !== "registrada" && c !== "reutilizada") {
      if (c === "lease_invalido") return falla("en-curso", "registrar-r2: lease vencido");
      return falla("fallo-interno", `registrar-r2: ${c}`);
    }
  }

  // ---------- 5. Cloudflare importa desde R2 ----------
  //
  // El navegador subió UNA sola vez. Acá se le da a Cloudflare una URL
  // firmada de vida corta para que se baje EXACTAMENTE el objeto que se
  // acaba de verificar. Esa URL no vuelve al navegador nunca.
  //
  // El nombre del archivo NO se usa: `nombre_original` puede traer datos
  // personales ("cedula-juan-perez.jpg") y no tiene por qué viajar en un
  // `Content-Disposition` hacia un tercero. Se manda uno neutro.
  const extension = extensionDeMime(mime) ?? "bin";
  const descarga = await d.firmarDescarga(
    { clave, nombreArchivo: `original.${extension}`, expiraEnSegundos: 300 },
    rEnR2,
  );
  if (!descarga.ok) {
    await liberar();
    return falla("fallo-almacenamiento", descarga.error.mensaje);
  }

  const importada = await d.importarImagen(
    {
      url: descarga.valor.url,
      // Todo lo que no es público se sirve firmado. Un álbum es
      // `compartida`: no está listado en ningún lado, pero tampoco es
      // una URL abierta que se pueda reenviar para siempre.
      requiereFirma: visibilidad !== "publica",
      metadata: { asset: assetId, entidad },
    },
    { entorno: d.entorno },
  );

  if (!importada.ok) {
    // Fallo TEMPORAL: el original está sellado y sigue estándolo. Se
    // suelta el lease para que un reintento salte directo a esta parte,
    // sin volver a subir ni a verificar nada.
    await liberar();
    return falla(
      importada.error.codigo === "config-incompleta" ? "sin-configuracion" : "fallo-imagenes",
      importada.error.mensaje,
    );
  }

  // ---------- 6. Registrar la imagen ----------
  const fin = await llamar(
    admin,
    fn.finalizarCf,
    argsDe(autorizacion, {
      p_asset_id: assetId,
      p_lease: lease,
      p_cf_image_id: importada.valor.id,
    }),
  );

  const cFin = fin.error ? null : txt(fin.fila, "codigo");
  if (cFin === "finalizada" || cFin === "reutilizada") {
    return exito({ asset_id: assetId, estado: "listo", destino: "r2+cloudflare" }, ctx, 200);
  }

  // ---------- 7. Cloudflare creó la imagen y SQL no la registró ----------
  //
  // Es el peor estado posible: una imagen que existe, que se factura y
  // que ninguna fila referencia. Se borra. Y si el borrado también
  // falla, su id queda ESCRITO en la fila —sin tocar estado ni sellos—
  // para que se pueda encontrar después. Nunca se la deja invisible.
  const huerfana = importada.valor.id;
  const borrada = await d.borrarImagen({ id: huerfana }, { entorno: d.entorno });
  if (!borrada.ok) {
    const anotada = await admin.rpc("media_anotar_incidencia", {
      p_asset_id: assetId,
      p_detalle: `imagen huérfana en Cloudflare sin borrar: ${huerfana}`,
    });
    d.registrar(
      `cf-huerfana ${huerfana} asset=${assetId} anotada=${anotada.error ? "no" : "si"}`,
    );
  }

  if (fin.error) return falla(codigoDePostgres(fin.error.code), `finalizar-cf: ${fin.error.code}`);
  if (cFin === "lease_invalido") return falla("en-curso", "finalizar-cf: lease vencido");
  return falla("estado-no-confirmable", `finalizar-cf: ${cFin}`);
}
