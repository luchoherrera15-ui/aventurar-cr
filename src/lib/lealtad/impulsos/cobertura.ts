import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfigActivador } from "./tipos";

/**
 * ¿UN IMPULSO DE CORREO YA CUBRE ESTE MOMENTO?
 *
 * Bookea ya manda, desde antes de los impulsos, tres correos automáticos al registrar un sello
 * (`correo/sello-acreditado.ts`): el del primer sello, el de «te falta 1» y el de «premio desbloqueado».
 * Si un negocio arma un impulso de correo para ese mismo momento, el cliente recibiría DOS correos casi
 * iguales. Esta función dice cuándo el impulso toma el relevo: solo si está ACTIVO, sale por correo y su
 * disparador es exactamente el equivalente del correo antiguo. Un impulso en borrador, pausado o por
 * Wallet no reemplaza nada: el correo de siempre sigue saliendo.
 *
 * Nunca lanza: ante cualquier duda (tabla inexistente, error de la base) responde «no», y el correo
 * antiguo sale como siempre. Prefiere un correo repetido a un correo perdido.
 */

export type HitoDeCorreoAntiguo = "bienvenida" | "falta_uno" | "premio";

type Reemplazante = { activador: string; activador_config: ConfigActivador | null; canal: string; estado: string };

/** PURA. ¿Este impulso reemplaza al correo antiguo de ese hito? */
export function impulsoReemplazaAlHito(imp: Reemplazante, hito: HitoDeCorreoAntiguo): boolean {
  if (imp.estado !== "activo" || imp.canal !== "correo") return false;
  switch (hito) {
    case "bienvenida":
      return imp.activador === "primera_visita";
    case "premio":
      return imp.activador === "recompensa_alcanzada";
    case "falta_uno":
      // «Faltan N»: solo cubre el correo de «te falta 1» si el impulso también avisa cuando falta 1.
      return imp.activador === "meta_proxima" && (imp.activador_config?.faltan ?? 1) === 1;
  }
}

export async function hayImpulsoQueReemplazaAlHito(
  db: SupabaseClient,
  programaId: string,
  hito: HitoDeCorreoAntiguo,
): Promise<boolean> {
  try {
    const { data, error } = await db
      .from("impulsos_lealtad")
      .select("activador, activador_config, canal, estado")
      .eq("programa_id", programaId)
      .eq("estado", "activo")
      .eq("canal", "correo");
    if (error || !data) return false;
    return (data as Reemplazante[]).some((i) => impulsoReemplazaAlHito(i, hito));
  } catch {
    return false;
  }
}
