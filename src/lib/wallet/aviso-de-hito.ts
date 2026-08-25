import { createAdminClient } from "@/lib/supabase/admin";
import { hitoDelSaldo } from "@/lib/correo/sello-acreditado";
import { enviarMensajeGoogle } from "./google";

/**
 * EL MENSAJE DE HITO EN EL WALLET (0205) — la mitad "pase" del mismo
 * hito que ya manda el correo (`avisarSelloPorCorreo`,
 * src/lib/correo/sello-acreditado.ts). Reusa `hitoDelSaldo()` PALABRA
 * POR PALABRA —la misma pregunta pura "¿este saldo amerita algo?"— y
 * NO el resto de ese archivo: acá no se arma ningún correo, se guarda
 * un texto que el pase va a mostrar.
 *
 * Va SEPARADO de `avisarSelloPorCorreo` a propósito, con sus propias
 * consultas: los dos caminos (correo y pase) no comparten código más
 * allá de la función pura de decisión, así que un bug en uno nunca
 * puede tumbar al otro — y las pruebas de `sello-acreditado.test.ts`
 * siguen intactas.
 *
 * SOLO SI EL DUEÑO CONFIGURÓ UN MENSAJE (`programa_lealtad.mensaje_hito`):
 * sin texto configurado, no hay nada que mostrar y esta función no
 * toca nada. Nunca se inventa un mensaje por defecto.
 *
 * NO empuja el aviso de Apple acá: quien llama YA dispara
 * `avisarCambioDePase(miembroId)` en cada acreditación (ver
 * escaner-actions.ts/lealtad-operar-actions.ts) — esta función solo
 * tiene que terminar de escribir `ultimo_hito_mensaje` ANTES de que esa
 * llamada empuje, así que se espera (`await`) antes de ella, nunca
 * después. Repetir el push acá sería un segundo aviso de balde.
 */
export async function avisarHitoPorWallet(
  miembroId: string,
  saldo: number,
): Promise<void> {
  try {
    const db = createAdminClient();
    if (!db) return;

    const { data: miembro } = await db
      .from("miembros")
      .select("programa_id")
      .eq("id", miembroId)
      .maybeSingle();
    if (!miembro) return;

    const { data: programa } = await db
      .from("programa_lealtad")
      .select("mensaje_hito")
      .eq("id", miembro.programa_id as string)
      .maybeSingle();
    const plantilla = ((programa?.mensaje_hito as string | null) ?? "").trim();
    if (!plantilla) return; // el dueño no configuró ningún mensaje de hito

    // La recompensa más barata activa: la misma "próxima meta" que ya
    // usa `avisarSelloPorCorreo` y `generar.ts` para "5 de 10".
    const { data: recompensa } = await db
      .from("recompensas")
      .select("nombre, costo_puntos")
      .eq("programa_id", miembro.programa_id as string)
      .eq("activo", true)
      .order("costo_puntos", { ascending: true })
      .limit(1)
      .maybeSingle();
    const meta = recompensa ? Number(recompensa.costo_puntos) : null;
    const premio = recompensa ? String(recompensa.nombre).trim() : null;

    const hito = hitoDelSaldo(saldo, meta, premio);
    if (!hito) return; // sello intermedio: nada de spam, mismo criterio que el correo

    const mensaje = plantilla.slice(0, 120);

    // Apple lo recibe la próxima vez que el teléfono pida el pase
    // (generar.ts lee `miembros.ultimo_hito_mensaje` y lo mete en el
    // reverso con `changeMessage`) — el push que dispara esa pedida lo
    // hace quien llama a ESTA función, después de esperarla.
    await db
      .from("miembros")
      .update({ ultimo_hito_mensaje: mensaje })
      .eq("id", miembroId);

    // Google: mensaje explícito, mismo mecanismo que el aviso de
    // marketing y el de cambio de diseño — solo si este miembro tiene
    // un pase de Google activo.
    const { data: pasesGoogle } = await db
      .from("pases_wallet")
      .select("miembro_id")
      .eq("miembro_id", miembroId)
      .eq("plataforma", "google")
      .eq("activo", true)
      .limit(1);
    if ((pasesGoogle ?? []).length > 0) {
      await enviarMensajeGoogle(miembroId, mensaje);
    }
  } catch (e) {
    console.warn("[wallet] No se pudo avisar el hito por el pase:", e);
  }
}
