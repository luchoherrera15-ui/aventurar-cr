import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { obtenerIdDispositivo } from "./device";

/**
 * Registro del token de Expo Push del dispositivo en `push_tokens`
 * (migración 0057) — es lo que la web usa para hacer sonar el
 * teléfono con reservas, citas y mensajes (src/lib/push.ts en /web).
 *
 * Degrada con gracia, siempre sin lanzar:
 *  - En Expo Go no existe push remoto desde SDK 53 → no hace nada.
 *  - Sin projectId de EAS todavía (el proyecto no se creó) → no hace
 *    nada; cuando exista, esto empieza a funcionar solo.
 *  - Sin permiso de la persona → no hace nada.
 */

let usuarioRegistrado: string | null = null;
let tokenRegistrado: string | null = null;

export async function registrarPush(userId: string) {
  if (usuarioRegistrado === userId) return;
  if (Constants.appOwnership === "expo") return;

  try {
    // El canal es requisito de Android para que la notificación se
    // muestre; HIGH = banner con sonido, como un mensaje.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "General",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    const extra = Constants.expoConfig?.extra as
      | { eas?: { projectId?: string } }
      | undefined;
    const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    // El token es la llave: si otra cuenta usó este teléfono antes,
    // el upsert se lo reasigna a la cuenta actual.
    const { error } = await supabase.from("push_tokens").upsert(
      {
        token,
        user_id: userId,
        plataforma: Platform.OS,
        device_id: await obtenerIdDispositivo(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (!error) {
      usuarioRegistrado = userId;
      tokenRegistrado = token;
    }
  } catch (e) {
    console.warn("[push] No se pudo registrar el token:", e);
  }
}

/**
 * Suelta el token de la cuenta actual. Hay que llamarlo ANTES de
 * supabase.auth.signOut(): la política RLS solo deja borrar la fila
 * mientras la sesión sigue viva.
 */
export async function desregistrarPush() {
  if (!tokenRegistrado) return;
  try {
    await supabase.from("push_tokens").delete().eq("token", tokenRegistrado);
  } catch {
    // Si falla, el próximo login de otra cuenta reasigna el token igual.
  }
  usuarioRegistrado = null;
  tokenRegistrado = null;
}
