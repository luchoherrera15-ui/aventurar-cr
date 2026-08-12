"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCambioDePase } from "@/lib/wallet/servicio";
import type { PermisoLealtad } from "@/lib/lealtad/permisos";

/**
 * Las operaciones del día a día del programa de lealtad: acreditar,
 * canjear, revertir, suspender. Todas contra los RPC de la 0125, que
 * son quienes garantizan la atomicidad — acá solo se comprueba QUIÉN
 * puede y sobre QUÉ negocio.
 *
 * El patrón de seguridad es el mismo del escáner: primero
 * `verificarAccesoLealtad` (dueño, colaborador o admin, con el
 * checklist de la 0127 ya resuelto — cada acción declara QUÉ permiso
 * exige), después la comprobación de que el miembro pertenece a ESTE
 * negocio — porque el id del miembro llega del navegador, o sea de
 * fuera — y solo entonces el RPC con la llave de servicio. Los RPC no
 * aceptan llamadas de `authenticated` (0125): sin este camino no hay
 * forma de moverle el saldo a nadie.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; motivo: string };

const SIN_PERMISO: Record<PermisoLealtad, string> = {
  acreditar: "No tenés permiso para dar sellos — pedíselo al dueño.",
  canjear: "No tenés permiso para canjear premios — pedíselo al dueño.",
  revertir: "No tenés permiso para revertir movimientos — pedíselo al dueño.",
  auditoria: "No tenés permiso para ver la auditoría — pedíselo al dueño.",
};

async function guardYMiembro(
  ranchoId: string,
  miembroId: string,
  permiso: PermisoLealtad,
): Promise<
  | { ok: true; db: NonNullable<ReturnType<typeof createAdminClient>>; usuarioId: string }
  | { ok: false; motivo: string }
> {
  const { user, ok, permisos } = await verificarAccesoLealtad(ranchoId);
  if (!user) redirect("/lealtad/login");
  if (!ok) return { ok: false, motivo: "No tenés acceso a este negocio." };
  if (!permisos[permiso]) return { ok: false, motivo: SIN_PERMISO[permiso] };

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // LA comprobación que importa: que el miembro sea de ESTE negocio.
  const { data: miembro } = await db
    .from("miembros")
    .select("id, programa_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return { ok: false, motivo: "Esa membresía no existe." };

  const { data: programa } = await db
    .from("programa_lealtad")
    .select("rancho_id")
    .eq("id", miembro.programa_id)
    .maybeSingle();
  if (!programa || programa.rancho_id !== ranchoId) {
    return { ok: false, motivo: "Esa membresía es de otro negocio." };
  }

  return { ok: true, db, usuarioId: user.id };
}

/**
 * Acredita una operación (visita o compra) a un miembro.
 *
 * `monto` en colones enteros; null = visita sin monto. El navegador
 * NUNCA manda puntos: manda el hecho (vino, gastó tanto) y el RPC
 * recalcula con las reglas vigentes del programa.
 *
 * `referencia` viene del llamador para que un doble clic o un reintento
 * de red no acredite dos veces: misma referencia = un solo movimiento.
 */
export async function acreditarOperacion(
  ranchoId: string,
  miembroId: string,
  monto: number | null,
  referencia?: string,
): Promise<Resultado<{ puntos: number; saldo: number; yaEstaba: boolean }>> {
  if (monto !== null && (!Number.isInteger(monto) || monto < 0 || monto > 10_000_000)) {
    return { ok: false, motivo: "El monto debe ser una cantidad entera de colones." };
  }

  const g = await guardYMiembro(ranchoId, miembroId, "acreditar");
  if (!g.ok) return g;

  const { data, error } = await g.db.rpc("acreditar_lealtad", {
    p_miembro_id: miembroId,
    p_monto: monto,
    p_referencia: referencia?.trim() || `panel:${randomUUID()}`,
    p_usuario_id: g.usuarioId,
    p_motivo: monto === null ? "Sello por visita" : "Compra",
  });

  if (error) return { ok: false, motivo: traducirRpc(error.message) };

  const r = data as { otorgado: boolean; puntos?: number; saldo?: number; motivo?: string };
  if (!r.otorgado && r.motivo !== "ya-otorgado") {
    return { ok: false, motivo: r.motivo ?? "No se pudo acreditar." };
  }

  // El aviso al teléfono nunca frena la operación (los puntos ya
  // están), pero un `void` suelto muere cuando Vercel congela la
  // función al responder: `after` lo mantiene vivo.
  after(() => avisarCambioDePase(miembroId));
  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    puntos: r.puntos ?? 0,
    saldo: r.saldo ?? 0,
    yaEstaba: r.motivo === "ya-otorgado",
  };
}

/**
 * Confirma el canje de una recompensa. El RPC revalida TODO bajo lock
 * (saldo, stock, vigencia, límites): lo que el panel mostró hace un
 * minuto no cuenta — dos canjes simultáneos no pueden gastar el mismo
 * saldo.
 */
export async function canjearRecompensa(
  ranchoId: string,
  miembroId: string,
  recompensaId: string,
  referencia?: string,
): Promise<
  Resultado<{ saldo: number; recompensa: string; sku: string | null; instrucciones: string | null }>
> {
  const g = await guardYMiembro(ranchoId, miembroId, "canjear");
  if (!g.ok) return g;

  const { data, error } = await g.db.rpc("canjear_recompensa", {
    p_miembro_id: miembroId,
    p_recompensa_id: recompensaId,
    p_usuario_id: g.usuarioId,
    p_referencia: referencia?.trim() || `canje:${randomUUID()}`,
  });

  if (error) return { ok: false, motivo: traducirRpc(error.message) };

  const r = data as {
    ok: boolean;
    motivo?: string;
    canje_id?: string;
    saldo?: number;
    recompensa?: string;
    sku?: string | null;
    instrucciones?: string | null;
  };
  if (!r.ok) return { ok: false, motivo: r.motivo ?? "No se pudo canjear." };

  // Tras el canje sale el evento para el POS. En modo manual queda
  // 'pendiente' hasta que el personal lo marque; si algún día hay un
  // proveedor con API, el worker lo levanta de acá. Un fallo escribiendo
  // el evento NO tumba el canje: el débito ya está en el ledger.
  //
  // La idempotencia es el id del canje: un reintento de red del mismo
  // canje no duplica el evento (el unique de la tabla lo rebota).
  if (r.canje_id) {
    try {
      await g.db.from("eventos_integracion").insert({
        rancho_id: ranchoId,
        tipo: "canje",
        payload: {
          canje_id: r.canje_id,
          miembro_id: miembroId,
          recompensa: r.recompensa,
          sku: r.sku,
          saldo_resultante: r.saldo,
        },
        idempotencia: `canje:${r.canje_id}`,
      });
    } catch {
      // Ver arriba: el canje vale igual.
    }
  }

  after(() => avisarCambioDePase(miembroId));
  revalidatePath(`/lealtad/panel/${ranchoId}`);

  return {
    ok: true,
    saldo: r.saldo ?? 0,
    recompensa: r.recompensa ?? "",
    sku: r.sku ?? null,
    instrucciones: r.instrucciones ?? null,
  };
}

/**
 * Revierte un movimiento con una compensación. El original NUNCA se
 * edita ni se borra: los errores se corrigen con el movimiento
 * contrario, y el ledger cuenta la historia completa.
 */
export async function revertirMovimiento(
  ranchoId: string,
  miembroId: string,
  transaccionId: string,
  motivo: string,
): Promise<Resultado<{ saldo: number }>> {
  const limpio = motivo.trim();
  if (!limpio) return { ok: false, motivo: "Decí por qué se revierte: queda en el historial." };
  if (limpio.length > 200) return { ok: false, motivo: "El motivo es muy largo (máximo 200)." };

  const g = await guardYMiembro(ranchoId, miembroId, "revertir");
  if (!g.ok) return g;

  // El movimiento tiene que ser DE ESTE miembro: el id llega de fuera.
  const { data: tx } = await g.db
    .from("transacciones_puntos")
    .select("id, miembro_id")
    .eq("id", transaccionId)
    .maybeSingle();
  if (!tx || tx.miembro_id !== miembroId) {
    return { ok: false, motivo: "Ese movimiento no es de esta membresía." };
  }

  const { data, error } = await g.db.rpc("revertir_movimiento", {
    p_transaccion_id: transaccionId,
    p_usuario_id: g.usuarioId,
    p_motivo: limpio,
  });

  if (error) return { ok: false, motivo: traducirRpc(error.message) };
  const r = data as { ok: boolean; motivo?: string; saldo?: number };
  if (!r.ok) return { ok: false, motivo: r.motivo ?? "No se pudo revertir." };

  after(() => avisarCambioDePase(miembroId));
  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true, saldo: r.saldo ?? 0 };
}

/**
 * Suspende o reactiva la membresía. Suspender NO borra nada: el saldo
 * y el historial quedan; solo dejan de entrar movimientos.
 */
export async function cambiarEstadoMiembro(
  ranchoId: string,
  miembroId: string,
  estado: "activa" | "pausada" | "cancelada",
): Promise<Resultado> {
  if (!["activa", "pausada", "cancelada"].includes(estado)) {
    return { ok: false, motivo: "Ese estado no existe." };
  }

  // Suspender una membresía pesa lo mismo que revertir: le corta el
  // programa a un cliente. Mismo permiso, no uno nuevo.
  const g = await guardYMiembro(ranchoId, miembroId, "revertir");
  if (!g.ok) return g;

  const { error } = await g.db.from("miembros").update({ estado }).eq("id", miembroId);
  if (error) return { ok: false, motivo: "No se pudo cambiar: " + error.message };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}

/**
 * Marca un canje como registrado en el POS (modo manual). Conserva
 * quién y cuándo: es lo que separa "alguien dijo que lo hizo" de un
 * registro.
 */
export async function marcarCanjeEnPos(
  ranchoId: string,
  miembroId: string,
  canjeId: string,
  facturaRef: string,
): Promise<Resultado> {
  const g = await guardYMiembro(ranchoId, miembroId, "canjear");
  if (!g.ok) return g;

  const { data, error } = await g.db
    .from("canjes")
    .update({
      factura_ref: facturaRef.trim().slice(0, 60) || null,
      pos_registrado_en: new Date().toISOString(),
      pos_registrado_por: g.usuarioId,
    })
    .eq("id", canjeId)
    .eq("miembro_id", miembroId)
    .is("pos_registrado_en", null) // idempotente: el segundo clic no pisa al primero
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, motivo: "No se pudo marcar: " + error.message };
  if (!data) return { ok: false, motivo: "Ese canje ya estaba marcado (o no existe)." };

  revalidatePath(`/lealtad/panel/${ranchoId}`);
  return { ok: true };
}

/** Los errores de RPC que merecen mensaje propio. */
function traducirRpc(mensaje: string) {
  if (/acreditar_lealtad|canjear_recompensa|revertir_movimiento/.test(mensaje)) {
    return "Falta correr la migración 0125 en Supabase.";
  }
  return "No se pudo completar: " + mensaje;
}
