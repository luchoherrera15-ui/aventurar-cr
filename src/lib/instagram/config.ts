/**
 * LA CONFIGURACIÓN DE META — solo lectura de variables, nada de red.
 *
 * Todo lo que habla con Meta pasa por acá para no repetir el nombre de
 * una variable en cinco archivos. Sin las obligatorias, `configMeta()`
 * devuelve null y cada pantalla dice «Instagram no está configurado»
 * en vez de fallar a medio camino con un token vacío.
 *
 * Nombres (ver .env.example):
 *   META_APP_ID                   el ID de la app de Meta (App settings → Basic)
 *   META_APP_SECRET               su secreto — SOLO servidor. Firma el `state`
 *                                 de OAuth y verifica la firma del webhook
 *   META_IG_APP_ID                el «Instagram app ID» (Instagram → API setup
 *                                 with Instagram login → Business login settings).
 *                                 Es OTRO número que el App ID de Meta, y es el
 *                                 `client_id` del OAuth y del canje del token
 *   META_IG_APP_SECRET            el «Instagram app secret» de esa misma pantalla:
 *                                 `client_secret` del canje y del token largo
 *   META_REDIRECT_URI             la URL exacta registrada en la app
 *   META_API_VERSION              opcional; hoy v25.0 (lo que muestra la doc)
 *   META_WEBHOOK_VERIFY_TOKEN     el texto que Meta manda al verificar el webhook
 *   META_TOKEN_ENCRYPTION_KEY     32 bytes (hex de 64 o base64) para cifrar
 *                                 los tokens de usuario en la base
 */

export const VERSION_META_DEFAULT = "v25.0";

/**
 * Los permisos vigentes de «Instagram API with Instagram Login» (los
 * `business_basic`… viejos quedaron deprecados el 27 ene 2025):
 *   instagram_business_basic            perfil y publicaciones;
 *   instagram_business_manage_comments  leer comentarios, responderlos
 *                                       en público y en privado;
 *   instagram_business_manage_messages  mandar el DM.
 * Solo estos tres: es lo estrictamente necesario.
 */
export const SCOPES_IG = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

export type ConfigMeta = {
  /** La app de Meta: firma el state y el webhook. */
  appId: string;
  appSecret: string;
  /** La app de Instagram (dentro de la de Meta): el OAuth y los tokens. */
  igAppId: string;
  igAppSecret: string;
  redirectUri: string;
  version: string;
  verifyToken: string;
  /** La clave de cifrado tal como viene del entorno (hex o base64). */
  claveTokens: string;
};

function limpio(v: string | undefined): string {
  return (v ?? "").trim();
}

/** null si falta alguna de las obligatorias. */
export function configMeta(env: NodeJS.ProcessEnv = process.env): ConfigMeta | null {
  const appId = limpio(env.META_APP_ID);
  const appSecret = limpio(env.META_APP_SECRET);
  const igAppId = limpio(env.META_IG_APP_ID);
  const igAppSecret = limpio(env.META_IG_APP_SECRET);
  const redirectUri = limpio(env.META_REDIRECT_URI);
  const verifyToken = limpio(env.META_WEBHOOK_VERIFY_TOKEN);
  const claveTokens = limpio(env.META_TOKEN_ENCRYPTION_KEY);
  if (!appId || !appSecret || !igAppId || !igAppSecret || !redirectUri || !verifyToken || !claveTokens) return null;
  const version = limpio(env.META_API_VERSION) || VERSION_META_DEFAULT;
  if (!/^v\d+\.\d+$/.test(version)) return null;
  return { appId, appSecret, igAppId, igAppSecret, redirectUri, version, verifyToken, claveTokens };
}

/**
 * Lo que el WEBHOOK necesita, y nada más: el token de verificación (GET)
 * y el secreto de la app de Meta (la firma del POST). Va aparte de
 * `configMeta` a propósito: Meta verifica la URL del webhook ANTES de
 * que exista el OAuth, y no tiene por qué esperar a que estén cargadas
 * las variables de Instagram.
 */
export function configWebhook(env: NodeJS.ProcessEnv = process.env): { verifyToken: string; appSecret: string } | null {
  const verifyToken = limpio(env.META_WEBHOOK_VERIFY_TOKEN);
  const appSecret = limpio(env.META_APP_SECRET);
  if (!verifyToken || !appSecret) return null;
  return { verifyToken, appSecret };
}

/** Qué falta, para el mensaje del panel y de los logs (sin valores). */
export function faltantesMeta(env: NodeJS.ProcessEnv = process.env): string[] {
  const nombres = ["META_APP_ID", "META_APP_SECRET", "META_IG_APP_ID", "META_IG_APP_SECRET", "META_REDIRECT_URI", "META_WEBHOOK_VERIFY_TOKEN", "META_TOKEN_ENCRYPTION_KEY"];
  return nombres.filter((n) => !limpio(env[n]));
}

export const HOST_GRAPH = "https://graph.instagram.com";
export const HOST_OAUTH_AUTORIZAR = "https://www.instagram.com/oauth/authorize";
export const HOST_OAUTH_TOKEN = "https://api.instagram.com/oauth/access_token";
