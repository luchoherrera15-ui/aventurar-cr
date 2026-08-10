/**
 * BOOKEA MEDIA — Cloudflare R2: los ORIGINALES.
 *
 * ⚠️  MÓDULO EXCLUSIVO DE SERVIDOR. Lee `R2_SECRET_ACCESS_KEY`, y
 *     cualquier import desde el navegador metería esa llave en el
 *     bundle.
 *
 *     Lo impone `import "server-only"`, la primera línea de abajo: si
 *     alguien lo importa desde un módulo de cliente, el BUILD FALLA con
 *     un mensaje claro en vez de compilar y filtrar la llave. Esa es la
 *     barrera de verdad.
 *
 *     `exigirServidor()` se conserva como defensa adicional para el
 *     tiempo de ejecución, no como sustituto.
 *
 * Acá vive el archivo tal cual lo subió la persona — el que se descarga,
 * el que va al ZIP del álbum, el que se imprime. Lo que se MIRA en la
 * interfaz nunca sale de acá: eso es Cloudflare Images
 * (cloudflare-images.ts). Un original de 5 MB en un `<img>` es
 * exactamente el problema que este proyecto viene a resolver.
 *
 * ── LO QUE ESTE MÓDULO NO DECIDE ─────────────────────────────────────
 *
 * No sabe de permisos, ni de álbumes, ni de quién es dueño de qué.
 * Recibe una clave ya validada y firma. Quien llama es el responsable de
 * haber comprobado antes que esa persona puede pedir ese archivo.
 */

// La barrera. Va primero, antes que cualquier otro import, para que un
// import desde un componente de cliente rompa el build de inmediato.
import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revisarClave, sanitizarNombre } from "./claves";
import { esMimePermitido } from "./tipos";

// ------------------------------------------------------------
// Resultados y errores
// ------------------------------------------------------------

export type CodigoErrorR2 =
  | "solo-servidor"
  | "config-incompleta"
  | "clave-invalida"
  | "expiracion-invalida"
  | "mime-invalido"
  | "no-existe"
  | "tamano-distinto"
  | "mime-distinto"
  | "fallo-proveedor";

export type ErrorR2 = {
  codigo: CodigoErrorR2;
  /** Apto para un log. NUNCA trae credenciales ni URLs firmadas. */
  mensaje: string;
};

export type ResultadoR2<T> = { ok: true; valor: T } | { ok: false; error: ErrorR2 };

const fallo = (codigo: CodigoErrorR2, mensaje: string): { ok: false; error: ErrorR2 } => ({
  ok: false,
  error: { codigo, mensaje },
});

/**
 * Convierte cualquier excepción del SDK en algo que se puede registrar.
 *
 * El error que tira el SDK puede traer la petición entera —incluida la
 * URL firmada, que lleva la credencial en la query— así que NO se
 * reenvía tal cual ni se hace `JSON.stringify`. Solo se rescatan el
 * nombre del error y el código HTTP, que es lo único que sirve para
 * diagnosticar.
 */
function sanitizarError(e: unknown): ErrorR2 {
  const nombre =
    typeof e === "object" && e !== null && "name" in e && typeof e.name === "string"
      ? e.name
      : "ErrorDesconocido";

  let http: number | undefined;
  if (typeof e === "object" && e !== null && "$metadata" in e) {
    const meta = (e as { $metadata?: { httpStatusCode?: number } }).$metadata;
    if (typeof meta?.httpStatusCode === "number") http = meta.httpStatusCode;
  }

  if (nombre === "NotFound" || nombre === "NoSuchKey" || http === 404) {
    return { codigo: "no-existe", mensaje: "El objeto no existe en R2." };
  }
  return {
    codigo: "fallo-proveedor",
    mensaje: `R2 respondió con un error (${nombre}${http ? `, HTTP ${http}` : ""}).`,
  };
}

// ------------------------------------------------------------
// Guarda de servidor
// ------------------------------------------------------------

function exigirServidor(): ErrorR2 | null {
  if (typeof window !== "undefined") {
    return {
      codigo: "solo-servidor",
      mensaje: "r2.ts es exclusivo de servidor y se intentó usar desde el navegador.",
    };
  }
  return null;
}

// ------------------------------------------------------------
// Configuración — perezosa, nunca en el import
// ------------------------------------------------------------

export type ConfigR2 = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucket: string;
};

/** Las cinco variables, en el orden en que se piden en el informe. */
const VARIABLES = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_REGION",
  "R2_BUCKET_ORIGINALS",
] as const;

/**
 * Lee el entorno EN CADA LLAMADA, no al importar el módulo.
 *
 * Es deliberado: si se leyera arriba del archivo, `next build` —que
 * importa todo para analizarlo— fallaría en cualquier máquina sin
 * credenciales, y los tests necesitarían un `.env` de mentira para
 * arrancar. Así, un entorno incompleto es un error que devuelve la
 * función, no una explosión al cargar.
 *
 * El mensaje nombra las variables que FALTAN. Nunca imprime un valor:
 * saber que `R2_SECRET_ACCESS_KEY` está vacía es útil; ver su contenido
 * en un log, no.
 */
export function configuracionR2(entorno: NodeJS.ProcessEnv = process.env): ResultadoR2<ConfigR2> {
  const faltan = VARIABLES.filter((v) => !entorno[v]?.trim());
  if (faltan.length > 0) {
    return fallo("config-incompleta", `Faltan variables de R2: ${faltan.join(", ")}.`);
  }
  return {
    ok: true,
    valor: {
      accessKeyId: entorno.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: entorno.R2_SECRET_ACCESS_KEY!.trim(),
      endpoint: entorno.R2_ENDPOINT!.trim(),
      region: entorno.R2_REGION!.trim(),
      bucket: entorno.R2_BUCKET_ORIGINALS!.trim(),
    },
  };
}

/** ¿Está R2 configurado? Para decidir si ofrecer el camino nuevo. */
export function r2Configurado(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return configuracionR2(entorno).ok;
}

// ------------------------------------------------------------
// Expiraciones
// ------------------------------------------------------------

/** Nada por debajo de esto: una URL de 5 s no le sirve a nadie. */
export const EXPIRACION_MINIMA_S = 30;
/** Ni por encima: una URL firmada es una llave suelta mientras viva. */
export const EXPIRACION_MAXIMA_S = 3600;
/** El valor normal de una descarga, como se acordó. */
export const EXPIRACION_DESCARGA_S = 15 * 60;
/** Subir un original pesado en una conexión mala lleva más que bajarlo. */
export const EXPIRACION_SUBIDA_S = 30 * 60;

function revisarExpiracion(segundos: number): ErrorR2 | null {
  if (!Number.isFinite(segundos) || !Number.isInteger(segundos)) {
    return { codigo: "expiracion-invalida", mensaje: "La expiración tiene que ser un entero." };
  }
  if (segundos < EXPIRACION_MINIMA_S || segundos > EXPIRACION_MAXIMA_S) {
    return {
      codigo: "expiracion-invalida",
      mensaje: `La expiración tiene que estar entre ${EXPIRACION_MINIMA_S} y ${EXPIRACION_MAXIMA_S} segundos.`,
    };
  }
  return null;
}

// ------------------------------------------------------------
// Inyección de dependencias
// ------------------------------------------------------------

/**
 * Lo que las pruebas reemplazan para no tocar la red. En producción no
 * se pasa nada y se usan el cliente y el firmador de verdad.
 */
export type DependenciasR2 = {
  cliente?: S3Client;
  presignar?: typeof getSignedUrl;
  entorno?: NodeJS.ProcessEnv;
};

/**
 * El cliente, con lo mínimo que piden los ejemplos oficiales de R2 para
 * el SDK v3: endpoint propio de la cuenta, región y credenciales.
 *
 * Nada más. Antes acá había un `forcePathStyle: true` con un comentario
 * que afirmaba que R2 lo exige — es falso, los ejemplos de Cloudflare no
 * lo ponen. Se quitó y no se reemplazó por ninguna otra opción: el
 * default del SDK es lo correcto mientras no haya una razón medida para
 * cambiarlo.
 */
function crearCliente(config: ConfigR2): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/** Prepara config + cliente + firmador, o devuelve el error de entorno. */
function preparar(deps: DependenciasR2) {
  const guarda = exigirServidor();
  if (guarda) return fallo(guarda.codigo, guarda.mensaje);

  const config = configuracionR2(deps.entorno ?? process.env);
  if (!config.ok) return config;

  return {
    ok: true as const,
    valor: {
      config: config.valor,
      cliente: deps.cliente ?? crearCliente(config.valor),
      presignar: deps.presignar ?? getSignedUrl,
    },
  };
}

/** Una clave que no pasa `revisarClave` no llega a firmarse. */
function revisarClaveR2(clave: string): ErrorR2 | null {
  const r = revisarClave(clave);
  if (r.ok) return null;
  return { codigo: "clave-invalida", mensaje: `La clave de R2 no es válida (${r.motivo}).` };
}

// ------------------------------------------------------------
// 1. Firmar la SUBIDA del original
// ------------------------------------------------------------

export type SubidaFirmada = {
  url: string;
  clave: string;
  /** Las cabeceras que el cliente DEBE mandar; si no, la firma no valida. */
  cabeceras: Record<string, string>;
  expiraEnSegundos: number;
};

/**
 * Una URL prefirmada de PUT para que el navegador suba el original
 * DIRECTO a R2, sin pasar por Vercel.
 *
 * Va directo por una razón medida: Vercel corta el cuerpo de un request
 * cerca de 4,5 MB, y los originales pasan de eso. Ese límite es también
 * la razón por la que existe la migración 0079.
 *
 * `mime` y `bytes` se FIRMAN, no se sugieren: van dentro de la firma, y
 * si el cliente sube otra cosa o de otro tamaño, R2 rechaza la petición.
 * Sin eso, una URL para "una foto de 2 MB" serviría para subir un
 * ejecutable de 2 GB.
 */
export async function firmarSubida(
  params: {
    clave: string;
    mime: string;
    bytes: number;
    expiraEnSegundos?: number;
  },
  deps: DependenciasR2 = {},
): Promise<ResultadoR2<SubidaFirmada>> {
  const expira = params.expiraEnSegundos ?? EXPIRACION_SUBIDA_S;

  const errClave = revisarClaveR2(params.clave);
  if (errClave) return { ok: false, error: errClave };

  const errExp = revisarExpiracion(expira);
  if (errExp) return { ok: false, error: errExp };

  if (!esMimePermitido(params.mime)) {
    return fallo("mime-invalido", "Ese tipo de archivo no se puede subir.");
  }
  if (!Number.isInteger(params.bytes) || params.bytes <= 0) {
    return fallo("mime-invalido", "El tamaño declarado no es válido.");
  }

  const listo = preparar(deps);
  if (!listo.ok) return listo;

  try {
    const url = await listo.valor.presignar(
      listo.valor.cliente,
      new PutObjectCommand({
        Bucket: listo.valor.config.bucket,
        Key: params.clave,
        ContentType: params.mime,
        ContentLength: params.bytes,
      }),
      { expiresIn: expira, signableHeaders: new Set(["content-type", "content-length"]) },
    );

    return {
      ok: true,
      valor: {
        url,
        clave: params.clave,
        cabeceras: {
          "Content-Type": params.mime,
          "Content-Length": String(params.bytes),
        },
        expiraEnSegundos: expira,
      },
    };
  } catch (e) {
    return { ok: false, error: sanitizarError(e) };
  }
}

// ------------------------------------------------------------
// 2. Existencia y metadatos (HEAD)
// ------------------------------------------------------------

export type MetadatosR2 = {
  clave: string;
  bytes: number;
  mime: string | null;
  /**
   * El ETag que devuelve R2, tal cual.
   *
   * NO ES UN SHA-256 y no se puede usar como checksum de integridad: en
   * una subida multiparte es un hash de hashes con un sufijo `-N`, y ni
   * siquiera en una subida simple hay garantía de que sea MD5 del
   * contenido. Sirve para saber si el objeto CAMBIÓ entre dos lecturas,
   * nada más. El `checksum_sha256` de `media_assets` se calcula aparte,
   * sobre los bytes, y jamás se rellena con esto.
   */
  etag: string | null;
  modificadoEn: string | null;
};

export async function obtenerMetadatos(
  params: { clave: string },
  deps: DependenciasR2 = {},
): Promise<ResultadoR2<MetadatosR2>> {
  const errClave = revisarClaveR2(params.clave);
  if (errClave) return { ok: false, error: errClave };

  const listo = preparar(deps);
  if (!listo.ok) return listo;

  try {
    const res = await listo.valor.cliente.send(
      new HeadObjectCommand({ Bucket: listo.valor.config.bucket, Key: params.clave }),
    );
    return {
      ok: true,
      valor: {
        clave: params.clave,
        bytes: typeof res.ContentLength === "number" ? res.ContentLength : 0,
        mime: res.ContentType ?? null,
        etag: res.ETag ?? null,
        modificadoEn: res.LastModified ? res.LastModified.toISOString() : null,
      },
    };
  } catch (e) {
    return { ok: false, error: sanitizarError(e) };
  }
}

/** `true` si el objeto está; `false` si no. Otros errores se propagan. */
export async function existeObjeto(
  params: { clave: string },
  deps: DependenciasR2 = {},
): Promise<ResultadoR2<boolean>> {
  const r = await obtenerMetadatos(params, deps);
  if (r.ok) return { ok: true, valor: true };
  if (r.error.codigo === "no-existe") return { ok: true, valor: false };
  return r;
}

/**
 * Lo que un HEAD comparó, dicho sin exagerar.
 *
 * El objeto se devuelve así de explícito para que quien lo reciba no
 * pueda confundir "los metadatos coinciden" con "el archivo está
 * verificado". Son cosas distintas y la diferencia importa.
 */
export type MetadatosComparados = {
  metadatos: MetadatosR2;
  /** Lo que SÍ se comprobó contra R2. */
  comprobado: readonly ["existe", "bytes", "content-type-declarado"];
  /** Lo que NO se comprobó, y hay que dejar de suponer que sí. */
  sinComprobar: readonly ["contenido-real", "magic-bytes", "checksum-sha256"];
};

const COMPROBADO = ["existe", "bytes", "content-type-declarado"] as const;
const SIN_COMPROBAR = ["contenido-real", "magic-bytes", "checksum-sha256"] as const;

/**
 * Compara los METADATOS declarados de un objeto: que exista, que pese lo
 * que se dijo y que su `Content-Type` sea el que se declaró.
 *
 * ── POR QUÉ NO SE LLAMA `verificarOriginal` ──────────────────────────
 *
 * Se llamaba así y el nombre prometía de más. Un HEAD devuelve los
 * metadatos que se ESCRIBIERON al subir: el `Content-Type` que sale de
 * acá es exactamente el que se firmó en la URL de carga, o sea el mismo
 * dato que se pretendía verificar. Quien pida una URL prefirmada
 * declarando `image/jpeg` puede subir un ejecutable y este HEAD va a
 * decir que todo está bien.
 *
 * Con el nombre viejo, el bloque siguiente iba a llamar a esto y a
 * escribir `r2_verificado_en` creyendo que había verificado el archivo.
 * El nombre nuevo, y el `sinComprobar` que viaja en la respuesta, hacen
 * que esa confusión no se pueda cometer en silencio.
 *
 * ⛔ BLOQUEO PARA EL BLOQUE 3: `/api/media/confirmar` NO puede escribir
 *    `r2_verificado_en` basándose solo en esta función. Antes hay que
 *    leer los primeros bytes del objeto y comparar su firma real (magic
 *    bytes) contra el MIME declarado, y borrar el objeto si no coinciden.
 *    Esa comprobación NO existe todavía y es requisito obligatorio.
 */
export async function verificarMetadatosOriginal(
  params: { clave: string; bytesEsperados: number; mimeEsperado: string },
  deps: DependenciasR2 = {},
): Promise<ResultadoR2<MetadatosComparados>> {
  const r = await obtenerMetadatos({ clave: params.clave }, deps);
  if (!r.ok) return r;

  if (r.valor.bytes !== params.bytesEsperados) {
    return fallo(
      "tamano-distinto",
      `El objeto pesa ${r.valor.bytes} bytes y se esperaban ${params.bytesEsperados}.`,
    );
  }

  const declarado = (r.valor.mime ?? "").toLowerCase().split(";")[0].trim();
  const esperado = params.mimeEsperado.toLowerCase().split(";")[0].trim();
  if (declarado !== esperado) {
    return fallo("mime-distinto", `El objeto es "${declarado || "sin tipo"}" y se esperaba "${esperado}".`);
  }

  return {
    ok: true,
    valor: { metadatos: r.valor, comprobado: COMPROBADO, sinComprobar: SIN_COMPROBAR },
  };
}

// ------------------------------------------------------------
// 3. Firmar la DESCARGA
// ------------------------------------------------------------

export type DescargaFirmada = {
  url: string;
  expiraEnSegundos: number;
  nombreArchivo: string;
};

/**
 * Arma el `Content-Disposition` con las dos formas del nombre: `filename`
 * en ASCII para los programas viejos y `filename*` en UTF-8 para que
 * "Cumpleaños" no llegue como "Cumplea_os". Es el mismo criterio que ya
 * usa la ruta del ZIP del álbum.
 */
function contentDisposition(nombre: string): string {
  const limpio = sanitizarNombre(nombre);
  const ascii = limpio.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(limpio)}`;
}

/**
 * Una URL de descarga de vida corta. 15 minutos por defecto: alcanza
 * para bajar un original pesado y no tanto como para que el link
 * reenviado por WhatsApp siga sirviendo mañana.
 *
 * Esta URL NUNCA se guarda en la base. Se firma cuando alguien la pide,
 * ya autorizado, y se olvida.
 */
export async function firmarDescarga(
  params: { clave: string; nombreArchivo: string; expiraEnSegundos?: number },
  deps: DependenciasR2 = {},
): Promise<ResultadoR2<DescargaFirmada>> {
  const expira = params.expiraEnSegundos ?? EXPIRACION_DESCARGA_S;

  const errClave = revisarClaveR2(params.clave);
  if (errClave) return { ok: false, error: errClave };

  const errExp = revisarExpiracion(expira);
  if (errExp) return { ok: false, error: errExp };

  const listo = preparar(deps);
  if (!listo.ok) return listo;

  const nombre = sanitizarNombre(params.nombreArchivo);

  try {
    const url = await listo.valor.presignar(
      listo.valor.cliente,
      new GetObjectCommand({
        Bucket: listo.valor.config.bucket,
        Key: params.clave,
        // Fuerza la descarga en vez de abrir la foto en una pestaña.
        ResponseContentDisposition: contentDisposition(params.nombreArchivo),
      }),
      { expiresIn: expira },
    );
    return { ok: true, valor: { url, expiraEnSegundos: expira, nombreArchivo: nombre } };
  } catch (e) {
    return { ok: false, error: sanitizarError(e) };
  }
}

// ------------------------------------------------------------
// 4. Borrar
// ------------------------------------------------------------

/**
 * Borra un objeto. Se usa para deshacer una subida a medias
 * (rollback) y para la limpieza de huérfanos.
 *
 * NO lo llama el borrado lógico de `media_assets`: ahí solo se escribe
 * `deleted_at`, y el archivo sobrevive hasta que un worker con revisión
 * decida quitarlo.
 */
export async function borrarObjeto(
  params: { clave: string },
  deps: DependenciasR2 = {},
): Promise<ResultadoR2<{ clave: string }>> {
  const errClave = revisarClaveR2(params.clave);
  if (errClave) return { ok: false, error: errClave };

  const listo = preparar(deps);
  if (!listo.ok) return listo;

  try {
    await listo.valor.cliente.send(
      new DeleteObjectCommand({ Bucket: listo.valor.config.bucket, Key: params.clave }),
    );
    return { ok: true, valor: { clave: params.clave } };
  } catch (e) {
    return { ok: false, error: sanitizarError(e) };
  }
}
