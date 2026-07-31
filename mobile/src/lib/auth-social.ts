import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

/**
 * Entrar con Google o Facebook desde el app.
 *
 * En la web basta con `signInWithOAuth`: el navegador se va al
 * proveedor y vuelve a /auth/callback. En el teléfono no hay a dónde
 * "irse", así que el flujo es en tres pasos:
 *
 *   1. Se le pide a Supabase la URL del proveedor SIN redirigir
 *      (skipBrowserRedirect) — acá nadie navega solo.
 *   2. Se abre en la hoja de autenticación del sistema
 *      (openAuthSessionAsync), que es la que las tiendas exigen: usa
 *      Safari/Chrome Custom Tabs, no un WebView nuestro, para que la
 *      persona vea la barra de direcciones y sepa a quién le está
 *      dando su contraseña.
 *   3. El proveedor devuelve a `bookea://auth` y de esa URL sale la
 *      sesión.
 *
 * Del paso 3 hay dos variantes según cómo esté el proyecto: PKCE
 * devuelve `?code=...` (hay que canjearlo) y el flujo implícito
 * devuelve los tokens en el fragmento `#access_token=...`. Se
 * soportan las dos porque el flowType lo decide la config de Supabase
 * y no queremos que cambiarlo rompa el login del app.
 *
 * PENDIENTE DE CONFIGURACIÓN (una vez, en el panel de Supabase):
 *   · Authentication → Providers: habilitar Google y/o Facebook.
 *   · Authentication → URL Configuration → Redirect URLs: agregar
 *     `bookea://auth`. Sin esto el proveedor rebota con
 *     "requested path is invalid".
 * Hasta que eso esté, las banderas de abajo dejan los botones
 * ocultos: mejor ausente que roto, igual que en la web.
 */

/** El deep link al que vuelve el proveedor. `bookea` es el scheme de app.json. */
const REDIRECT_URL = Linking.createURL("auth");

export type ProveedorSocial = "google" | "facebook";

export const NOMBRE_PROVEEDOR: Record<ProveedorSocial, string> = {
  google: "Google",
  facebook: "Facebook",
};

// Mismas banderas que la web (NEXT_PUBLIC_AUTH_*), con el prefijo que
// Expo necesita para que lleguen al bundle del cliente.
export const GOOGLE_HABILITADO = process.env.EXPO_PUBLIC_AUTH_GOOGLE === "1";
export const FACEBOOK_HABILITADO = process.env.EXPO_PUBLIC_AUTH_FACEBOOK === "1";
export const HAY_LOGIN_SOCIAL = GOOGLE_HABILITADO || FACEBOOK_HABILITADO;

export type ResultadoSocial =
  | { ok: true }
  /** La persona cerró la hoja del navegador — no es un error que mostrar. */
  | { ok: false; cancelado: true }
  | { ok: false; cancelado?: false; error: string };

/** Saca los parámetros del query y del fragmento de la URL de vuelta. */
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

export async function entrarConProveedor(
  proveedor: ProveedorSocial,
): Promise<ResultadoSocial> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: proveedor,
    options: {
      redirectTo: REDIRECT_URL,
      // Sin esto supabase-js intentaría navegar por su cuenta, que en
      // React Native no significa nada.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return {
      ok: false,
      error: `No se pudo conectar con ${NOMBRE_PROVEEDOR[proveedor]}.`,
    };
  }

  const resultado = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);

  if (resultado.type !== "success") {
    // "cancel" y "dismiss" son la persona cerrando la hoja.
    return { ok: false, cancelado: true };
  }

  const params = parametrosDeRetorno(resultado.url);

  // El proveedor puede devolver un error explícito (permiso denegado).
  const errorProveedor = params.get("error_description") ?? params.get("error");
  if (errorProveedor) {
    return { ok: false, error: errorProveedor };
  }

  // PKCE: viene un código que hay que canjear.
  const code = params.get("code");
  if (code) {
    const { error: errCanje } = await supabase.auth.exchangeCodeForSession(code);
    if (errCanje) {
      return { ok: false, error: "No se pudo completar el ingreso: " + errCanje.message };
    }
    return { ok: true };
  }

  // Flujo implícito: los tokens vienen en el fragmento.
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error: errSesion } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (errSesion) {
      return { ok: false, error: "No se pudo guardar tu sesión: " + errSesion.message };
    }
    return { ok: true };
  }

  return {
    ok: false,
    error: `${NOMBRE_PROVEEDOR[proveedor]} no devolvió una sesión. Probá de nuevo o entrá con tu correo.`,
  };
}
