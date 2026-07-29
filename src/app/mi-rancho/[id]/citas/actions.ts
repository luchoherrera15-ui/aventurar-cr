"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";
import type { HorarioSemana } from "@/app/citas/tipos";

/**
 * Acciones de la configuración de Citas del panel: el equipo que
 * atiende (equipo_rancho) y el horario semanal del negocio
 * (ranchos.detalles.horario_citas). Las políticas de la base ya
 * limitan todo al dueño o a un admin; acá se confirma la sesión y se
 * validan los datos antes de tocar nada, como en el resto del panel.
 */

/** Una persona del equipo tal como vive en la tabla equipo_rancho. */
export type MiembroEquipo = {
  id: string;
  rancho_id: string;
  nombre: string;
  rol: string | null;
  foto_url: string | null;
  activo: boolean;
  orden: number;
  created_at: string;
};

export type MiembroInput = {
  nombre: string;
  rol: string;
  fotoUrl: string | null;
  activo: boolean;
};

type Resultado = { error?: string; miembro?: MiembroEquipo };

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-rancho/login");
  return { supabase, ok };
}

function validarMiembro(datos: MiembroInput) {
  const nombre = datos.nombre.trim();
  if (!nombre || nombre.length > 60) {
    return "El nombre es obligatorio (máximo 60 caracteres).";
  }
  if (datos.rol.trim().length > 60) {
    return "El rol es muy largo (máximo 60 caracteres).";
  }
  return null;
}

function aFila(datos: MiembroInput) {
  return {
    nombre: datos.nombre.trim(),
    rol: datos.rol.trim() || null,
    foto_url: datos.fotoUrl,
    activo: datos.activo,
  };
}

/** El equipo y el horario también se ven en la página pública de citas. */
function refrescar(ranchoId: string) {
  revalidatePath(`/mi-rancho/${ranchoId}/citas`);
  revalidatePath("/citas", "layout");
}

export async function crearMiembroEquipo(
  ranchoId: string,
  datos: MiembroInput,
): Promise<Resultado> {
  const invalido = validarMiembro(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // La persona nueva va al final: `orden` es lo que las flechas ↑/↓
  // reacomodan después.
  const { data: ultimo } = await supabase
    .from("equipo_rancho")
    .select("orden")
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("equipo_rancho")
    .insert({
      rancho_id: ranchoId,
      orden: (ultimo?.orden ?? 0) + 1,
      ...aFila(datos),
    })
    .select("*")
    .single();

  if (error) {
    // El caso típico: la migración 0055 todavía no se corrió.
    if (/equipo_rancho|column/.test(error.message)) {
      return {
        error: "Falta correr la última migración en Supabase (supabase/migrations).",
      };
    }
    return { error: "No se pudo guardar: " + error.message };
  }

  refrescar(ranchoId);
  return { miembro: data as MiembroEquipo };
}

export async function actualizarMiembroEquipo(
  ranchoId: string,
  miembroId: string,
  datos: MiembroInput,
): Promise<Resultado> {
  const invalido = validarMiembro(datos);
  if (invalido) return { error: invalido };

  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const { data, error } = await supabase
    .from("equipo_rancho")
    .update(aFila(datos))
    .eq("id", miembroId)
    .eq("rancho_id", ranchoId)
    .select("*")
    .single();

  if (error) return { error: "No se pudo guardar: " + error.message };

  refrescar(ranchoId);
  return { miembro: data as MiembroEquipo };
}

/** Guarda el orden completo tal como quedó en el panel (flechas ↑/↓). */
export async function reordenarEquipo(
  ranchoId: string,
  idsEnOrden: string[],
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  for (let i = 0; i < idsEnOrden.length; i++) {
    const { error } = await supabase
      .from("equipo_rancho")
      .update({ orden: i + 1 })
      .eq("id", idsEnOrden[i])
      .eq("rancho_id", ranchoId);
    if (error) return { error: "No se pudo reordenar: " + error.message };
  }

  refrescar(ranchoId);
  return {};
}

export async function eliminarMiembroEquipo(
  ranchoId: string,
  miembroId: string,
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // Sus citas quedan: reservas.miembro_id pasa a null (on delete set null).
  const { error } = await supabase
    .from("equipo_rancho")
    .delete()
    .eq("id", miembroId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  refrescar(ranchoId);
  return {};
}

/**
 * Guarda el horario semanal en ranchos.detalles.horario_citas.
 *
 * `detalles` guarda más cosas (los campos propios del servicio), así
 * que se lee lo actual y se mezcla — nunca se pisa otra llave.
 */
export async function guardarHorarioCitas(
  ranchoId: string,
  horario: HorarioSemana,
): Promise<{ error?: string }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  // Se reconstruye limpio: solo los días 0 (domingo) a 6 (sábado),
  // cada uno abierto con horas válidas o null (cerrado).
  const limpio: HorarioSemana = {};
  for (let dow = 0; dow < 7; dow++) {
    const dia = horario[String(dow)];
    if (!dia) {
      limpio[String(dow)] = null;
      continue;
    }
    if (!HORA_REGEX.test(dia.abre) || !HORA_REGEX.test(dia.cierra)) {
      return { error: "Revisá las horas: alguna quedó incompleta." };
    }
    if (dia.abre >= dia.cierra) {
      return { error: "La hora de cierre tiene que ser después de la de apertura." };
    }
    limpio[String(dow)] = { abre: dia.abre, cierra: dia.cierra };
  }

  const { data: actual, error: errorLectura } = await supabase
    .from("ranchos")
    .select("detalles")
    .eq("id", ranchoId)
    .maybeSingle();
  if (errorLectura) {
    return { error: "No se pudo leer la configuración: " + errorLectura.message };
  }

  const detalles =
    actual?.detalles && typeof actual.detalles === "object" && !Array.isArray(actual.detalles)
      ? (actual.detalles as Record<string, unknown>)
      : {};

  const { error } = await supabase
    .from("ranchos")
    .update({ detalles: { ...detalles, horario_citas: limpio } })
    .eq("id", ranchoId);

  if (error) return { error: "No se pudo guardar: " + error.message };

  refrescar(ranchoId);
  return {};
}
