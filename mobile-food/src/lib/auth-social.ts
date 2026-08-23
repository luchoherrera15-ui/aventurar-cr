import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "./supabase";

/**
 * Login social — espejo de mobile/src/lib/auth-social.ts (Bookea
 * normal), adaptado a este proyecto aparte. Dos flujos DISTINTOS:
 *
 *   · Google y Facebook son OAuth de navegador: se le pide a Supabase
 *     la URL del proveedor SIN redirigir (skipBrowserRedirect), se
 *     abre en la hoja de autenticación del sistema
 *     (openAuthSessionAsync — Safari/Chrome Custom Tabs, nunca un
 *     WebView propio, porque así lo exigen las tiendas), y el
 *     proveedor vuelve al deep link del app con un código (PKCE) que
 *     se canjea por la sesión.
 *
 *   · Apple usa su SDK nativo (`expo-apple-authentication`) — las
 *     guías de revisión de Apple lo EXIGEN en vez de un navegador.
 *     `signInAsync` abre la hoja nativa y devuelve un `identityToken`
 *     ya firmado, que Supabase valida con `signInWithIdToken` sin
 *     canjear ningún código.
 *
 * PENDIENTE DE CONFIGURACIÓN (una vez, fuera de este archivo):
 *   · Supabase → Authentication → Providers: habilitar Google,
 *     Facebook y Apple (Apple con el Bundle ID de esta app,
 *     lat.bookea.food, como client id del flujo nativo).
 *   · Authentication → URL Configuration → Redirect URLs: agregar el
 *     redirect que este app IMPRIME al arrancar (ver REDIRECT_URL
 *     abajo) — NO uno supuesto.
 *   · Apple Developer → el identificador lat.bookea.food necesita la
 *     capacidad "Sign In with Apple" habilitada.
 * Hasta que cada uno esté listo, su bandera lo deja oculto: mejor
 * ausente que roto.
 */

const REDIRECT_URL = Linking.createURL("auth");

if (__DEV__) {
  console.log("[food.bookea] redirect del login social:", REDIRECT_URL);
}

export type ProveedorSocial = "google" | "facebook";

export const NOMBRE_PROVEEDOR: Record<ProveedorSocial, string> = {
  google: "Google",
  facebook: "Facebook",
};

export const GOOGLE_HABILITADO = process.env.EXPO_PUBLIC_AUTH_GOOGLE === "1";
export const FACEBOOK_HABILITADO = process.env.EXPO_PUBLIC_AUTH_FACEBOOK === "1";
// Apple no tiene SDK nativo en Android: la Guideline 4.8 que lo exige
// es cosa de iOS, así que ahí seguimos con Google/Facebook nomás.
export const APPLE_HABILITADO = Platform.OS === "ios" && process.env.EXPO_PUBLIC_AUTH_APPLE === "1";
export const HAY_LOGIN_SOCIAL = GOOGLE_HABILITADO || FACEBOOK_HABILITADO || APPLE_HABILITADO;

export type ResultadoSocial =
  | { ok: true }
  /** La persona cerró la hoja del navegador (o la nativa de Apple) —
   *  no es un error que mostrar. */
  | { ok: false; cancelado: true }
  | { ok: false; cancelado?: false; error: string };

function parametrosDeRetorno(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const [sinFragmento, fragmento] = url.split("#");
  const query = sinFragmento.split("?")[1];
  if (query) {
    for (const [k, v] of new URLSearchParams(query)) params.set(k, v);
  }
  if (fragmento) {
    for (const [k, v] of new URLSearchParams(fragmento)) params.set(k, v);
  }
  return params;
}

export async function entrarConProveedor(proveedor: ProveedorSocial): Promise<ResultadoSocial> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: proveedor,
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  });

  if (error || !data?.url) {
    return { ok: false, error: `No se pudo conectar con ${NOMBRE_PROVEEDOR[proveedor]}.` };
  }

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);

  if (resultado.type !== "success") {
    // En Android openAuthSessionAsync no es nativo: un login perfecto
    // puede reportarse como cancelado si el app vuelve a primer plano
    // antes de que llegue la URL. Antes de rendirse, se le pregunta a
    // Supabase si la sesión ya quedó.
    const { data: sesion } = await supabase.auth.getSession();
    if (sesion.session) return { ok: true };
    return { ok: false, cancelado: true };
  }

  const params = parametrosDeRetorno(resultado.url);

  const errorProveedor = params.get("error_description") ?? params.get("error");
  if (errorProveedor) return { ok: false, error: errorProveedor };

  const code = params.get("code");
  if (code) {
    const { error: errCanje } = await supabase.auth.exchangeCodeForSession(code);
    if (errCanje) return { ok: false, error: "No se pudo completar el ingreso: " + errCanje.message };
    return { ok: true };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error: errSesion } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (errSesion) return { ok: false, error: "No se pudo guardar tu sesión: " + errSesion.message };
    return { ok: true };
  }

  return {
    ok: false,
    error: `${NOMBRE_PROVEEDOR[proveedor]} no devolvió una sesión. Probá de nuevo o entrá con tu correo.`,
  };
}

export async function entrarConApple(): Promise<ResultadoSocial> {
  try {
    const disponible = await AppleAuthentication.isAvailableAsync();
    if (!disponible) {
      return { ok: false, error: "Sign in with Apple no está disponible en este teléfono." };
    }

    const credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credencial.identityToken) {
      return { ok: false, error: "Apple no devolvió una sesión válida." };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credencial.identityToken,
    });
    if (error) {
      return { ok: false, error: "No se pudo completar el ingreso con Apple: " + error.message };
    }

    // Apple solo manda el nombre la PRIMERA vez que la persona entra
    // con esta app — si no se guarda ahora, se pierde para siempre.
    const nombreCompleto = [credencial.fullName?.givenName, credencial.fullName?.familyName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (nombreCompleto) {
      await supabase.auth.updateUser({ data: { nombre: nombreCompleto } });
    }

    return { ok: true };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "ERR_REQUEST_CANCELED") {
      return { ok: false, cancelado: true };
    }
    return { ok: false, error: "No se pudo conectar con Apple." };
  }
}

/**
 * Completa la sesión desde una URL de vuelta que llegó por deep link
 * en vez de por `openAuthSessionAsync` (ver el comentario largo en la
 * versión de Bookea normal: recarga de Expo Go en Android). Nunca
 * lanza — la llama el listener de _layout.tsx.
 */
export async function completarSesionDesdeUrl(url: string): Promise<boolean> {
  if (!url.includes("auth")) return false;
  try {
    const params = parametrosDeRetorno(url);
    const code = params.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return !error;
    }
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return !error;
    }
    return false;
  } catch {
    return false;
  }
}
