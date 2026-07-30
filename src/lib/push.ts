import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envío de notificaciones push a la app móvil, vía el Push API de
 * Expo. Los tokens viven en `push_tokens` (la app los registra al
 * iniciar sesión — ver mobile/src/lib/push.ts).
 *
 * Solo servidor: lee los tokens con la service key.
 *
 * Nunca lanza: el push es un plus — quien llama ya guardó la reserva,
 * la cita o el mensaje, y eso no puede fallar por un aviso. Si la
 * tabla todavía no existe (migración 0057 sin aplicar) simplemente no
 * se envía nada.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo acepta hasta 100 notificaciones por request. */
const TAMANO_LOTE = 100;

type RespuestaExpo = {
  data?: { status: string; details?: { error?: string } }[];
};

export async function enviarPush({
  usuarios,
  titulo,
  cuerpo,
  data,
}: {
  /** Ids de auth.users; los null/undefined se ignoran sin quejarse. */
  usuarios: (string | null | undefined)[];
  titulo: string;
  cuerpo: string;
  /** Carga extra para la app — ej. { url: "/?tab=reservas" } abre esa ruta al tocar. */
  data?: Record<string, string>;
}): Promise<void> {
  const ids = [...new Set(usuarios.filter((u): u is string => !!u))];
  if (ids.length === 0) return;

  const admin = createAdminClient();
  if (!admin) return;

  try {
    const { data: filas, error } = await admin
      .from("push_tokens")
      .select("token")
      .in("user_id", ids);
    if (error || !filas || filas.length === 0) return;

    const mensajes = (filas as { token: string }[]).map((f) => ({
      to: f.token,
      title: titulo,
      body: cuerpo,
      sound: "default" as const,
      data: data ?? {},
    }));

    for (let i = 0; i < mensajes.length; i += TAMANO_LOTE) {
      const lote = mensajes.slice(i, i + TAMANO_LOTE);
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lote),
      });

      // Un token de un teléfono que desinstaló la app viene marcado
      // DeviceNotRegistered — se borra para no insistirle nunca más.
      const json = (await res.json().catch(() => null)) as RespuestaExpo | null;
      const muertos = (json?.data ?? []).flatMap((t, j) =>
        t.status === "error" && t.details?.error === "DeviceNotRegistered"
          ? [lote[j].to]
          : [],
      );
      if (muertos.length > 0) {
        await admin.from("push_tokens").delete().in("token", muertos);
      }
    }
  } catch (e) {
    console.warn("[push] No se pudo enviar la notificación:", e);
  }
}
