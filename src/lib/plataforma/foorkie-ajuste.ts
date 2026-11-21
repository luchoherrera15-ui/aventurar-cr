import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";

import { traducirErrorDeBase } from "@/lib/lealtad/mostrador";
import { aMoneda, aUnidades, llevaCentavos, monedaDeTarjeta, TOPE_UNIDADES } from "@/lib/lealtad/moneda-tarjeta";
import { avisarCambioDePase } from "@/lib/wallet/servicio";
import { leerOperador, leerVinculo, miembroDeLaTarjeta, uuidDe, type Lectura, type Vinculo } from "@/lib/plataforma/foorkie-caja";

/**
 * ════════════════════════════════════════════════════════════════════
 *  AJUSTAR A MANO EL SALDO DE UN CLIENTE (0258)
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño de un local de Foorkie (21 nov 2026): «habilítame
 * MODIFICAR LA CANTIDAD DE PUNTOS: quitarlos, otorgar puntos… es porque,
 * por ejemplo, a esta persona le entregaron más por error». La ficha del
 * cliente en el panel de Foorkie solo leía.
 *
 * Esta pieza escribe UN movimiento `ajuste` con signo (+ da, − quita) y su
 * motivo. Nada se edita ni se borra: el error queda en el historial y la
 * corrección al lado. El saldo, el lock, la idempotencia y el «no deja el
 * saldo bajo cero» son del RPC `ajustar_saldo_lealtad`; acá se lee lo que
 * manda Foorkie, se pasa la cantidad de la moneda de la tarjeta a las
 * unidades del ledger y se avisa al Wallet.
 *
 * Quién puede ajustar (el dueño, un Administrador, el admin de Foorkie) lo
 * decide el panel de Foorkie; esta ruta solo la firma y el vínculo del local.
 */

/** El motivo es obligatorio y viaja al historial del cliente (el ledger guarda hasta 200). */
export const MOTIVO_AJUSTE_MINIMO = 3;
export const MOTIVO_AJUSTE_MAXIMO = 90;
/** Del operador, lo que cabe en el motivo del ledger sin cortar el renglón de la ficha (140). */
const MAX_OPERADOR_EN_MOTIVO = 40;

export type PedidoAjustar = Vinculo & {
  miembroId: string;
  /** En la moneda de la tarjeta, con signo: + da, − quita (colones enteros, $15.50, 40 puntos o 2 sellos). */
  puntos: number;
  motivo: string;
  intentoId: string;
  operador: string | null;
};

/** Una línea, sin caracteres de control y con los espacios normalizados. */
function unaLinea(v: unknown): string {
  return typeof v === "string" ? v.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim() : "";
}

export function leerPedidoAjustar(d: Record<string, unknown>): Lectura<PedidoAjustar> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  const miembroId = uuidDe(d.miembro_id);
  if (!miembroId) return { ok: false, motivo: "Falta el cliente (miembro_id)." };
  const intentoId = uuidDe(d.intento_id);
  if (!intentoId) return { ok: false, motivo: "Falta el identificador del intento (intento_id, un uuid por operación)." };
  if (typeof d.puntos !== "number" || !Number.isFinite(d.puntos) || d.puntos === 0) {
    return { ok: false, motivo: "puntos tiene que ser un número distinto de cero: positivo da, negativo quita." };
  }
  const motivo = unaLinea(d.motivo);
  if (motivo.length < MOTIVO_AJUSTE_MINIMO) return { ok: false, motivo: "Escribe por qué se modifica: queda en el historial del cliente." };
  if (motivo.length > MOTIVO_AJUSTE_MAXIMO) return { ok: false, motivo: `El motivo es muy largo (máximo ${MOTIVO_AJUSTE_MAXIMO} letras).` };
  return { ok: true, valor: { ...v.valor, miembroId, puntos: d.puntos, motivo, intentoId, operador: leerOperador(d.operador) } };
}

/** La llave de idempotencia del ledger; el prefijo `panel:` hace que el historial diga «Panel» (`canal-del-sello.ts`). */
export function referenciaDelAjuste(miembroId: string, intentoId: string): string {
  return `panel:ajuste:${miembroId}:${intentoId}`;
}

/** Lo que queda escrito en el historial: «Le entregaron de más por error (Ana)». Quién fue viaja acá y no en `usuario_id`. */
export function motivoDelAjuste(motivo: string, operador: string | null): string {
  const quien = operador ? unaLinea(operador).slice(0, MAX_OPERADOR_EN_MOTIVO).trimEnd() : "";
  return quien ? `${motivo} (${quien})` : motivo;
}

export type ResultadoAjuste =
  | { ok: true; yaEstaba: boolean; puntos: number; saldo: number }
  | { ok: false; codigo: string; motivo: string; saldo?: number };

type Db = SupabaseClient;

/**
 * Aplica el ajuste. `puntos` llega en la moneda de la tarjeta (con signo) y
 * vuelve igual; el ledger cuenta unidades (centavos en un cashback con
 * centavos). Nunca lanza: lo que sale mal vuelve como `{ ok: false }`.
 */
export async function ajustarSaldoCore(entrada: {
  db: Db;
  programaId: string;
  miembroId: string;
  puntos: number;
  motivo: string;
  referencia: string;
  operador: string | null;
}): Promise<ResultadoAjuste> {
  const { db, programaId, miembroId } = entrada;

  // De ESTA tarjeta, no solo de este negocio (la puerta ya ató la tarjeta al local de Foorkie).
  const miembro = await miembroDeLaTarjeta(db, programaId, miembroId);
  if (!miembro) return { ok: false, codigo: "miembro_ajeno", motivo: "Ese cliente no tiene esta tarjeta." };

  const { data: programa } = await db.from("programa_lealtad").select("beneficio").eq("id", programaId).maybeSingle();
  const moneda = monedaDeTarjeta((programa as { beneficio?: unknown } | null)?.beneficio);

  // Sellos, puntos y colones van en enteros; con centavos, hasta dos decimales. Lo demás no se redondea: se rechaza.
  const cantidad = Math.abs(entrada.puntos);
  const unidades = aUnidades(cantidad, moneda);
  const exacto = Math.abs(aMoneda(unidades, moneda) - cantidad) < 1e-9;
  if (!exacto || unidades < 1 || unidades > TOPE_UNIDADES) {
    return {
      ok: false,
      codigo: "cantidad_invalida",
      motivo: llevaCentavos(moneda) ? "La cantidad no es válida: usa hasta dos decimales." : "La cantidad tiene que ser un número entero.",
    };
  }
  const conSigno = entrada.puntos < 0 ? -unidades : unidades;

  const { data, error } = await db.rpc("ajustar_saldo_lealtad", {
    p_miembro_id: miembroId,
    p_puntos: conSigno,
    p_referencia: entrada.referencia,
    p_motivo: motivoDelAjuste(entrada.motivo, entrada.operador),
  });
  if (error) {
    // Sin la 0258 la función no existe: no se hizo nada (no es ambiguo).
    if (error.code === "PGRST202" || error.code === "42883") {
      return { ok: false, codigo: "sin_migracion", motivo: "Todavía no se pueden modificar los puntos. Prueba más tarde." };
    }
    return { ok: false, codigo: "error_base", motivo: traducirErrorDeBase(error, "modificar el saldo") };
  }

  const r = (data ?? {}) as { ok?: boolean; ya_estaba?: boolean; codigo?: string; motivo?: string; saldo?: number; puntos?: number };
  const saldo = typeof r.saldo === "number" ? aMoneda(r.saldo, moneda) : undefined;
  if (r.ok !== true) {
    return { ok: false, codigo: r.codigo ?? "rechazado", motivo: r.motivo ?? "No se pudo modificar el saldo.", ...(saldo !== undefined ? { saldo } : {}) };
  }

  const aplicado = aMoneda(typeof r.puntos === "number" ? r.puntos : conSigno, moneda);
  // Un reintento: el saldo ya se movió y el pase ya se enteró. No se avisa de nuevo.
  if (r.ya_estaba === true) return { ok: true, yaEstaba: true, puntos: aplicado, saldo: saldo ?? 0 };

  // `quitar` es el evento de «el negocio corrigió» (`mensaje-del-miembro.ts`): «Tu tarjeta se modificó».
  // Con `sumar` el cliente leería «¡Gracias por preferirnos!» por un arreglo que no hizo él.
  after(() => avisarCambioDePase(miembroId, "quitar"));
  return { ok: true, yaEstaba: false, puntos: aplicado, saldo: saldo ?? 0 };
}
