import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LA ADMINISTRACIÓN DE CELEBRAR — lecturas (0246)
 * ══════════════════════════════════════════════════════════════════
 *
 * Todo entra por RPC `security definer` que preguntan `is_admin()`
 * adentro: para cualquier persona que no sea del equipo devuelven cero
 * filas. Por eso acá no hay `if (!admin)`: la base ya decidió.
 */

export type ResumenCreditosAdmin = {
  vendidos: number;
  ingresos_crc: number;
  regalados: number;
  ajustes: number;
  reembolsados: number;
  consumidos: number;
  en_circulacion: number;
  cuentas_con_saldo: number;
  compras: number;
};

export type MovimientoAdmin = {
  id: string;
  owner_id: string;
  correo: string;
  nombre: string | null;
  celebracion_id: string | null;
  celebracion: string | null;
  tipo: "compra" | "consumo" | "regalo" | "ajuste" | "reembolso";
  cantidad: number;
  monto_crc: number | null;
  concepto: string;
  referencia: string | null;
  created_at: string;
};

export const resumenCreditosAdmin = cache(async (): Promise<ResumenCreditosAdmin | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_admin_resumen_creditos");
  if (error) {
    console.error("[celebrar] resumenCreditosAdmin:", error.message);
    return null;
  }
  const fila = (Array.isArray(data) ? data[0] : data) as ResumenCreditosAdmin | undefined;
  if (!fila) return null;
  return { ...fila, ingresos_crc: Number(fila.ingresos_crc ?? 0) };
});

export async function movimientosAdmin(filtros: { tipo?: string; correo?: string; limite?: number } = {}): Promise<MovimientoAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_admin_movimientos", {
    p_limite: filtros.limite ?? 300,
    p_tipo: filtros.tipo || null,
    p_correo: filtros.correo?.trim() || null,
  });
  if (error) {
    console.error("[celebrar] movimientosAdmin:", error.message);
    return [];
  }
  return (data ?? []) as MovimientoAdmin[];
}

export type CuentaAdmin = { id: string; correo: string; nombre: string | null; saldo: number };

export async function buscarCuentaAdmin(correo: string): Promise<CuentaAdmin | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_admin_buscar_cuenta", { p_correo: correo });
  if (error) {
    console.error("[celebrar] buscarCuentaAdmin:", error.message);
    return null;
  }
  const fila = (Array.isArray(data) ? data[0] : data) as CuentaAdmin | undefined;
  return fila ?? null;
}
