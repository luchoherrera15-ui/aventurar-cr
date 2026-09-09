"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import {
  esEstadoReunion,
  horaCorta,
  type EstadoReunion,
  type ReunionFila,
} from "@/lib/lealtad/reuniones";

/**
 * LA AGENDA DE REUNIONES, PARA BOOKEA — leer y cambiar el estado.
 *
 * Cada action trae su propio `requireAdmin()`: una server action se
 * puede invocar por su id desde cualquier lado, no solo desde la
 * pantalla del admin (mismo criterio que ayuda-general/acciones.ts).
 */

export async function listarReuniones(): Promise<{ proximas: ReunionFila[]; pasadas: ReunionFila[] }> {
  const { ok } = await requireAdmin();
  if (!ok) return { proximas: [], pasadas: [] };
  const admin = createAdminClient();
  if (!admin) return { proximas: [], pasadas: [] };
  const hoy = hoyISOCR();
  const { data } = await admin.from("reuniones_lealtad").select("*").order("fecha", { ascending: true }).order("hora", { ascending: true }).limit(400);
  const filas = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    nombre: String(r.nombre ?? ""),
    correo: String(r.correo ?? ""),
    telefono: (r.telefono as string | null) ?? null,
    negocio: (r.negocio as string | null) ?? null,
    fecha: String(r.fecha),
    hora: horaCorta(String(r.hora)),
    notas: (r.notas as string | null) ?? null,
    estado: esEstadoReunion(String(r.estado)) ? (r.estado as EstadoReunion) : "pendiente",
    creado_en: String(r.creado_en),
  }));
  return {
    proximas: filas.filter((f) => f.fecha >= hoy),
    pasadas: filas.filter((f) => f.fecha < hoy).reverse().slice(0, 60),
  };
}

export async function cambiarEstadoReunion(id: string, estado: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { ok } = await requireAdmin();
  if (!ok) return { ok: false, motivo: "Solo Bookea puede cambiar una reunión." };
  if (!esEstadoReunion(estado)) return { ok: false, motivo: "Estado desconocido." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "Falta la llave de servicio." };
  const { error } = await admin.from("reuniones_lealtad").update({ estado }).eq("id", id);
  if (error) return { ok: false, motivo: "No se pudo guardar." };
  revalidatePath("/admin/reuniones");
  return { ok: true };
}
