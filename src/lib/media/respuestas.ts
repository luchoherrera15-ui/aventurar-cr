/**
 * BOOKEA MEDIA — cómo responden `/api/media/*`.
 *
 * ── UNA SOLA FORMA DE SALIR ──────────────────────────────────────────
 *
 * Todos los errores salen por `fallo()`, y `fallo()` recibe un CÓDIGO de
 * una lista cerrada, no un texto libre. El mensaje que ve la persona lo
 * decide esta tabla, no quien llama.
 *
 * Eso no es prolijidad: es lo que impide que un detalle interno se
 * escape en un mensaje. La tentación de escribir
 * `fallo(500, e.message)` aparece en cada `catch`, y ahí es donde
 * terminan filtrándose el nombre del bucket, la clave de R2, la
 * respuesta cruda de Cloudflare o un fragmento de una URL firmada
 * —que lleva la credencial en la query—. Acá eso no se puede escribir:
 * no hay parámetro donde ponerlo.
 *
 * El diagnóstico viaja aparte, en `registro`, que va al log del
 * servidor y NUNCA al cuerpo de la respuesta.
 *
 * Módulo neutral: sin red, sin secretos, sin `server-only`.
 */

import { cabecerasCors } from "./autenticacion";

// ------------------------------------------------------------
// El catálogo de errores
// ------------------------------------------------------------

/**
 * Los códigos que puede devolver la API de media, con su HTTP y su
 * mensaje. En español, sin jerga y sin decir nada que le sirva a quien
 * está probando: "no se pudo verificar el origen" no cuenta cuáles son
 * los orígenes válidos, y "no encontramos eso" no distingue entre "no
 * existe" y "no es tuyo".
 */
export const ERRORES = {
  // ── 400 ──
  "cuerpo-invalido": { http: 400, mensaje: "Datos inválidos." },
  "campos-invalidos": { http: 400, mensaje: "Datos inválidos." },
  "mime-desconocido": { http: 400, mensaje: "Ese tipo de archivo no se puede subir." },

  // ── 401 ──
  "sin-sesion": { http: 401, mensaje: "Entrá con tu cuenta." },
  "sin-capacidad": { http: 401, mensaje: "Volvé a abrir el enlace para subir tu archivo." },

  // ── 403 ──
  "origen-invalido": { http: 403, mensaje: "No se pudo verificar el origen de la petición." },
  "sin-permiso": { http: 403, mensaje: "No encontramos eso o no es tuyo." },
  "antiabuso": { http: 403, mensaje: "No se pudo verificar que seas una persona. Probá de nuevo." },

  // ── 404 ──
  "no-existe": { http: 404, mensaje: "No encontramos eso." },

  // ── 409 ──
  "conflicto-solicitud": {
    http: 409,
    mensaje: "Esa subida ya se pidió con otros datos. Volvé a empezar.",
  },
  "cupo-agotado": { http: 409, mensaje: "Ya no queda lugar para más archivos acá." },
  "objeto-existente": { http: 409, mensaje: "Esa subida ya se usó. Pedí una nueva." },
  "en-curso": { http: 409, mensaje: "Ya se está procesando ese archivo. Esperá un momento." },
  "subida-incompleta": { http: 409, mensaje: "El archivo todavía no llegó completo." },
  "estado-no-confirmable": { http: 409, mensaje: "Ese archivo no se puede confirmar así." },

  // ── 410 ──
  "capacidad-vencida": { http: 410, mensaje: "Se venció el permiso para subir. Recargá la página." },
  "reserva-vencida": { http: 410, mensaje: "Se venció la subida. Volvé a intentar." },

  // ── 413 ──
  "cuerpo-muy-grande": { http: 413, mensaje: "La petición es demasiado grande." },
  "archivo-muy-grande": { http: 413, mensaje: "El archivo pesa más de lo permitido." },

  // ── 422 ──
  "fuera-de-alcance": { http: 422, mensaje: "Todavía no se pueden subir archivos así por acá." },
  "firma-incompatible": {
    http: 422,
    mensaje: "El archivo no es del tipo que decía ser. No se guardó.",
  },
  "metadatos-distintos": {
    http: 422,
    mensaje: "El archivo que llegó no coincide con el que se anunció. No se guardó.",
  },

  // ── 429 ──
  "demasiadas-peticiones": { http: 429, mensaje: "Demasiados intentos. Esperá un momento." },
  "demasiadas-reservas": { http: 429, mensaje: "Tenés muchas subidas en curso. Esperá un momento." },

  // ── 5xx ──
  "fallo-interno": { http: 500, mensaje: "No se pudo completar la operación." },
  "fallo-almacenamiento": { http: 502, mensaje: "El almacenamiento no respondió. Probá de nuevo." },
  "fallo-imagenes": { http: 502, mensaje: "El procesador de imágenes no respondió. Probá de nuevo." },
  "sin-configuracion": { http: 503, mensaje: "No se puede subir ahora mismo." },
  "metodo-no-permitido": { http: 405, mensaje: "Método no permitido." },
} as const;

export type CodigoError = keyof typeof ERRORES;

export type EstadoHttp = (typeof ERRORES)[CodigoError]["http"];

// ------------------------------------------------------------
// Construcción de respuestas
// ------------------------------------------------------------

/**
 * Cabeceras comunes.
 *
 * `no-store` en todas: una respuesta de este API puede traer una URL
 * firmada de escritura, y ni el navegador ni una caché intermedia
 * tienen por qué guardarla. `X-Content-Type-Options` porque el cuerpo es
 * JSON y no hay ninguna razón para que nadie lo interprete de otra
 * forma.
 */
function cabecerasBase(origen: string | null, entorno?: NodeJS.ProcessEnv): Headers {
  const h = new Headers(cabecerasCors(origen, entorno));
  h.set("Content-Type", "application/json; charset=utf-8");
  h.set("Cache-Control", "no-store");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "no-referrer");
  return h;
}

export type ContextoRespuesta = {
  origen: string | null;
  entorno?: NodeJS.ProcessEnv;
};

/**
 * Una respuesta de error.
 *
 * `registro` es lo ÚNICO que puede traer detalle técnico, y no se
 * serializa: se devuelve aparte para que quien llama lo mande al log.
 * Si algún día alguien lo pega en el cuerpo, tiene que escribirlo a
 * mano y se ve en el diff.
 */
export function fallo(
  codigo: CodigoError,
  ctx: ContextoRespuesta,
  registro?: string,
): { respuesta: Response; registro: string | null } {
  const { http, mensaje } = ERRORES[codigo];
  const cuerpo = JSON.stringify({ ok: false, codigo, mensaje });
  return {
    respuesta: new Response(cuerpo, { status: http, headers: cabecerasBase(ctx.origen, ctx.entorno) }),
    registro: registro ?? null,
  };
}

/** El atajo cuando no hay nada que registrar. */
export function error(codigo: CodigoError, ctx: ContextoRespuesta): Response {
  return fallo(codigo, ctx).respuesta;
}

export function exito(
  datos: Record<string, unknown>,
  ctx: ContextoRespuesta,
  http: 200 | 201 = 200,
): Response {
  return new Response(JSON.stringify({ ok: true, ...datos }), {
    status: http,
    headers: cabecerasBase(ctx.origen, ctx.entorno),
  });
}

/**
 * El preflight.
 *
 * Un origen que no está en la lista recibe 403 y NO recibe las
 * cabeceras que lo autorizarían — `cabecerasCors` ya se encarga de no
 * ponerlas. Responder 204 a cualquiera sería decirle al navegador que
 * siga adelante con una petición que después vamos a rechazar igual.
 */
export function preflight(ctx: ContextoRespuesta): Response {
  const h = new Headers(cabecerasCors(ctx.origen, ctx.entorno));
  h.set("Access-Control-Max-Age", "600");
  const permitido = h.has("Access-Control-Allow-Origin");
  return new Response(null, { status: permitido ? 204 : 403, headers: h });
}

/**
 * GET, PUT, DELETE… sobre un endpoint que solo hace POST.
 *
 * Se declara explícitamente en cada ruta en vez de dejar que el
 * framework improvise: así el 405 llega con el mismo cuerpo JSON que el
 * resto de los errores, con `Allow`, y —sobre todo— se puede probar.
 */
export function metodoNoPermitido(ctx: ContextoRespuesta): Response {
  const { respuesta } = fallo("metodo-no-permitido", ctx);
  const h = new Headers(respuesta.headers);
  h.set("Allow", "POST, OPTIONS");
  return new Response(respuesta.body, { status: 405, headers: h });
}

// ------------------------------------------------------------
// Traducción de errores de PostgreSQL
// ------------------------------------------------------------

/**
 * Los `errcode` que levantan a propósito las funciones de las
 * migraciones 0112, 0113 y 0114.
 *
 * OJO con el 42501 ("no se administra esa entidad"): se traduce a 403 y
 * NO a 404, aunque cubra también el caso de una entidad inexistente.
 * `media_puede_administrar` devuelve false por las dos razones sin
 * distinguirlas, y esa indistinción es deseable: un 404 para "no existe"
 * y un 403 para "no es tuyo" le confirmaría a quien prueba uuids cuáles
 * son reales. El mensaje —"No encontramos eso o no es tuyo"— dice
 * exactamente eso y nada más.
 */
export function codigoDePostgres(codigo: string | null | undefined): CodigoError {
  switch (codigo) {
    case "42501":
      return "sin-permiso";
    case "0A000":
      return "fuera-de-alcance";
    case "22023":
      return "campos-invalidos";
    // Violación de CHECK o de FK desde el trigger de la 0110: la entidad
    // que se pidió no existe.
    case "23514":
    case "23503":
      return "no-existe";
    // Choque con el índice único de idempotencia. No debería llegar
    // —los advisory locks lo previenen— pero si llega es un conflicto.
    case "23505":
      return "conflicto-solicitud";
    default:
      return "fallo-interno";
  }
}
