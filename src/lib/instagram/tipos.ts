/**
 * ════════════════════════════════════════════════════════════════════
 *  INSTAGRAM AUTO REPLY (Linksy) — LOS TIPOS Y LAS LISTAS CERRADAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (7 sep 2026): «como Linktree: alguien comenta una
 * publicación con una palabra clave y recibe un DM automático, con la
 * opción de responder también en público».
 *
 * Todo con la API oficial de Meta —Instagram API with Instagram Login—
 * y nada más: sin scraping, sin navegador automatizado, sin contraseñas
 * de Instagram. Lo que Meta no permite, no se hace (ver
 * docs/instagram-auto-reply.md, «Limitaciones»).
 *
 * Las listas cerradas ESPEJAN los CHECK de la migración 0238: si acá se
 * agrega un valor, va también en la base — y al revés.
 */

export const TIPOS_CUENTA_IG = ["BUSINESS", "MEDIA_CREATOR"] as const;
export type TipoCuentaIg = (typeof TIPOS_CUENTA_IG)[number];

/**
 * El estado de la conexión, visto desde el panel.
 *   conectada    todo en orden;
 *   reconectar   el token venció o Meta rechazó los permisos: hay que
 *                volver a pasar por «Conectar Instagram»;
 *   desconectada la persona la desconectó desde el panel.
 */
export const ESTADOS_CUENTA_IG = ["conectada", "reconectar", "desconectada"] as const;
export type EstadoCuentaIg = (typeof ESTADOS_CUENTA_IG)[number];

export const DISPARADORES = ["palabra", "cualquier_comentario"] as const;
export type Disparador = (typeof DISPARADORES)[number];

/**
 * Cómo se compara el comentario con cada palabra clave:
 *   palabra   la palabra entera, con límites de palabra («precio» sí,
 *             «precioso» no) — el default, el que evita falsos positivos;
 *   exacta    el comentario ES la palabra («PRECIO» sí, «¿precio?» no);
 *   contiene  la palabra en cualquier parte («precioso» también).
 */
export const MODOS_COINCIDENCIA = ["palabra", "exacta", "contiene"] as const;
export type ModoCoincidencia = (typeof MODOS_COINCIDENCIA)[number];

export const RESULTADOS_EVENTO = ["pendiente", "sin_coincidencia", "enviado", "omitido", "error", "limite"] as const;
export type ResultadoEvento = (typeof RESULTADOS_EVENTO)[number];

/**
 * Los errores de Meta, traducidos a algo que el panel puede explicar
 * («Instagram necesita reconectar esta cuenta») sin exponer tokens ni
 * detalles internos.
 */
export const CODIGOS_ERROR_META = [
  "token_vencido",
  "permisos",
  "cuenta_incompatible",
  "rate_limit",
  "no_procesable",
  "dm_rechazado",
  "webhook_invalido",
  "api_no_disponible",
  "desconocido",
] as const;
export type CodigoErrorMeta = (typeof CODIGOS_ERROR_META)[number];

export type ErrorMeta = {
  codigo: CodigoErrorMeta;
  /** Para el panel y la bitácora. NUNCA lleva tokens ni el cuerpo crudo. */
  mensaje: string;
  /** El `code` numérico de Graph, si vino. */
  metaCode?: number;
  metaSubcode?: number;
  /** true = vale la pena reintentar (rate limit, caída temporal). */
  transitorio: boolean;
};

/** Lo que el panel le dice a la persona por cada código. */
export const EXPLICACION_ERROR: Record<CodigoErrorMeta, string> = {
  token_vencido: "Instagram necesita reconectar esta cuenta.",
  permisos: "Instagram no dio los permisos necesarios. Reconectá la cuenta y aceptá todos los permisos.",
  cuenta_incompatible: "La cuenta tiene que ser profesional (Empresa o Creador) para usar respuestas automáticas.",
  rate_limit: "Instagram limitó los envíos por un rato. Se reintenta solo.",
  no_procesable: "Instagram no pudo procesar ese comentario.",
  dm_rechazado: "Instagram rechazó el mensaje privado (solo se permite uno por comentario, dentro de 7 días).",
  webhook_invalido: "Llegó un aviso que no pudimos verificar.",
  api_no_disponible: "Instagram no respondió. Se reintenta solo.",
  desconocido: "Instagram devolvió un error que no reconocemos.",
};

/** Topes — espejo de los CHECK de la 0238. */
export const TOPES_IG = {
  nombre: 80,
  palabra: 40,
  palabras: 20,
  /** Meta: el texto del DM va en UTF-8 y pesa 1000 bytes como máximo;
   *  se deja lugar para el enlace y los dos saltos de línea. */
  mensajePrivado: 800,
  mensajePublico: 300,
  enlace: 500,
  textoComentario: 500,
  notaError: 300,
  mediaResumen: 140,
} as const;

// ── Las filas, ya tipadas ──────────────────────────────────────────

/** La cuenta conectada, SIN el token: es lo único que sale al panel. */
export type CuentaIg = {
  id: string;
  negocio_id: string;
  ig_user_id: string;
  username: string;
  nombre: string | null;
  tipo_cuenta: TipoCuentaIg;
  foto_url: string | null;
  token_vence_en: string;
  token_refrescado_en: string | null;
  permisos: string[];
  suscrito_webhook: boolean;
  activa: boolean;
  estado: EstadoCuentaIg;
  estado_nota: string | null;
  conectada_en: string;
};

export type AutomatizacionIg = {
  id: string;
  negocio_id: string;
  cuenta_id: string;
  nombre: string;
  media_id: string;
  media_permalink: string | null;
  media_resumen: string | null;
  media_miniatura_url: string | null;
  disparador: Disparador;
  modo_coincidencia: ModoCoincidencia;
  mensaje_privado: string;
  enlace: string | null;
  respuesta_publica: boolean;
  mensaje_publico: string | null;
  activa: boolean;
  creada_en: string;
  actualizada_en: string;
  /** Las palabras clave, tal como las escribió la persona. */
  palabras: string[];
};

export type EventoIg = {
  id: string;
  negocio_id: string;
  cuenta_id: string;
  automatizacion_id: string | null;
  comentario_id: string;
  ig_usuario_id: string | null;
  ig_usuario_username: string | null;
  media_id: string | null;
  texto_comentario: string | null;
  palabra_coincidente: string | null;
  resultado: ResultadoEvento;
  dm_enviado: boolean;
  dm_mensaje_id: string | null;
  publica_enviada: boolean;
  publica_comentario_id: string | null;
  error_codigo: CodigoErrorMeta | null;
  error_mensaje: string | null;
  intentos: number;
  procesado_en: string | null;
  creado_en: string;
};

/** Una publicación de Instagram, lo justo para elegirla en el panel. */
export type PublicacionIg = {
  id: string;
  caption: string | null;
  media_type: string | null;
  media_product_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
};

/** Las métricas de una automatización, para la lista y el detalle. */
export type ResumenAutomatizacion = {
  comentarios: number;
  coincidencias: number;
  dms: number;
  publicas: number;
  errores: number;
  /** dms / coincidencias, en porcentaje entero. null = sin coincidencias aún. */
  tasaExito: number | null;
  ultimaActividad: string | null;
};

export function tipoCuentaDe(v: unknown): TipoCuentaIg | null {
  const s = typeof v === "string" ? v.toUpperCase() : "";
  return (TIPOS_CUENTA_IG as readonly string[]).includes(s) ? (s as TipoCuentaIg) : null;
}
export function disparadorDe(v: unknown): Disparador {
  return (DISPARADORES as readonly unknown[]).includes(v) ? (v as Disparador) : "palabra";
}
export function modoCoincidenciaDe(v: unknown): ModoCoincidencia {
  return (MODOS_COINCIDENCIA as readonly unknown[]).includes(v) ? (v as ModoCoincidencia) : "palabra";
}
export function codigoErrorDe(v: unknown): CodigoErrorMeta | null {
  return (CODIGOS_ERROR_META as readonly unknown[]).includes(v) ? (v as CodigoErrorMeta) : null;
}
