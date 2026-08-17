import { createAdminClient } from "@/lib/supabase/admin";
import { enviarCorreo, escaparHtml } from "@/lib/email";
import { SITIO } from "@/lib/sitio";
import { fechaLargaCR, fmtFechaCorta } from "@/lib/fechas";
import { DIAS_DE_AVISO } from "@/lib/lealtad/vencimiento-sellos";
import { correoDelMiembro } from "./sello-acreditado";

/**
 * «TUS SELLOS ESTÁN POR VENCER» — UN correo, una vez (0180).
 *
 * ------------------------------------------------------------------
 * POR QUÉ UNO SOLO
 * ------------------------------------------------------------------
 * El correo de sellos de este repo ya se acotó a HITOS por una queja
 * real: tres correos en un día, dos con media hora de diferencia,
 * todos diciendo lo que la tarjeta del teléfono ya mostraba (ver
 * `sello-acreditado.ts`). Un recordatorio de vencimiento es el mismo
 * riesgo con otra excusa: la ventana de aviso dura dos semanas y el
 * cron corre todos los días, así que «recordar» sería catorce correos
 * seguidos y la baja del cliente.
 *
 * Uno solo, a `DIAS_DE_AVISO` días del corte, que es el único momento
 * en que el correo hace algo que el pase no hace: traer a la persona
 * de vuelta mientras todavía se puede.
 *
 * Que sea uno solo NO lo garantiza este archivo: lo garantiza la
 * restricción única de `avisos_vencimiento_sellos`, que el barrido
 * reclama ANTES de llamar acá (`vencer-sellos.ts`). Este archivo
 * escribe el correo y nada más.
 *
 * ------------------------------------------------------------------
 * QUÉ DICE, Y QUÉ NO
 * ------------------------------------------------------------------
 * Lo lee alguien que hace meses no pasa por el local. No sabe que
 * existe una regla, ni un cron, ni Bookea. Así que se le cuentan tres
 * cosas y ninguna más: cuántos sellos tiene, hasta cuándo, y que una
 * visita los renueva. Nada de «política de expiración» ni de
 * «inactividad»: es una invitación a volver, no una notificación
 * legal.
 *
 * El remitente visible es Bookea, pero el correo HABLA como el
 * negocio: es SU programa. Nunca lanza — el aviso ya quedó reclamado y
 * un correo que no sale no puede tumbar el barrido.
 */
export async function avisarSellosPorVencer({
  miembroId,
  venceEl,
  saldo,
}: {
  miembroId: string;
  /** Fecha de corte en ISO, ya en la zona del negocio. */
  venceEl: string;
  saldo: number;
}): Promise<void> {
  try {
    const db = createAdminClient();
    if (!db) return;

    const correo = await correoDelMiembro(db, miembroId);
    if (!correo) return; // sin correo conocido, no hay a quién avisarle

    const { data: miembro } = await db
      .from("miembros")
      .select("programa_id")
      .eq("id", miembroId)
      .maybeSingle();
    if (!miembro) return;

    const { data: programa } = await db
      .from("programa_lealtad")
      .select("rancho_id")
      .eq("id", miembro.programa_id as string)
      .maybeSingle();
    if (!programa) return;

    const { data: negocio } = await db
      .from("ranchos")
      .select("nombre, slug")
      .eq("id", programa.rancho_id as string)
      .maybeSingle();
    const negocioNombre = ((negocio?.nombre as string | null) ?? "").trim() || "El negocio";
    const slug = ((negocio?.slug as string | null) ?? "").trim();

    // La meta, para poder decir «7 de 10» y no un número suelto: el
    // progreso es lo que hace que la persona quiera terminarlo.
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

    const progreso = meta !== null && meta > 0 ? `${Math.min(saldo, meta)}/${meta}` : `${saldo}`;
    const unidad = saldo === 1 ? "sello" : "sellos";
    const enlaceTarjeta = slug ? `${SITIO}/tarjeta/${slug}` : `${SITIO}/cuenta/lealtad`;
    const cuando = fechaLargaCR(venceEl);

    const faltan =
      premio && meta !== null && meta > saldo
        ? `Te ${meta - saldo === 1 ? "falta" : "faltan"} ${meta - saldo} para tu ${escaparHtml(premio)}.`
        : "";

    await enviarCorreo({
      to: correo,
      // Sin signos de alarma ni mayúsculas: el asunto tiene que
      // parecer lo que es —tu tarjeta te espera— y no un aviso de
      // cobranza.
      subject: `${negocioNombre} — tus ${unidad} vencen el ${fmtFechaCorta(venceEl)}`,
      html: `
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a93a6">
          ${escaparHtml(negocioNombre)}
        </p>
        <h2 style="margin:0 0 12px;font-size:21px;color:#0a1226">
          Tus ${unidad} te esperan hasta el ${escaparHtml(cuando.toLocaleLowerCase("es-CR"))}
        </h2>
        <p style="margin:0 0 8px;font-size:34px;font-weight:800;color:#0a1226">${escaparHtml(progreso)}</p>
        <p style="margin:0 0 22px;font-size:14.5px;line-height:1.55;color:#4b5468">
          ${faltan} Si no volvés a ${escaparHtml(negocioNombre)} antes de esa fecha, la tarjeta
          arranca de cero. Con una sola visita se renueva y seguís donde ibas.
        </p>
        <p style="margin:0 0 24px">
          <a href="${enlaceTarjeta}"
             style="display:inline-block;background:#0f4c9e;color:#ffffff;padding:12px 22px;
                    border-radius:10px;font-weight:800;text-decoration:none;font-size:14px">
            Ver mi tarjeta
          </a>
        </p>
        <p style="margin:0;font-size:12px;color:#9aa1b0">
          Programa de fidelidad de ${escaparHtml(negocioNombre)} · con Bookea.
          Te escribimos ${DIAS_DE_AVISO} días antes, una sola vez: no vamos a insistir.
        </p>
      `,
    });
  } catch (e) {
    console.warn("[correo] No se pudo avisar que los sellos están por vencer:", e);
  }
}
