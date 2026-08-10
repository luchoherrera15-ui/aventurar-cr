/**
 * BOOKEA MEDIA — Cloudflare Images: la copia que se MIRA.
 *
 * ⚠️  MÓDULO EXCLUSIVO DE SERVIDOR. Lee el API token y la llave de
 *     firma; un import desde el navegador las metería en el bundle.
 *
 *     Lo impone `import "server-only"`, la primera línea de abajo: si
 *     alguien lo importa desde un módulo de cliente, el BUILD FALLA.
 *     `exigirServidor()` se conserva como defensa adicional en tiempo de
 *     ejecución, no como sustituto.
 *
 *     La ÚNICA parte sin secretos es `urlDeVariante`, que recibe la base
 *     de entrega por parámetro y no toca `process.env`.
 *
 * ── UN ID NO ES UNA IMAGEN ───────────────────────────────────────────
 *
 * El Direct Creator Upload devuelve un `id` y una `uploadURL` ANTES de
 * que llegue un solo byte: la imagen queda como BORRADOR. Ese id no
 * prueba nada, y por eso `media_assets` tiene una columna aparte
 * (`cf_verificado_en`) que solo se escribe después de preguntarle a
 * Cloudflare si la imagen dejó de ser borrador.
 */

// La barrera. Va primero, antes que cualquier otro import.
import "server-only";

import { createHmac } from "node:crypto";
import { DEFINICION_VARIANTE, esVariante, type Variante, type Visibilidad } from "./tipos";

// ------------------------------------------------------------
// Resultados y errores
// ------------------------------------------------------------

export type CodigoErrorCF =
  | "solo-servidor"
  | "config-incompleta"
  | "variante-invalida"
  | "id-invalido"
  | "custom-id-con-firma"
  | "expiracion-invalida"
  | "respuesta-no-json"
  | "respuesta-invalida"
  | "http-fallido"
  | "timeout"
  | "fallo-proveedor";

export type ErrorCF = {
  codigo: CodigoErrorCF;
  /** Apto para un log. NUNCA trae el token ni la llave de firma. */
  mensaje: string;
};

export type ResultadoCF<T> = { ok: true; valor: T } | { ok: false; error: ErrorCF };

const fallo = (codigo: CodigoErrorCF, mensaje: string): { ok: false; error: ErrorCF } => ({
  ok: false,
  error: { codigo, mensaje },
});

function exigirServidor(): ErrorCF | null {
  if (typeof window !== "undefined") {
    return {
      codigo: "solo-servidor",
      mensaje: "cloudflare-images.ts es exclusivo de servidor y se usó desde el navegador.",
    };
  }
  return null;
}

// ------------------------------------------------------------
// Configuración — perezosa, nunca en el import
// ------------------------------------------------------------

export type ConfigCF = {
  accountId: string;
  accountHash: string;
  apiToken: string;
  deliveryUrl: string;
  signingKey: string;
};

const VARIABLES = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_IMAGES_ACCOUNT_HASH",
  "CLOUDFLARE_IMAGES_API_TOKEN",
  "CLOUDFLARE_IMAGES_DELIVERY_URL",
  "CLOUDFLARE_IMAGES_SIGNING_KEY",
] as const;

/**
 * Igual que en r2.ts: se lee en cada llamada y no al importar, para que
 * `next build` y los tests funcionen sin credenciales. Un entorno
 * incompleto devuelve un error; no revienta al cargar el módulo.
 *
 * El mensaje nombra las variables que faltan y nunca imprime un valor.
 */
export function configuracionCF(entorno: NodeJS.ProcessEnv = process.env): ResultadoCF<ConfigCF> {
  const faltan = VARIABLES.filter((v) => !entorno[v]?.trim());
  if (faltan.length > 0) {
    return fallo("config-incompleta", `Faltan variables de Cloudflare Images: ${faltan.join(", ")}.`);
  }
  return {
    ok: true,
    valor: {
      accountId: entorno.CLOUDFLARE_ACCOUNT_ID!.trim(),
      accountHash: entorno.CLOUDFLARE_IMAGES_ACCOUNT_HASH!.trim(),
      apiToken: entorno.CLOUDFLARE_IMAGES_API_TOKEN!.trim(),
      deliveryUrl: entorno.CLOUDFLARE_IMAGES_DELIVERY_URL!.trim().replace(/\/+$/, ""),
      signingKey: entorno.CLOUDFLARE_IMAGES_SIGNING_KEY!.trim(),
    },
  };
}

export function cloudflareConfigurado(entorno: NodeJS.ProcessEnv = process.env): boolean {
  return configuracionCF(entorno).ok;
}

// ------------------------------------------------------------
// Dependencias inyectables
// ------------------------------------------------------------

export type DependenciasCF = {
  /** En pruebas se pasa un doble; nunca se hace una petición real. */
  fetch?: typeof fetch;
  entorno?: NodeJS.ProcessEnv;
  /** Milisegundos antes de cortar la petición. */
  timeoutMs?: number;
};

const TIMEOUT_POR_DEFECTO_MS = 10_000;

const API = "https://api.cloudflare.com/client/v4";

/**
 * La forma REAL de una respuesta de la API v4. Todo llega como
 * `unknown` y se valida acá: confiar en la forma es lo que hace que un
 * cambio de la API o un error inesperado se manifieste como "undefined
 * no es una función" tres capas más arriba.
 */
type SobreCF = { success: boolean; errors?: unknown; result?: unknown };

function esSobre(v: unknown): v is SobreCF {
  return typeof v === "object" && v !== null && "success" in v && typeof v.success === "boolean";
}

/** Resume `errors` de Cloudflare sin volcar la respuesta entera. */
function resumirErrores(errors: unknown): string {
  if (!Array.isArray(errors) || errors.length === 0) return "sin detalle";
  return errors
    .slice(0, 3)
    .map((e) => {
      if (typeof e === "object" && e !== null) {
        const codigo = "code" in e ? String((e as { code: unknown }).code) : "?";
        const msg = "message" in e ? String((e as { message: unknown }).message) : "?";
        return `${codigo}: ${msg}`;
      }
      return "?";
    })
    .join(" · ");
}

/**
 * Una llamada a la API, con todo lo que puede salir mal contemplado:
 * timeout, HTTP no exitoso, cuerpo que no es JSON, sobre sin la forma
 * esperada y `success: false`.
 *
 * El token va en la cabecera y jamás en el mensaje de error.
 */
async function llamar(
  config: ConfigCF,
  ruta: string,
  init: RequestInit,
  deps: DependenciasCF,
): Promise<ResultadoCF<unknown>> {
  const hacerFetch = deps.fetch ?? fetch;
  const timeout = deps.timeoutMs ?? TIMEOUT_POR_DEFECTO_MS;

  let respuesta: Response;
  try {
    respuesta = await hacerFetch(`${API}/accounts/${config.accountId}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${config.apiToken}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const nombre = e instanceof Error ? e.name : "ErrorDesconocido";
    if (nombre === "TimeoutError" || nombre === "AbortError") {
      return fallo("timeout", `Cloudflare no respondió en ${timeout} ms.`);
    }
    return fallo("fallo-proveedor", `No se pudo hablar con Cloudflare (${nombre}).`);
  }

  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Un 502 de un proxy devuelve HTML, no JSON. Sin este caso, el
    // `catch` de arriba no lo ve y el `.json()` explota sin contexto.
    return fallo(
      "respuesta-no-json",
      `Cloudflare devolvió algo que no es JSON (HTTP ${respuesta.status}).`,
    );
  }

  if (!esSobre(cuerpo)) {
    return fallo("respuesta-invalida", "La respuesta de Cloudflare no tiene la forma esperada.");
  }
  if (!respuesta.ok) {
    return fallo(
      "http-fallido",
      `Cloudflare respondió HTTP ${respuesta.status}: ${resumirErrores(cuerpo.errors)}`,
    );
  }
  if (!cuerpo.success) {
    return fallo("fallo-proveedor", `Cloudflare rechazó la operación: ${resumirErrores(cuerpo.errors)}`);
  }
  return { ok: true, valor: cuerpo.result };
}

function preparar(deps: DependenciasCF): ResultadoCF<ConfigCF> {
  const guarda = exigirServidor();
  if (guarda) return fallo(guarda.codigo, guarda.mensaje);
  return configuracionCF(deps.entorno ?? process.env);
}

// ------------------------------------------------------------
// 1. Direct Creator Upload
// ------------------------------------------------------------

export type BorradorSubida = {
  /**
   * El id que Cloudflare reserva. Es un BORRADOR: todavía no hay imagen.
   * Se guarda en `media_assets.cf_image_id`, pero `cf_verificado_en`
   * sigue en null hasta que `confirmarImagen` diga que sí.
   */
  idBorrador: string;
  /** La URL de un solo uso a la que el navegador manda la copia visual. */
  uploadURL: string;
  requiereFirma: boolean;
};

export const EXPIRACION_SUBIDA_MIN_S = 120;
export const EXPIRACION_SUBIDA_MAX_S = 21_600; // 6 h, tope de Cloudflare.

/**
 * Pide un Direct Creator Upload para que el navegador suba la copia
 * visual directo a Cloudflare, sin pasar por nuestro servidor.
 *
 * ── POR QUÉ NO SE ACEPTA UN CUSTOM ID CON FIRMA ──────────────────────
 *
 * Cloudflare no permite `requireSignedURLs: true` sobre una imagen con
 * id propio: los custom IDs son adivinables por diseño y la firma
 * dejaría de significar algo. Como los álbumes son justamente el caso
 * que necesita firma, acá se rechaza esa combinación en vez de dejar que
 * Cloudflare la acepte a medias. Para todo lo firmado se usa el id que
 * devuelve Cloudflare, que es aleatorio.
 */
export async function solicitarSubidaDirecta(
  params: {
    /** `true` para álbumes (compartida) y privados; `false` para lo público. */
    requiereFirma: boolean;
    expiraEnSegundos?: number;
    /** Metadatos sueltos que Cloudflare guarda junto a la imagen. */
    metadata?: Record<string, string>;
    /** Id propio. SOLO válido si `requiereFirma` es false. */
    idPersonalizado?: string;
  },
  deps: DependenciasCF = {},
): Promise<ResultadoCF<BorradorSubida>> {
  if (params.idPersonalizado && params.requiereFirma) {
    return fallo(
      "custom-id-con-firma",
      "Cloudflare no admite requireSignedURLs sobre un id propio: usá el id que devuelve Cloudflare.",
    );
  }

  const expira = params.expiraEnSegundos ?? 30 * 60;
  if (
    !Number.isInteger(expira) ||
    expira < EXPIRACION_SUBIDA_MIN_S ||
    expira > EXPIRACION_SUBIDA_MAX_S
  ) {
    return fallo(
      "expiracion-invalida",
      `La expiración tiene que estar entre ${EXPIRACION_SUBIDA_MIN_S} y ${EXPIRACION_SUBIDA_MAX_S} segundos.`,
    );
  }

  const config = preparar(deps);
  if (!config.ok) return config;

  // La API v2 de direct_upload espera multipart, no JSON.
  const form = new FormData();
  form.set("requireSignedURLs", String(params.requiereFirma));
  form.set("expiry", new Date(Date.now() + expira * 1000).toISOString());
  if (params.metadata) form.set("metadata", JSON.stringify(params.metadata));
  if (params.idPersonalizado) form.set("id", params.idPersonalizado);

  const r = await llamar(config.valor, "/images/v2/direct_upload", { method: "POST", body: form }, deps);
  if (!r.ok) return r;

  const res = r.valor;
  if (
    typeof res !== "object" ||
    res === null ||
    !("id" in res) ||
    !("uploadURL" in res) ||
    typeof (res as { id: unknown }).id !== "string" ||
    typeof (res as { uploadURL: unknown }).uploadURL !== "string"
  ) {
    return fallo("respuesta-invalida", "Cloudflare no devolvió id y uploadURL.");
  }

  return {
    ok: true,
    valor: {
      idBorrador: (res as { id: string }).id,
      uploadURL: (res as { uploadURL: string }).uploadURL,
      requiereFirma: params.requiereFirma,
    },
  };
}

// ------------------------------------------------------------
// 1.b Importar desde una URL — el camino del piloto 3.1A
// ------------------------------------------------------------

export type ImagenImportada = {
  id: string;
  subidaEn: string | null;
  requiereFirma: boolean;
  variantes: string[];
};

/**
 * Le pide a Cloudflare que se descargue la imagen ÉL MISMO desde una
 * URL, en vez de que la suba el navegador.
 *
 * ── POR QUÉ ESTO Y NO DIRECT CREATOR UPLOAD ──────────────────────────
 *
 * El diseño anterior tenía al navegador subiendo DOS veces: el original
 * a R2 y la copia visual a Cloudflare. Eso permite que un cliente
 * malicioso mande la imagen A a R2 y la imagen B a Cloudflare — dos
 * archivos distintos bajo un mismo asset, con la verificación hecha
 * sobre el que nadie va a mirar. Y de paso duplica el ancho de banda
 * móvil, que es lo que este proyecto vino a bajar.
 *
 * Acá el navegador sube UNA vez, a R2. El servidor verifica metadatos y
 * firma real sobre ESE objeto, y recién entonces le pasa a Cloudflare
 * una URL firmada de vida corta para que importe exactamente el mismo
 * archivo. Es imposible que difieran.
 *
 * La URL firmada NUNCA vuelve al navegador: se usa solo entre nuestro
 * servidor y el de Cloudflare.
 *
 * Ventaja secundaria que conviene conocer: la respuesta de este
 * endpoint ya trae `uploaded`, así que **no hay estado borrador en este
 * flujo** — `cf_image_id` y `cf_verificado_en` se escriben juntos,
 * después de que Cloudflare confirme. `solicitarSubidaDirecta` se
 * conserva para cuando llegue el flujo de invitados de álbum, que sí lo
 * necesita.
 */
export async function importarDesdeUrl(
  params: {
    /** URL firmada de R2, de vida corta. No sale al navegador. */
    url: string;
    /** `true` para álbumes y privados; `false` para lo público. */
    requiereFirma: boolean;
    metadata?: Record<string, string>;
  },
  deps: DependenciasCF = {},
): Promise<ResultadoCF<ImagenImportada>> {
  if (!params.url || !/^https:\/\//i.test(params.url)) {
    return fallo("id-invalido", "La URL a importar no es válida.");
  }

  const config = preparar(deps);
  if (!config.ok) return config;

  // La API v1 de subida espera multipart. El campo `url` es lo que le
  // dice a Cloudflare "andá a buscarla vos".
  const form = new FormData();
  form.set("url", params.url);
  form.set("requireSignedURLs", String(params.requiereFirma));
  if (params.metadata) form.set("metadata", JSON.stringify(params.metadata));

  const r = await llamar(config.valor, "/images/v1", { method: "POST", body: form }, deps);
  if (!r.ok) return r;

  const res = r.valor;
  if (typeof res !== "object" || res === null || !("id" in res)) {
    return fallo("respuesta-invalida", "Cloudflare no devolvió la imagen importada.");
  }
  const obj = res as Record<string, unknown>;

  // Se exige `uploaded` válido: sin él no se puede afirmar que la
  // imagen esté servible, y este es el único camino que habilita
  // escribir `cf_verificado_en`.
  const subidaEn = fechaValida(obj.uploaded);
  if (subidaEn === null) {
    return fallo(
      "respuesta-invalida",
      "Cloudflare aceptó la importación pero no informó cuándo se subió.",
    );
  }

  return {
    ok: true,
    valor: {
      id: String(obj.id),
      subidaEn,
      requiereFirma: obj.requireSignedURLs === true,
      variantes: Array.isArray(obj.variants) ? obj.variants.map(String) : [],
    },
  };
}

// ------------------------------------------------------------
// 2. Detalle y confirmación
// ------------------------------------------------------------

export type DetalleImagen = {
  id: string;
  /**
   * `draft: true` EXPLÍCITO en la respuesta. Ojo: su ausencia NO
   * significa "confirmada" por sí sola — ver `confirmada`.
   */
  marcadoBorrador: boolean;
  /** El `uploaded` de Cloudflare, si vino y es una fecha parseable. */
  subidaEn: string | null;
  /**
   * La única señal en la que hay que confiar. Ver `esConfirmada()` para
   * la regla completa y por qué no alcanza con mirar `draft`.
   */
  confirmada: boolean;
  requiereFirma: boolean;
  variantes: string[];
};

/**
 * Una fecha `uploaded` que sirva: presente, string y parseable.
 *
 * Un `uploaded: ""` o `uploaded: null` no es una fecha, y tratarlo como
 * si lo fuera es exactamente el tipo de descuido que marca una imagen
 * como subida cuando no lo está.
 */
function fechaValida(v: unknown): string | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

/**
 * ── CÓMO SE SABE QUE UNA IMAGEN SE SUBIÓ DE VERDAD ───────────────────
 *
 * La versión anterior de este módulo preguntaba por `draft === false`, y
 * estaba mal. Lo que hace Cloudflare, según su documentación de Direct
 * Creator Upload, es:
 *
 *   · mientras espera el archivo → devuelve `draft: true`;
 *   · una vez subido            → BORRA el campo `draft` de la respuesta.
 *
 * O sea que `draft === false` casi nunca aparece, y exigirlo dejaba a
 * TODAS las imágenes subidas marcadas como borrador para siempre: la
 * copia visual nunca se habría confirmado y ningún asset habría llegado
 * a `listo`.
 *
 * La regla correcta, y conservadora en los cuatro casos:
 *
 *   draft: true                      → NO confirmada (está esperando).
 *   draft ausente + uploaded válido  → confirmada.
 *   draft ausente + sin uploaded     → NO confirmada: la respuesta está
 *                                      incompleta y no se adivina.
 *   draft: false + uploaded válido   → se tolera, pero no es la condición
 *                                      principal: manda el `uploaded`.
 *
 * En una línea: no está marcada como borrador Y tiene fecha de subida.
 */
export function esConfirmada(datos: { marcadoBorrador: boolean; subidaEn: string | null }): boolean {
  return !datos.marcadoBorrador && datos.subidaEn !== null;
}

export async function detalleImagen(
  params: { id: string },
  deps: DependenciasCF = {},
): Promise<ResultadoCF<DetalleImagen>> {
  if (!params.id || !/^[A-Za-z0-9._~-]+$/.test(params.id)) {
    return fallo("id-invalido", "El id de Cloudflare Images no es válido.");
  }

  const config = preparar(deps);
  if (!config.ok) return config;

  const r = await llamar(config.valor, `/images/v1/${params.id}`, { method: "GET" }, deps);
  if (!r.ok) return r;

  const res = r.valor;
  if (typeof res !== "object" || res === null || !("id" in res)) {
    return fallo("respuesta-invalida", "Cloudflare no devolvió el detalle de la imagen.");
  }
  const obj = res as Record<string, unknown>;

  // `draft: true` es lo único que se lee como "todavía esperando". La
  // AUSENCIA del campo no decide nada por sí sola: la decide `uploaded`.
  const marcadoBorrador = obj.draft === true;
  const subidaEn = fechaValida(obj.uploaded);

  return {
    ok: true,
    valor: {
      id: String(obj.id),
      marcadoBorrador,
      subidaEn,
      confirmada: esConfirmada({ marcadoBorrador, subidaEn }),
      requiereFirma: obj.requireSignedURLs === true,
      variantes: Array.isArray(obj.variants) ? obj.variants.map(String) : [],
    },
  };
}

/**
 * ¿La imagen se subió de verdad?
 *
 * Es la única función autorizada a habilitar la escritura de
 * `cf_verificado_en`. Un `false` acá con el id ya guardado y el original
 * arriba es exactamente el estado `parcial_r2`: el original subió, la
 * copia visual no.
 *
 * La regla está en `esConfirmada()` — leerla antes de tocar esto.
 */
export async function confirmarImagen(
  params: { id: string },
  deps: DependenciasCF = {},
): Promise<ResultadoCF<{ confirmada: boolean; detalle: DetalleImagen }>> {
  const r = await detalleImagen(params, deps);
  if (!r.ok) return r;
  return { ok: true, valor: { confirmada: r.valor.confirmada, detalle: r.valor } };
}

// ------------------------------------------------------------
// 3. Borrar (rollback y limpieza)
// ------------------------------------------------------------

export async function borrarImagen(
  params: { id: string },
  deps: DependenciasCF = {},
): Promise<ResultadoCF<{ id: string }>> {
  if (!params.id || !/^[A-Za-z0-9._~-]+$/.test(params.id)) {
    return fallo("id-invalido", "El id de Cloudflare Images no es válido.");
  }

  const config = preparar(deps);
  if (!config.ok) return config;

  const r = await llamar(config.valor, `/images/v1/${params.id}`, { method: "DELETE" }, deps);
  if (!r.ok) return r;
  return { ok: true, valor: { id: params.id } };
}

// ------------------------------------------------------------
// 4. URL de entrega
// ------------------------------------------------------------

/**
 * La URL pública de una variante.
 *
 * NO toca `process.env` y NO firma nada: recibe la base de entrega por
 * parámetro. Es la única pieza de este módulo que un día podría vivir
 * del lado del cliente sin arrastrar un secreto — el `accountHash` que
 * va en la URL es público por definición, aparece en cada `<img>`.
 */
export function urlDeVariante(params: {
  deliveryUrl: string;
  imageId: string;
  variante: Variante;
}): ResultadoCF<string> {
  if (!esVariante(params.variante)) {
    return fallo("variante-invalida", "Esa variante no existe en la cuenta.");
  }
  if (!params.imageId) return fallo("id-invalido", "Falta el id de la imagen.");
  const base = params.deliveryUrl.replace(/\/+$/, "");
  return { ok: true, valor: `${base}/${params.imageId}/${params.variante}` };
}

/** Las medidas de la variante, para poner width/height y no provocar CLS. */
export function medidasDeVariante(variante: Variante) {
  return DEFINICION_VARIANTE[variante];
}

// ------------------------------------------------------------
// 5. Firma de URL privada
// ------------------------------------------------------------

export const EXPIRACION_FIRMA_MIN_S = 30;
export const EXPIRACION_FIRMA_MAX_S = 3600;
export const EXPIRACION_FIRMA_POR_DEFECTO_S = 15 * 60;

/**
 * Firma una URL de entrega para una imagen con `requireSignedURLs`.
 *
 * El esquema es el de Cloudflare: se firma `pathname + "?" + query` con
 * HMAC-SHA256 y la llave de la cuenta, y el resultado va como `sig`
 * junto al `exp` en segundos Unix.
 *
 * `ahoraMs` se puede inyectar para que los tests no dependan del reloj.
 */
export function firmarUrl(
  params: {
    url: string;
    signingKey: string;
    expiraEnSegundos?: number;
    ahoraMs?: number;
  },
): ResultadoCF<string> {
  const guarda = exigirServidor();
  if (guarda) return fallo(guarda.codigo, guarda.mensaje);

  const expira = params.expiraEnSegundos ?? EXPIRACION_FIRMA_POR_DEFECTO_S;
  if (
    !Number.isInteger(expira) ||
    expira < EXPIRACION_FIRMA_MIN_S ||
    expira > EXPIRACION_FIRMA_MAX_S
  ) {
    return fallo(
      "expiracion-invalida",
      `La expiración tiene que estar entre ${EXPIRACION_FIRMA_MIN_S} y ${EXPIRACION_FIRMA_MAX_S} segundos.`,
    );
  }
  if (!params.signingKey) {
    return fallo("config-incompleta", "Falta la llave de firma de Cloudflare Images.");
  }

  let url: URL;
  try {
    url = new URL(params.url);
  } catch {
    return fallo("id-invalido", "La URL a firmar no es válida.");
  }

  const ahora = params.ahoraMs ?? Date.now();
  const exp = Math.floor(ahora / 1000) + expira;
  url.searchParams.set("exp", String(exp));

  // Se firma la ruta con su query, sin el host: es lo que espera el
  // borde de Cloudflare al validar.
  const aFirmar = `${url.pathname}?${url.searchParams.toString()}`;
  const sig = createHmac("sha256", params.signingKey).update(aFirmar).digest("hex");
  url.searchParams.set("sig", sig);

  return { ok: true, valor: url.toString() };
}

/**
 * La URL final según la visibilidad del asset.
 *
 *   publica              → entrega directa, sin token.
 *   compartida, privada  → SIEMPRE firmada.
 *
 * Que sea una sola función y no un `if` en cada pantalla es el punto:
 * olvidarse de firmar deja de ser posible.
 */
export function urlSegunVisibilidad(
  params: {
    visibilidad: Visibilidad;
    deliveryUrl: string;
    imageId: string;
    variante: Variante;
    signingKey?: string;
    expiraEnSegundos?: number;
    ahoraMs?: number;
  },
): ResultadoCF<string> {
  const base = urlDeVariante(params);
  if (!base.ok) return base;

  if (params.visibilidad === "publica") return base;

  if (!params.signingKey) {
    return fallo(
      "config-incompleta",
      "Esta media exige entrega firmada y no se pasó la llave de firma.",
    );
  }
  return firmarUrl({
    url: base.valor,
    signingKey: params.signingKey,
    expiraEnSegundos: params.expiraEnSegundos,
    ahoraMs: params.ahoraMs,
  });
}
