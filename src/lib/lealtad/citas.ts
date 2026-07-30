import { createAdminClient } from "@/lib/supabase/admin";
import { otorgarPuntos } from "./motor";

/**
 * El enganche entre la agenda y la lealtad: cuando una cita se marca
 * como cumplida, el cliente gana los puntos que el programa del
 * negocio defina (puntos por visita + puntos por colón gastado).
 *
 * DESACOPLADO A PROPÓSITO: esta función nunca lanza — si el negocio
 * no tiene programa, el cliente no es miembro o algo falla, devuelve
 * el porqué y la cita queda cumplida igual. Marcar asistencia jamás
 * puede romperse por culpa de la lealtad.
 */

export type ResultadoPuntosCita =
  | { otorgado: true; puntos: number; saldo: number }
  | {
      otorgado: false;
      motivo:
        | "sin-programa"
        | "sin-membresia"
        | "cita-no-cumplida"
        | "sin-puntos-configurados"
        | "ya-otorgado"
        | "error";
      detalle?: string;
    };

export async function otorgarPuntosPorCita(reservaId: string): Promise<ResultadoPuntosCita> {
  try {
    const db = createAdminClient();
    if (!db) return { otorgado: false, motivo: "error", detalle: "Sin service key." };

    const { data: reserva } = await db
      .from("reservas")
      .select("id, rancho_id, cliente_id, estado, monto_total")
      .eq("id", reservaId)
      .maybeSingle();

    if (!reserva || reserva.estado !== "cumplida" || !reserva.cliente_id) {
      return { otorgado: false, motivo: "cita-no-cumplida" };
    }

    const { data: programa } = await db
      .from("programa_lealtad")
      .select("id, puntos_por_visita, puntos_por_colon, activo")
      .eq("rancho_id", reserva.rancho_id)
      .eq("activo", true)
      .maybeSingle();
    if (!programa) return { otorgado: false, motivo: "sin-programa" };

    const { data: miembro } = await db
      .from("miembros")
      .select("id, estado")
      .eq("programa_id", programa.id)
      .eq("cliente_id", reserva.cliente_id)
      .eq("estado", "activa")
      .maybeSingle();
    if (!miembro) return { otorgado: false, motivo: "sin-membresia" };

    const monto = typeof reserva.monto_total === "number" ? reserva.monto_total : 0;
    const puntos =
      programa.puntos_por_visita + Math.floor(Number(programa.puntos_por_colon) * monto);
    if (puntos <= 0) return { otorgado: false, motivo: "sin-puntos-configurados" };

    const resultado = await otorgarPuntos({
      miembroId: miembro.id,
      puntos,
      motivo: "Cita cumplida",
      // La referencia hace esto idempotente: la misma cita nunca
      // otorga dos veces aunque se marque cumplida varias veces.
      referencia: `cita:${reservaId}`,
    });

    if (!resultado.ok) return { otorgado: false, motivo: "error", detalle: resultado.error };
    if (!resultado.otorgado) return { otorgado: false, motivo: "ya-otorgado" };
    return { otorgado: true, puntos, saldo: resultado.saldo };
  } catch (e) {
    return {
      otorgado: false,
      motivo: "error",
      detalle: e instanceof Error ? e.message : "error desconocido",
    };
  }
}
