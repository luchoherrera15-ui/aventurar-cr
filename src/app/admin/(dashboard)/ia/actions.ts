"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { olvidarConfigIA } from "@/lib/ia/config-ia";
import { AGENTES, esModeloValido, type AgenteIA, type ModeloIA } from "@/lib/ia/modelos";

/**
 * Todo lo que se guarda desde /admin/ia. Ninguna acción lanza: siempre
 * devuelve { error }, porque el panel muestra el problema en pantalla
 * en vez de romperse — y un fallo acá nunca puede dejar al cliente sin
 * asistente (la configuración vieja sigue vigente hasta que se guarde).
 */

const SIN_PERMISO = "No tenés permiso para esto.";

export type DatosConfigIA = {
  activa: boolean;
  modelos: Record<AgenteIA, ModeloIA>;
  topeMensualUSD: number;
  tipoCambio: number;
};

export async function guardarConfigIA(datos: DatosConfigIA) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };

  const tope = Number(datos.topeMensualUSD);
  if (!Number.isFinite(tope) || tope < 0) {
    return { error: "El tope mensual tiene que ser 0 o más." };
  }
  const tipoCambio = Number(datos.tipoCambio);
  if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    return { error: "El tipo de cambio tiene que ser mayor que cero." };
  }

  const payload: Record<string, string | number | boolean> = {
    ia_activa: datos.activa,
    ia_tope_mensual_usd: tope,
    ia_tipo_cambio: tipoCambio,
  };

  // Un modelo que no esté en el catálogo rompería cada llamada a la
  // API: se rechaza acá y no llega nunca a la base.
  for (const agente of AGENTES) {
    const elegido = datos.modelos?.[agente.id];
    if (!esModeloValido(elegido)) {
      return { error: `El modelo elegido para "${agente.nombre}" no está en el catálogo.` };
    }
    payload[agente.columna] = elegido;
  }

  const { error } = await supabase
    .from("configuracion_plataforma")
    .update(payload)
    .eq("id", true);

  if (error) return { error: error.message };

  // Sin esto el cambio tardaría hasta un minuto en notarse: el caché de
  // config-ia guarda la configuración vieja.
  olvidarConfigIA();
  revalidatePath("/admin/ia");
  return { error: null };
}

export type NuevoConocimiento = {
  ranchoId: string;
  pregunta: string;
  respuesta: string;
  orden: number;
};

export async function crearConocimiento(datos: NuevoConocimiento) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO, id: null };

  const pregunta = datos.pregunta.trim();
  const respuesta = datos.respuesta.trim();
  if (!datos.ranchoId) return { error: "Elegí primero un negocio.", id: null };
  if (!pregunta || !respuesta) {
    return { error: "Hacen falta la pregunta y la respuesta.", id: null };
  }

  const { data, error } = await supabase
    .from("conocimiento_negocio")
    .insert({
      rancho_id: datos.ranchoId,
      pregunta,
      respuesta,
      orden: Number.isFinite(datos.orden) ? datos.orden : 0,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, id: null };

  revalidatePath("/admin/ia");
  return { error: null, id: data.id as string };
}

export async function editarConocimiento(
  id: string,
  datos: { pregunta: string; respuesta: string; orden: number },
) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };

  const pregunta = datos.pregunta.trim();
  const respuesta = datos.respuesta.trim();
  if (!pregunta || !respuesta) {
    return { error: "Hacen falta la pregunta y la respuesta." };
  }

  const { error } = await supabase
    .from("conocimiento_negocio")
    .update({
      pregunta,
      respuesta,
      orden: Number.isFinite(datos.orden) ? datos.orden : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/ia");
  return { error: null };
}

/** Apagar una respuesta sin borrarla: el asistente deja de usarla. */
export async function activarConocimiento(id: string, activo: boolean) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };

  const { error } = await supabase
    .from("conocimiento_negocio")
    .update({ activo, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/ia");
  return { error: null };
}

export async function borrarConocimiento(id: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };

  const { error } = await supabase.from("conocimiento_negocio").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/ia");
  return { error: null };
}

/**
 * El interruptor del asistente de un negocio y las indicaciones de su
 * dueño. `activo` en null quiere decir "seguí la regla por defecto" —
 * no es lo mismo que apagarlo.
 */
export async function guardarAsistenteNegocio(
  ranchoId: string,
  activo: boolean | null,
  instrucciones: string,
) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };
  if (!ranchoId) return { error: "Elegí primero un negocio." };

  const texto = instrucciones.trim();
  const { error } = await supabase
    .from("ranchos")
    .update({
      asistente_activo: activo,
      asistente_instrucciones: texto || null,
    })
    .eq("id", ranchoId);

  if (error) return { error: error.message };

  revalidatePath("/admin/ia");
  return { error: null };
}
