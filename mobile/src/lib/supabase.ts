import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Falta configurar EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (ver mobile/.env.example).",
  );
}

/**
 * Mismo proyecto de Supabase que /web — mismo esquema (ranchos,
 * disponibilidad_rancho, reservas, etc.) y mismas funciones RPC
 * (completar_reserva_temporal, etc.), pero con su propio cliente y
 * variables de entorno porque acá no hay cookies de servidor: la
 * sesión se persiste en AsyncStorage.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    // En web (incluido el paso de renderizado estático de `expo export`,
    // que corre en Node sin `window`) se deja que supabase-js resuelva su
    // propio storage: usa localStorage en el navegador real y una versión
    // en memoria bajo Node. El AsyncStorage de RN no tiene ese resguardo
    // y revienta si se lo fuerza ahí.
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE en vez del 'implicit' que supabase-js trae por defecto.
    //
    // Con el flujo implícito, el proveedor devuelve la sesión como
    // `#access_token=...&refresh_token=...` EN CRUDO: cualquier URL que
    // logre recibir ese redirect se queda con una sesión usable. En un
    // teléfono el redirect pasa por el navegador del sistema y por un
    // deep link, así que hay varios puntos donde puede filtrarse.
    //
    // Con PKCE vuelve un `?code=` que no sirve de nada sin el
    // `code_verifier`, que vive en el AsyncStorage de ESTA app. Además
    // el código viaja en el query, que sobrevive mucho mejor que el
    // fragmento a los saltos entre Custom Tab, Expo Go y el deep link.
    //
    // La web no se ve afectada: usa @supabase/ssr, que ya fuerza pkce
    // por su cuenta. El flowType es del cliente, no del proyecto.
    flowType: "pkce",
  },
});
