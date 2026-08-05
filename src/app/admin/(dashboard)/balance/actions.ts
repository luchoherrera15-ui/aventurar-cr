"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELOS_COBRO, type ModeloCobro } from "@/lib/cobro-plataforma";

export async function guardarComision(comisionPorPersona: number) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase
    .from("configuracion_plataforma")
    .update({ comision_por_persona: comisionPorPersona })
    .eq("id", true);

  if (error) return { error: error.message };

  revalidatePath("/admin/finanzas");
  return { error: null };
}

/**
 * Fija (o cambia) la tarifa de plataforma de UN negocio (0098). La
 * tabla tiene RLS sin policies — solo escribe la service key, igual
 * que addons_negocio: el gate real es requireAdmin() de acá arriba.
 */
export async function guardarCobroNegocio(
  ranchoId: string,
  modelo: string,
  valor: number,
  notas: string | null,
) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (!(MODELOS_COBRO as readonly string[]).includes(modelo)) {
    return { error: "Modelo de cobro no válido." };
  }
  if (!Number.isFinite(valor) || valor < 0) {
    return { error: "El valor no puede ser negativo." };
  }
  if (modelo === "comision_porcentaje" && valor > 100) {
    return { error: "Un porcentaje no puede pasar de 100." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Falta la service key en el servidor." };

  const { error } = await admin.from("cobro_negocio").upsert(
    {
      rancho_id: ranchoId,
      modelo: modelo as ModeloCobro,
      valor,
      notas: notas?.trim() ? notas.trim().slice(0, 300) : null,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "rancho_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/finanzas");
  return { error: null };
}

/** Vuelve el negocio al default global: borra su tarifa propia. */
export async function quitarCobroNegocio(ranchoId: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const admin = createAdminClient();
  if (!admin) return { error: "Falta la service key en el servidor." };

  const { error } = await admin.from("cobro_negocio").delete().eq("rancho_id", ranchoId);
  if (error) return { error: error.message };

  revalidatePath("/admin/finanzas");
  return { error: null };
}

export type NuevoGasto = {
  concepto: string;
  categoria: string;
  monto: number;
  recurrencia: string;
  fecha: string;
  notas: string | null;
  /** Sección del gasto; null = general de la plataforma. */
  vertical: string | null;
};

export async function agregarGasto(gasto: NuevoGasto) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", id: null };

  // La columna `vertical` llega con la migración 0065: mandarla solo
  // cuando trae valor deja funcionando los gastos generales aunque la
  // migración todavía no se haya corrido.
  const { vertical, ...resto } = gasto;
  const payload: Record<string, string | number | null> = { ...resto };
  if (vertical) payload.vertical = vertical;
  const { data, error } = await supabase
    .from("gastos")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };

  revalidatePath("/admin/finanzas");
  return { error: null, id: data.id as string };
}

export async function borrarGasto(id: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/finanzas");
  return { error: null };
}
