"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";

/**
 * Acciones para gestionar las duraciones máximas por día de la semana
 * para lugares/sitios de alquiler.
 */

export type DuracionPorDia = {
  dowGrupo: 1 | 2 | 3 | 4 | 5; // 1=L, 2=M, 3=X, 4=J, 5=V/S/D
  duracionMaximaHoras: number;
};

const DOW_LABELS: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes/Sábado/Domingo",
};

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-negocio/login");
  return { supabase, ok };
}

function refrescar(ranchoId: string) {
  revalidatePath(`/mi-negocio/${ranchoId}`);
}

/**
 * Guarda las duraciones máximas por día para un lugar.
 */
export async function guardarDuracionesPorDia(
  ranchoId: string,
  duraciones: DuracionPorDia[],
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  try {
    // Validar datos
    for (const d of duraciones) {
      if (!Number.isFinite(d.duracionMaximaHoras) || d.duracionMaximaHoras <= 0) {
        return { error: `Duración inválida para ${DOW_LABELS[d.dowGrupo]}.` };
      }
      if (d.duracionMaximaHoras > 24) {
        return { error: `La duración no puede exceder 24 horas (${DOW_LABELS[d.dowGrupo]}).` };
      }
    }

    // Eliminar configuración anterior y guardar nueva
    await supabase
      .from("duraciones_lugar_por_dia")
      .delete()
      .eq("rancho_id", ranchoId);

    if (duraciones.length > 0) {
      const datosInsert = duraciones.map((d) => ({
        rancho_id: ranchoId,
        dow_grupo: d.dowGrupo,
        duracion_maxima_horas: d.duracionMaximaHoras,
      }));

      const { error } = await supabase
        .from("duraciones_lugar_por_dia")
        .insert(datosInsert);

      if (error) return { error: "No se pudo guardar: " + error.message };
    }

    refrescar(ranchoId);
    return {};
  } catch (e) {
    return { error: `Error inesperado: ${String(e)}` };
  }
}

/**
 * Carga las duraciones máximas por día para un lugar.
 */
export async function cargarDuracionesPorDia(
  ranchoId: string,
): Promise<{ duraciones: DuracionPorDia[]; error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { duraciones: [], error: "No encontramos tu publicación." };

  const { data, error } = await supabase
    .from("duraciones_lugar_por_dia")
    .select("*")
    .eq("rancho_id", ranchoId)
    .order("dow_grupo", { ascending: true });

  if (error) {
    return { duraciones: [], error: "No se pudo cargar: " + error.message };
  }

  const duraciones: DuracionPorDia[] = (data ?? []).map((d: { dow_grupo: 1 | 2 | 3 | 4 | 5; duracion_maxima_horas: number | string }) => ({
    dowGrupo: d.dow_grupo,
    duracionMaximaHoras: Number(d.duracion_maxima_horas),
  }));

  return { duraciones };
}

/**
 * Obtiene la duración máxima para un día específico de la semana.
 * dow: 0=domingo, 1=lunes, ..., 6=sábado
 */
export async function obtenerDuracionMaxima(
  ranchoId: string,
  dow: number,
): Promise<{ duracionMaximaHoras: number | null; error?: string }> {
  const { supabase } = await verificarAccesoRancho(ranchoId);

  // Convertir dow de JS (0=domingo) a nuestro sistema:
  // 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes/sábado/domingo
  let dowGrupo: number;
  if (dow === 0 || dow === 5 || dow === 6) {
    // Domingo, sábado = grupo 5 (viernes/sábado/domingo)
    dowGrupo = 5;
  } else {
    // Lunes-jueves mantienen su valor
    dowGrupo = dow;
  }

  const { data, error } = await supabase
    .from("duraciones_lugar_por_dia")
    .select("duracion_maxima_horas")
    .eq("rancho_id", ranchoId)
    .eq("dow_grupo", dowGrupo)
    .maybeSingle();

  if (error) return { duracionMaximaHoras: null, error: error.message };
  if (!data) return { duracionMaximaHoras: null };

  return { duracionMaximaHoras: Number(data.duracion_maxima_horas) };
}
