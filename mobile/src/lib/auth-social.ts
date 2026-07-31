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
 *   3. El proveedor devuelve al deep link del app y de esa URL sale la
 *      sesión. Cuál es ese deep link depende del entorno — ver
 *      REDIRECT_URL acá abajo, que NO siempre es `bookea://auth`.
 *
 * Del paso 3 se soportan las dos formas en que Supabase puede devolver
 * la sesión: PKCE (`?code=...`, hay que canjearlo — es lo que usamos) y
 * el flujo implícito (`#access_token=...`). Las dos porque el flowType
 * es del cliente y cambiarlo no debería romper el login.
 *
 * PENDIENTE DE CONFIGURACIÓN (una vez, en el panel de Supabase):
 *   · Authentication → Providers: habilitar Google y/o Facebook.
 *   · Authentication → URL Configuration → Redirect URLs: agregar el
 *     redirect que el app IMPRIME al arrancar (ver abajo), no uno
 *     supuesto. Para el build propio es `bookea://auth`; en Expo Go es
 *     un `exp://...` distinto.
 * Si el redirect no está en la lista, Supabase NO da error: manda a la
 * Site URL. Se ve como "entré con Google y quedé en bookea.lat", con
 * el app todavía deslogueado.
 *
 * Hasta que eso esté, las banderas de abajo dejan los botones ocultos:
 * mejor ausente que roto, igual que en la web.
 */

/**
 * El deep link al que vuelve el proveedor.
 *
 * OJO — NO siempre es `bookea://auth`. Ese scheme solo existe en un
 * build propio (APK, TestFlight, tiendas). Dentro de Expo Go el scheme
 * de app.json SE IGNORA y esto devuelve `exp://<host>/--/auth`, donde
 * el host es la IP y el puerto del dev server — o sea que cambia de
 * red en red. Por eso el valor se imprime abajo: la allow list de
 * Supabase hay que llenarla con lo que el teléfono dice, no con lo que
 * uno supone.
 */
const REDIRECT_URL = Linking.createURL("auth");

if (__DEV__) {
  // El diagnóstico más útil de todo el login social: sin esto, un
  // redirect que no está en la allow list falla en silencio (Supabase
  // manda a la Site URL en vez de dar error) y no hay pista de por qué.
  console.log("[bookea] redirect del login social:", REDIRECT_URL);
}

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
    // "cancel" y "dismiss" son, casi siempre, la persona cerrando la
    // hoja. Pero en Android no se puede confiar en eso: ahí
    // openAuthSessionAsync no es nativo, es un Promise.race entre "el
    // app volvió a primer plano" y "llegó la URL de vuelta". Cuando la
    // pestaña devuelve el control, la primera rama puede ganarle a la
    // segunda y un login PERFECTO se reporta como cancelado.
    //
    // Por eso, antes de rendirse, se le pregunta a Supabase. Si el
    // listener de _layout.tsx alcanzó a canjear el código, la sesión ya
    // existe y esto la encuentra.
    const { data: sesion } = await supabase.auth.getSession();
    if (sesion.session) return { ok: true };
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

/**
 * Completa la sesión desde una URL de vuelta que llegó por deep link en
 * vez de por `openAuthSessionAsync`.
 *
 * Existe por un caso muy concreto de Android + Expo Go: al recibir el
 * intent `exp://`, Expo Go a veces RECARGA el proyecto entero. Esa
 * recarga mata el listener efímero que registra expo-web-browser, así
 * que la URL de vuelta —con la sesión adentro— se pierde y la persona
 * se queda deslogueada sin ningún mensaje de error.
 *
 * Con PKCE esto se recupera bien incluso después de la recarga: el
 * `code_verifier` sigue guardado en AsyncStorage, así que el canje del
 * código funciona igual.
 *
 * Lo llama el listener de _layout.tsx. Nunca lanza.
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

    // Respaldo para el flujo implícito, por si algún día se vuelve.
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
    // Una URL rara no puede tumbar el arranque del app.
    return false;
  }
}
