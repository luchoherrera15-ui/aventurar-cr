import { createSign } from "node:crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarSaldo } from "@/lib/lealtad/motor";
import { emisoraDeFilasCrudas } from "./programa-principal";
import { minutoISOCR } from "@/lib/fechas";
import {
  camposSegunModo,
  coloresDe,
  metaDeSellos,
  tarjetaDesdeFila,
  textoDePausa,
  type ConfigPase,
  type MetaRecompensa,
} from "./tarjeta";
import { estadoVisible } from "@/lib/lealtad/programas";
import { resumenDeFila } from "./programa-principal";
import {
  buscarMiembroDelPase,
  filaDeAfiliacion,
  type CodigoFalloPase,
  type IdentidadDelPase,
  type MiembroDelPase,
} from "./identidad";
import {
  tipoDe,
  TIPOS_HEREDADOS,
  TIPOS_TARJETA,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";

/**
 * Pases de lealtad en GOOGLE Wallet (Android) — el espejo de Apple.
 *
 * Google funciona al revés que Apple y eso simplifica todo:
 *
 *  · No hay archivo firmado: el pase es un OBJETO en la API de Google
 *    (LoyaltyClass por negocio + LoyaltyObject por miembro), y
 *    "agregar al Wallet" es un link con un JWT firmado por nuestra
 *    cuenta de servicio.
 *  · No hay push propio: al hacer PATCH del objeto, Google actualiza
 *    los teléfonos solo. Sin APNs, sin registros de dispositivo.
 *
 * Sin dependencias nuevas: el RS256 del JWT y el OAuth (JWT bearer) se
 * firman con node:crypto, igual que la firma PKCS#7 de Apple se hace
 * con node-forge. La llave viene de GOOGLE_WALLET_SA_KEY_B64 (el JSON
 * de la cuenta de servicio en base64) + GOOGLE_WALLET_ISSUER_ID.
 *
 * Todo está APAGADO sin esas variables: credencialesGoogleDelEntorno()
 * devuelve null y ni el botón se muestra.
 */

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const LOGO_BOOKEA = "https://www.bookea.lat/logo-bookea-v3.png";

export type CredencialesGoogle = {
  issuerId: string;
  clientEmail: string;
  /** PEM PKCS#8, tal cual viene en el JSON de la cuenta de servicio. */
  privateKey: string;
};

export function credencialesGoogleDelEntorno(): CredencialesGoogle | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const b64 = process.env.GOOGLE_WALLET_SA_KEY_B64;
  if (!issuerId || !b64) return null;
  try {
    const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
      client_email?: string;
      private_key?: string;
    };
    if (!json.client_email || !json.private_key) return null;
    return { issuerId, clientEmail: json.client_email, privateKey: json.private_key };
  } catch {
    return null;
  }
}

// ── JWT RS256 a mano ──────────────────────────────────────────────────

function base64url(datos: Buffer | string): string {
  return Buffer.from(datos).toString("base64url");
}

export function firmarJwt(
  payload: Record<string, unknown>,
  privateKey: string,
): string {
  const cabecera = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(payload));
  const firmador = createSign("RSA-SHA256");
  firmador.update(`${cabecera}.${cuerpo}`);
  const firma = firmador.sign(privateKey).toString("base64url");
  return `${cabecera}.${cuerpo}.${firma}`;
}

// ── OAuth: token de acceso con caché ─────────────────────────────────

let tokenCache: { token: string; vence: number } | null = null;

async function tokenDeAcceso(cred: CredencialesGoogle): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.vence - 60_000) return tokenCache.token;

  const ahora = Math.floor(Date.now() / 1000);
  const assertion = firmarJwt(
    {
      iss: cred.clientEmail,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    },
    cred.privateKey,
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth de Google respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: json.access_token, vence: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

// ── Ids deterministas ─────────────────────────────────────────────────
// El id del objeto SALE del miembro (y la clase, del negocio): no hay
// tabla de mapeo que se pueda desincronizar. Google solo acepta
// [a-zA-Z0-9._-], así que los uuid van sin guiones.

export function idDeClase(issuerId: string, ranchoId: string): string {
  return `${issuerId}.negocio_${ranchoId.replace(/-/g, "")}`;
}

export function idDeObjeto(issuerId: string, miembroId: string): string {
  return `${issuerId}.miembro_${miembroId.replace(/-/g, "")}`;
}

// ── Los recursos, como los quiere la API ──────────────────────────────

/** Una imagen como las pide la API: la URL y su texto alternativo. */
type ImagenGoogle = {
  sourceUri: { uri: string };
  contentDescription: { defaultValue: { language: string; value: string } };
};

function imagenGoogle(uri: string, descripcion: string): ImagenGoogle {
  return {
    sourceUri: { uri },
    contentDescription: { defaultValue: { language: "es", value: descripcion } },
  };
}

export function construirClase({
  issuerId,
  ranchoId,
  nombreNegocio,
  config,
}: {
  issuerId: string;
  ranchoId: string;
  nombreNegocio: string;
  config: ConfigPase;
}) {
  const colores = coloresDe(config);
  return {
    id: idDeClase(issuerId, ranchoId),
    issuerName: "Bookea",
    programName: nombreNegocio,
    programLogo: imagenGoogle(config.pase_logo_url || LOGO_BOOKEA, `Logo de ${nombreNegocio}`),
    hexBackgroundColor: colores.fondo,
    countryCode: "CR",
    reviewStatus: "UNDER_REVIEW",
  };
}

/**
 * Cómo se llama el número grande de la tarjeta en Android.
 *
 * Es un Record COMPLETO sobre `TipoTarjeta` y no un ternario: antes
 * eran tres tipos escritos a mano y los otros CINCO caían en «Puntos»,
 * o sea cinco tarjetas distintas mostrando la misma palabra
 * equivocada. Así el catálogo manda: el día que se agregue un noveno
 * tipo esto no compila hasta que alguien decida cómo se llama su saldo.
 *
 * En minúscula-inicial porque Google lo dibuja tal cual; Apple usa
 * mayúsculas por su propio layout (`camposSegunModo`).
 */
const ETIQUETA_SALDO: Record<TipoTarjeta, string> = {
  sellos: "Sellos",
  puntos: "Puntos",
  cupon: "Cupón",
  descuento: "Descuento",
  membresia: "Membresía",
  giftcard: "Saldo",
  evento: "Entrada",
  cashback: "Saldo",
};

type ModuloDeTexto = { id: string; header: string; body: string };

/**
 * Lo que CAMBIA dentro del LoyaltyObject: el saldo y su explicación.
 *
 * Vive afuera de `construirObjeto` porque hay dos caminos que escriben
 * lo mismo —crear el objeto y el PATCH que lo refresca en cada sello—
 * y estaban duplicados, cada uno con su propio ternario de tres tipos.
 * Un pase que se CREA diciendo una cosa y se REFRESCA diciendo otra es
 * el bug que nadie reporta: aparece solo después, sin que nadie toque
 * nada.
 *
 * El texto sale de `camposSegunModo`, el mismo que arma el pase de
 * Apple: el iPhone y el Android de dos clientes del mismo negocio
 * tienen que decir lo mismo.
 *
 * Recibe la CONFIG entera y no solo el modo: la banda del negocio
 * (0132) es parte de lo que el objeto muestra, y si esta función
 * hubiera seguido recibiendo un campo suelto habría hecho falta
 * agregarlo en los dos caminos a mano — que es exactamente la forma en
 * que un pase nace con foto y la pierde al primer sello.
 */
export function contenidoDelObjeto({
  negocioNombre,
  saldo,
  config,
  meta,
  beneficio,
  pausado,
}: {
  negocioNombre: string;
  saldo: number;
  config: ConfigPase;
  meta: MetaRecompensa;
  beneficio: ConfigBeneficio | null;
  /**
   * EL PROGRAMA ESTÁ EN PAUSA — y este parámetro tiene TRES valores, no
   * dos, porque el PATCH de Google no borra lo que no se nombra:
   *
   *   · `undefined` — nadie preguntó por la pausa. Sale exactamente el
   *     objeto de siempre, con `textModulesData` ausente cuando no hay
   *     módulos. Es lo que usa la CREACIÓN del pase (`construirObjeto`)
   *     y lo que mantiene el objeto byte por byte igual que antes.
   *   · `true` — se antepone el módulo de la pausa.
   *   · `false` — se manda `textModulesData` SIEMPRE, aunque vaya
   *     vacío. Esto es la vuelta: omitir el campo dejaría el módulo de
   *     la pausa pegado en el objeto para siempre, y un pase que se
   *     queda diciendo «en pausa» después de que el negocio renovó
   *     convierte el corte en una trampa.
   *
   * Lo manda el refresco (`refrescarPaseGoogleDeMiembro`), que sabe el
   * estado real del programa y siempre pasa un booleano.
   */
  pausado?: boolean;
}): {
  loyaltyPoints: { label: string; balance: { int: number } | { string: string } };
  textModulesData?: ModuloDeTexto[];
  heroImage?: ImagenGoogle;
} {
  const tipo = tipoDe(config.modo);
  // A PROPÓSITO sin `pausado`: el saldo, el cupón del 30% y el «5 de
  // 10» se siguen leyendo igual estando en pausa —los sellos quedan a
  // la vista, que es la decisión— y la pausa entra como un módulo
  // aparte. Pasárselo acá duplicaría el aviso: saldría en el módulo de
  // la pausa Y otra vez en el del beneficio.
  const campos = camposSegunModo({ negocioNombre, saldo, meta, config, beneficio });

  const modulos: ModuloDeTexto[] = [];
  // Primero, para que sea lo primero que se lee en la tarjeta.
  if (pausado === true) {
    modulos.push({
      id: "pausa",
      header: "Programa en pausa",
      body: textoDePausa(negocioNombre, tipo),
    });
  }
  if (TIPOS_HEREDADOS.includes(tipo)) {
    // La meta de un programa de los viejos vive en `recompensas`: es el
    // «5 de 10» de toda la vida y se deja intacto.
    const total = metaDeSellos(meta);
    if (meta) {
      modulos.push({
        id: "meta",
        header: meta.nombre,
        body:
          total !== null
            ? `${Math.min(saldo, total)} de ${total} — al completarlos es tuya.`
            : `Cuesta ${meta.costo_puntos} puntos.`,
      });
    }
  } else if (campos.detalle.value.trim()) {
    // Los tipos de la 0135 llevan su promesa en `beneficio`, no en una
    // recompensa: acá va lo que el cliente necesita saber para usarla
    // (cómo se cobra el cupón, qué da la membresía, dónde es el evento).
    modulos.push({
      id: "beneficio",
      header: enTitulo(campos.detalle.label),
      body: campos.detalle.value,
    });
  }

  // La banda del negocio: el equivalente del `strip.png` de Apple. Va
  // en el OBJETO y no en la clase porque la clase es del negocio y el
  // objeto es del cliente — y porque así el mismo PATCH que refresca el
  // saldo la mantiene, sin un segundo camino que se pueda olvidar.
  //
  // Solo si hay foto: un `heroImage` sin URI hace que Google rechace el
  // objeto entero, y el pase no se emite. Ojo con el otro lado de eso —
  // como el refresco es un PATCH, QUITAR la banda del editor no la
  // borra del objeto ya creado; se queda con la última que tuvo.
  const banda = config.pase_banner_url ?? null;

  // ── EL ICONO DEL SELLO (0145) EN ANDROID ──────────────────────────
  // Viaja hasta acá dentro de `config` —la misma que lee Apple— y acá
  // se queda, a propósito.
  //
  // Android no tiene la tira: el LoyaltyObject dibuja el saldo como un
  // número y sus únicas dos ranuras de imagen son `programLogo` (la
  // marca del negocio) y `heroImage` (su foto). Poner el icono en
  // cualquiera de las dos sería taparle al negocio su propia identidad
  // para mostrar un dibujo genérico.
  //
  // Y no se genera una imagen de sellos como en Apple porque haría
  // falta una URL pública que Google pueda bajar: si esa URL falla una
  // vez, Google RECHAZA EL OBJETO ENTERO y el cliente se queda sin
  // pase. Un adorno no vale ese riesgo. El progreso, que es el dato que
  // importa, ya va en `loyaltyPoints` y en el módulo de texto.

  return {
    loyaltyPoints: {
      label: ETIQUETA_SALDO[tipo],
      // Un cupón o una entrada no tienen saldo que crezca: mostrar un
      // «0» sería mentirle al cliente sobre lo que tiene en la mano.
      // `balance` acepta int o string, y acá el string ES el beneficio.
      balance: TIPOS_TARJETA[tipo].acumula ? { int: saldo } : { string: campos.encabezado.value },
    },
    // Ver el comentario de `pausado`: con un booleano explícito el
    // campo VIAJA SIEMPRE (es la única forma de que el PATCH borre el
    // módulo de la pausa); sin él, se calla cuando no hay módulos, que
    // es el objeto de siempre.
    ...(modulos.length > 0 || pausado !== undefined ? { textModulesData: modulos } : {}),
    ...(banda ? { heroImage: imagenGoogle(banda, `Banda de ${negocioNombre}`) } : {}),
  };
}

/** «CÓMO SE USA» (mayúsculas de Apple) → «Cómo se usa» (Google). */
function enTitulo(texto: string): string {
  const minuscula = texto.toLocaleLowerCase("es-CR");
  return minuscula.charAt(0).toLocaleUpperCase("es-CR") + minuscula.slice(1);
}

export function construirObjeto({
  issuerId,
  ranchoId,
  miembroId,
  nombreNegocio,
  nombreCliente,
  serial,
  saldo,
  config,
  meta,
  beneficio,
}: {
  issuerId: string;
  ranchoId: string;
  miembroId: string;
  nombreNegocio: string;
  nombreCliente: string;
  /** El MISMO serial de pases_wallet: es lo que lee el escáner. */
  serial: string;
  saldo: number;
  /** La apariencia del pase, tal como sale de `tarjetaDesdeFila`. */
  config: ConfigPase;
  meta: MetaRecompensa;
  /** La config propia del tipo (0135). null = programa anterior. */
  beneficio: ConfigBeneficio | null;
}) {
  return {
    id: idDeObjeto(issuerId, miembroId),
    classId: idDeClase(issuerId, ranchoId),
    state: "ACTIVE",
    accountId: miembroId,
    accountName: nombreCliente,
    barcode: {
      type: "QR_CODE",
      value: serial,
      alternateText: "Tarjeta Bookea",
    },
    ...contenidoDelObjeto({ negocioNombre: nombreNegocio, saldo, config, meta, beneficio }),
  };
}

// ── Hablar con la API ─────────────────────────────────────────────────

async function llamarApi(
  cred: CredencialesGoogle,
  metodo: "GET" | "POST" | "PATCH",
  ruta: string,
  cuerpo?: unknown,
): Promise<{ status: number; json: unknown }> {
  const token = await tokenDeAcceso(cred);
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      ...(cuerpo ? { "content-type": "application/json" } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Algunas respuestas de error vienen vacías.
  }
  return { status: res.status, json };
}

/** Crea el recurso si no existe; si existe, lo actualiza (PATCH). */
async function asegurarRecurso(
  cred: CredencialesGoogle,
  coleccion: "loyaltyClass" | "loyaltyObject",
  recurso: { id: string },
): Promise<void> {
  const existe = await llamarApi(cred, "GET", `/${coleccion}/${recurso.id}`);
  if (existe.status === 404) {
    const creado = await llamarApi(cred, "POST", `/${coleccion}`, recurso);
    if (creado.status >= 300) {
      throw new Error(`Google no aceptó el ${coleccion}: ${JSON.stringify(creado.json).slice(0, 300)}`);
    }
    return;
  }
  if (existe.status >= 300) {
    throw new Error(`Google respondió ${existe.status} consultando el ${coleccion}.`);
  }
  const parche = await llamarApi(cred, "PATCH", `/${coleccion}/${recurso.id}`, recurso);
  if (parche.status >= 300) {
    throw new Error(`Google no aceptó actualizar el ${coleccion}: ${JSON.stringify(parche.json).slice(0, 300)}`);
  }
}

// ── Lo que usa el resto de la app ─────────────────────────────────────

export type ResultadoPaseGoogle =
  | { ok: true; url: string }
  | { ok: false; codigo: CodigoFalloPase; motivo: string };

/**
 * Genera (o refresca) el pase de Google de un cliente y devuelve el
 * link "Guardar en Google Wallet". Espejo de generarPaseDeLealtad:
 * auto-afilia al bajarlo, serial estable, y la identidad la verificó
 * quien llama —con la sesión de Bookea o con la cookie de la persona
 * (0138), porque desde el alta por QR hay tarjeta sin cuenta.
 */
export async function generarPaseGoogle({
  ranchoId,
  clienteId,
  personaId,
}: IdentidadDelPase & { ranchoId: string }): Promise<ResultadoPaseGoogle> {
  if (!personaId && !clienteId) {
    return { ok: false, codigo: "sin_identidad", motivo: "No sabemos de quién es esta tarjeta." };
  }

  const cred = credencialesGoogleDelEntorno();
  if (!cred) {
    return {
      ok: false,
      codigo: "sin_credenciales",
      motivo: "Google Wallet no está configurado en este servidor.",
    };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, codigo: "sin_conexion", motivo: "No hay conexión de servicio." };

  const { data: negocio } = await db
    .from("ranchos")
    .select("id, nombre, plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  if (!negocio) {
    return { ok: false, codigo: "negocio_desconocido", motivo: "Ese negocio no existe." };
  }

  // `select *`, igual que en Apple (generar.ts): desde la 0134 el
  // programa cuelga de una CUENTA, y pedir `cuenta_id` explícitamente
  // rompería la consulta entera mientras la migración no esté corrida.
  //
  // Y sin `.maybeSingle()`, también igual que en Apple: la 0134 quitó el
  // `unique(rancho_id)`, así que con dos tarjetas la consulta fallaba y
  // ningún Android podía guardar su pase. Cuál emite lo decide
  // `emisoraDeFilasCrudas`, la misma elección de todas las pantallas.
  const { data: filasPrograma } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", ranchoId);

  const programaFila = emisoraDeFilasCrudas(
    (filasPrograma ?? []) as Record<string, unknown>[],
    minutoISOCR(),
  );
  if (!programaFila) {
    return {
      ok: false,
      codigo: "sin_programa",
      motivo: "Este negocio todavía no tiene programa de lealtad.",
    };
  }
  const programaId = programaFila.id as string;
  // Apariencia y beneficio de la fila, con el MISMO lector que Apple
  // (tarjeta.ts). Antes cada plataforma casteaba la fila a su propia
  // lista de columnas escrita a mano y ninguna incluía `beneficio`.
  const { config, beneficio } = tarjetaDesdeFila(programaFila);

  // Afiliación implícita, igual que en Apple: pedir la tarjeta ES unirse.
  //
  // Y la búsqueda por PERSONA primero, igual que en Apple: quien se
  // afilió por el póster tiene `cliente_id` en null y buscándolo por
  // cuenta no aparecía nunca. `buscarMiembroDelPase` es el mismo de
  // `generar.ts` — el bloque estaba copiado literal en los dos archivos
  // y por eso los dos tenían el mismo bug del cupo (0142).
  let miembro = await buscarMiembroDelPase(db, programaId, { personaId, clienteId });
  if (!miembro) {
    // El tope del plan se cumple igual que en Apple (generar.ts): la
    // afiliación NUEVA se frena cuando el negocio está lleno, y el plan
    // sale de la CUENTA con el del rancho como respaldo.
    //
    // El consumo se cuenta con `personasActivasDe` (0142) y no con un
    // count por `programa_id`: por cuenta, por persona y solo lo
    // vigente. Este bloque era un duplicado literal del de `generar.ts`
    // —los dos con el mismo bug— y ahora los dos llaman a lo mismo.
    const { definicionDe } = await import("@/lib/lealtad/planes");
    const { contextoDeCuenta } = await import("@/lib/lealtad/cuenta");
    const { personasActivasDe } = await import("@/lib/lealtad/cupo");
    const { plan, cuentaId } = await contextoDeCuenta(db, programaFila, {
      planRancho: (negocio as { plan_lealtad?: string | null }).plan_lealtad ?? null,
    });
    const limite = definicionDe(plan)?.limites.clientesActivos;
    if (limite !== null && limite !== undefined) {
      const usadas = await personasActivasDe(db, { cuentaId, ranchoId });
      if (usadas >= limite) {
        return {
          ok: false,
          codigo: "lleno",
          motivo:
            "El programa de este negocio está lleno por ahora — preguntá en el local.",
        };
      }
    }

    const { data: nuevo, error } = await db
      .from("miembros")
      .insert(filaDeAfiliacion(programaId, { personaId, clienteId }))
      .select("id, estado, cliente_id")
      .single();
    if (error) {
      return { ok: false, codigo: "error", motivo: "No se pudo afiliar: " + error.message };
    }
    miembro = nuevo as MiembroDelPase;
  }
  if (miembro.estado === "cancelada") {
    return { ok: false, codigo: "cancelada", motivo: "Esta membresía está cancelada." };
  }

  // La costura con la cuenta, igual que en Apple: quien se afilió por el
  // póster y hoy vuelve logueado gana el `cliente_id` que le faltaba.
  if (clienteId && !miembro.cliente_id) {
    await db.from("miembros").update({ cliente_id: clienteId }).eq("id", miembro.id);
  }

  // Un pase por miembro y plataforma, con serial estable (el QR).
  let { data: pase } = await db
    .from("pases_wallet")
    .select("serial_number")
    .eq("miembro_id", miembro.id)
    .eq("plataforma", "google")
    .maybeSingle();
  if (!pase) {
    const { data: nuevo, error } = await db
      .from("pases_wallet")
      .insert({
        miembro_id: miembro.id,
        plataforma: "google",
        serial_number: randomUUID(),
        // Google no autentica con esto (no hay web service propio),
        // pero la columna es not null y única por diseño.
        auth_token: randomBytes(32).toString("hex"),
        saldo_cache: 0,
      })
      .select("serial_number")
      .single();
    if (error) {
      return { ok: false, codigo: "error", motivo: "No se pudo crear el pase: " + error.message };
    }
    pase = nuevo;
  }

  const saldo = (await consultarSaldo(miembro.id)) ?? 0;
  const { data: recompensa } = await db
    .from("recompensas")
    .select("nombre, costo_puntos")
    .eq("programa_id", programaId)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Cómo saluda el pase. Google lo muestra en la tarjeta, así que no
  // puede quedar vacío: primero el perfil de la cuenta, después el
  // nombre de la persona (0138) —que puede venir de otro negocio donde
  // sí lo dejó— y de último "Cliente". Sin la segunda, todo el que
  // entró por el póster —que no da su nombre, son dos campos— saldría
  // como "Cliente" aunque Bookea sepa cómo se llama.
  const nombreCliente = await nombreDeQuienLlega(db, { clienteId, personaId });

  try {
    await asegurarRecurso(
      cred,
      "loyaltyClass",
      construirClase({ issuerId: cred.issuerId, ranchoId, nombreNegocio: negocio.nombre, config }),
    );
    await asegurarRecurso(
      cred,
      "loyaltyObject",
      construirObjeto({
        issuerId: cred.issuerId,
        ranchoId,
        miembroId: miembro.id,
        nombreNegocio: negocio.nombre,
        nombreCliente,
        serial: pase!.serial_number as string,
        saldo,
        // La config ENTERA: de acá sale también la banda del negocio.
        config,
        meta: recompensa
          ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
          : null,
        // Lo que hace que un cupón diga «30% OFF» y no «Puntos 0».
        beneficio,
      }),
    );
  } catch (e) {
    return {
      ok: false,
      codigo: "error",
      motivo: e instanceof Error ? e.message : "Google Wallet no respondió.",
    };
  }

  const ahora = Math.floor(Date.now() / 1000);
  const jwt = firmarJwt(
    {
      iss: cred.clientEmail,
      aud: "google",
      typ: "savetowallet",
      iat: ahora,
      payload: { loyaltyObjects: [{ id: idDeObjeto(cred.issuerId, miembro.id) }] },
    },
    cred.privateKey,
  );

  return { ok: true, url: `https://pay.google.com/gp/v/save/${jwt}` };
}

/**
 * Con qué nombre saluda el pase de Google.
 *
 * Ninguna de las dos consultas puede tumbar el pase: si `perfiles` no
 * tiene fila o `personas` todavía no existe (base sin la 0138), se cae
 * al saludo genérico y la tarjeta se entrega igual.
 */
async function nombreDeQuienLlega(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  quien: IdentidadDelPase,
): Promise<string> {
  if (quien.clienteId) {
    const { data } = await db
      .from("perfiles")
      .select("nombre")
      .eq("id", quien.clienteId)
      .maybeSingle();
    const nombre = ((data?.nombre as string | null) ?? "").trim();
    if (nombre) return nombre;
  }

  if (quien.personaId) {
    const { data } = await db
      .from("personas")
      .select("nombre")
      .eq("id", quien.personaId)
      .maybeSingle();
    const nombre = ((data?.nombre as string | null) ?? "").trim();
    if (nombre) return nombre;
  }

  return "Cliente";
}

/**
 * Cómo le fue al refresco. Existe para el trabajo por tandas
 * (`src/lib/wallet/aviso-de-pausa.ts`), que necesita saber si a ESTE
 * pase le entró el cambio para no marcarlo como avisado si no entró.
 *
 * `ok: true` incluye el caso «no había nada que refrescar» (el miembro
 * no tiene pase de Android, o su objeto nunca se creó): no es un fallo
 * y reintentarlo cada diez minutos para siempre no arregla nada.
 */
export type ResultadoRefresco = { ok: true } | { ok: false; motivo: string };

/**
 * Refresca el saldo del pase de Google de un miembro (tras acreditar,
 * canjear o revertir). Google avisa a los teléfonos solo — esto es el
 * equivalente entero del push de Apple. Nunca lanza: el ledger ya
 * quedó bien y es lo que manda.
 *
 * El valor de vuelta lo IGNORAN los llamadores de siempre (el
 * mostrador); lo mira solo el trabajo por tandas.
 */
export async function refrescarPaseGoogleDeMiembro(
  miembroId: string,
): Promise<ResultadoRefresco> {
  try {
    const cred = credencialesGoogleDelEntorno();
    const db = createAdminClient();
    // Sin llaves de Google no es un fallo del pase, es un servidor sin
    // configurar: se dice y no se revienta (el trabajo por tandas ni
    // siquiera llega acá, se salta la plataforma entera).
    if (!cred) return { ok: false, motivo: "Google Wallet no está configurado en este servidor." };
    if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

    const { data: pase } = await db
      .from("pases_wallet")
      .select("serial_number")
      .eq("miembro_id", miembroId)
      .eq("plataforma", "google")
      .maybeSingle();
    if (!pase) return { ok: true }; // sin pase de Android no hay nada que refrescar

    const { data: miembro } = await db
      .from("miembros")
      .select("id, programa_id")
      .eq("id", miembroId)
      .maybeSingle();
    if (!miembro) return { ok: false, motivo: "El miembro no existe." };

    // `select *` y no `modo, beneficio`: la 0135 puede no estar
    // corrida y pedir la columna por nombre haría fallar la consulta
    // entera, dejando el pase sin refrescar sin decir por qué.
    const { data: programaFila } = await db
      .from("programa_lealtad")
      .select("*")
      .eq("id", miembro.programa_id)
      .maybeSingle();
    const programa = (programaFila ?? {}) as Record<string, unknown>;
    const { config, beneficio } = tarjetaDesdeFila(programa);

    // El nombre del negocio es el respaldo del «dónde» de un evento.
    let nombreNegocio = "";
    if (typeof programa.rancho_id === "string") {
      const { data: negocio } = await db
        .from("ranchos")
        .select("nombre")
        .eq("id", programa.rancho_id)
        .maybeSingle();
      nombreNegocio = ((negocio?.nombre as string | null) ?? "").trim();
    }

    const saldo = (await consultarSaldo(miembroId)) ?? 0;
    const { data: recompensa } = await db
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", miembro.programa_id)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle();

    const meta: MetaRecompensa = recompensa
      ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
      : null;

    // El MISMO armado que usa la creación: el PATCH no puede decir algo
    // distinto de lo que el pase decía al nacer.
    //
    // Con UNA diferencia, que es todo el punto del corte: acá se sabe
    // el estado del programa, así que el parche lleva la pausa (o la
    // saca). El booleano va SIEMPRE explícito —nunca `undefined`— para
    // que la vuelta borre el módulo que puso la ida.
    const parche = contenidoDelObjeto({
      negocioNombre: nombreNegocio,
      saldo,
      config,
      meta,
      beneficio,
      pausado: estadoVisible(resumenDeFila(programa), minutoISOCR()) === "pausado",
    });

    const res = await llamarApi(
      cred,
      "PATCH",
      `/loyaltyObject/${idDeObjeto(cred.issuerId, miembroId)}`,
      parche,
    );
    if (res.status >= 300 && res.status !== 404) {
      // 404 = nunca se creó el objeto (fila huérfana): no es un error
      // que valga la pena gritar en cada sello.
      console.warn(`[google-wallet] PATCH respondió ${res.status}: ${JSON.stringify(res.json).slice(0, 200)}`);
    }

    // ── EL ESPEJO SOLO SE ESCRIBE SI EL PATCH ENTRÓ ────────────────
    // Antes esto corría siempre, incluso justo después del `warn` de un
    // PATCH fallido. El resultado era la peor combinación posible: el
    // panel mostrando un saldo que el teléfono del cliente NO tiene, y
    // sin ninguna señal de que divergieron. En el mostrador eso es una
    // discusión con el cliente y la palabra del negocio en duda.
    //
    // Si el PATCH no entró, `saldo_cache` se queda con el valor viejo
    // —que es el que el teléfono sigue mostrando—, o sea que el panel y
    // el pase siguen diciendo lo MISMO aunque los dos estén atrasados.
    // Dos fuentes de acuerdo valen más que una adelantada y una atrás.
    //
    // La verdad siempre es `transacciones_puntos`; esto es solo el
    // espejo para pintar sin sumar el ledger.
    if (res.status < 300) {
      await db
        .from("pases_wallet")
        .update({ saldo_cache: saldo, actualizado_en: new Date().toISOString() })
        .eq("miembro_id", miembroId)
        .eq("plataforma", "google");
    }

    // 404 = el objeto nunca se creó (fila huérfana). No hay nada que
    // reintentar: se da por atendido para que el trabajo por tandas no
    // se quede dando vueltas sobre el mismo pase cada diez minutos.
    if (res.status >= 300 && res.status !== 404) {
      return { ok: false, motivo: `Google respondió ${res.status} al parchar el objeto.` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[google-wallet] No se pudo refrescar el pase:", e);
    return { ok: false, motivo: e instanceof Error ? e.message : "Google Wallet no respondió." };
  }
}

/**
 * EL AVISO DE MARKETING (0152), del lado de Google.
 *
 * A diferencia del saldo —que se REESCRIBE con un PATCH del objeto
 * entero— un mensaje se AGREGA: Google tiene un endpoint propio para
 * esto (`loyaltyObject.addMessage`) que empuja el aviso al teléfono del
 * cliente sin tocar el resto del objeto. Es el mecanismo nativo, no un
 * campo de texto más: es lo que hace que el cliente reciba una
 * notificación de verdad, igual que el `changeMessage` de Apple.
 *
 * `id` en el mensaje evita que el mismo aviso se duplique si esto se
 * reintenta — Google lo trata como el mismo mensaje si el id coincide.
 */
export async function enviarMensajeGoogle(
  miembroId: string,
  mensaje: string,
): Promise<ResultadoRefresco> {
  try {
    const cred = credencialesGoogleDelEntorno();
    if (!cred) return { ok: false, motivo: "Google Wallet no está configurado en este servidor." };

    const db = createAdminClient();
    if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

    const { data: pase } = await db
      .from("pases_wallet")
      .select("serial_number")
      .eq("miembro_id", miembroId)
      .eq("plataforma", "google")
      .eq("activo", true)
      .maybeSingle();
    if (!pase) return { ok: true }; // sin pase de Android, nada que avisar

    const res = await llamarApi(
      cred,
      "POST",
      `/loyaltyObject/${idDeObjeto(cred.issuerId, miembroId)}/addMessage`,
      {
        message: {
          header: "Bookea",
          body: mensaje,
          // Un id NUEVO por minuto: el mismo texto mandado dos veces en
          // dos ocasiones distintas son dos avisos reales, no uno
          // duplicado — pero un reintento inmediato del MISMO envío cae
          // en el mismo minuto y Google lo desduplica solo.
          id: `promo-${new Date().toISOString().slice(0, 16)}`,
          messageType: "TEXT",
        },
      },
    );

    if (res.status >= 300 && res.status !== 404) {
      return { ok: false, motivo: `Google respondió ${res.status} al agregar el mensaje.` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Google Wallet no respondió." };
  }
}
