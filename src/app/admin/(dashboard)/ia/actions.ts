"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { olvidarConfigIA } from "@/lib/ia/config-ia";
import { AGENTES, esModeloSeleccionable, type AgenteConfigurable, type ModeloIA } from "@/lib/ia/modelos";

/**
 * Todo lo que se guarda desde /admin/ia. Ninguna acción lanza: siempre
 * devuelve { error }, porque el panel muestra el problema en pantalla
 * en vez de romperse — y un fallo acá nunca puede dejar al cliente sin
 * asistente (la configuración vieja sigue vigente hasta que se guarde).
 */

const SIN_PERMISO = "No tenés permiso para esto.";

export type DatosConfigIA = {
  activa: boolean;
  modelos: Record<AgenteConfigurable, ModeloIA>;
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

  /**
   * Un modelo que no esté en el catálogo rompería cada llamada a la
   * API: se rechaza acá y no llega nunca a la base.
   *
   * `esModeloSeleccionable` y NO `esModeloValido`: desde que el
   * catálogo tiene un modelo de Gemini (para poder costear el chat de
   * Lealtad), "válido" ya no significa "elegible". Estos agentes hablan
   * con el SDK de Anthropic; aceptarles un id de Gemini —que
   * `esModeloValido` daría por bueno, porque está en `MODELOS`— dejaría
   * la configuración guardada y rompería esa llamada en la primera
   * visita, sin que nada avise. Ver el comentario de `LISTA_MODELOS`.
   */
  for (const agente of AGENTES) {
    const elegido = datos.modelos?.[agente.id];
    if (!esModeloSeleccionable(elegido)) {
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
 * El interruptor del asistente de un negocio, las indicaciones de su
 * dueño y su límite propio de respuestas por conversación. `activo` en
 * null quiere decir "seguí la regla por defecto" — no es lo mismo que
 * apagarlo. `limiteRespuestas` en null quiere decir lo mismo: usar el
 * default de la plataforma (MAX_RESPUESTAS_ASISTENTE, hoy 15) en vez
 * de un número propio de este negocio.
 */
export async function guardarAsistenteNegocio(
  ranchoId: string,
  activo: boolean | null,
  instrucciones: string,
  limiteRespuestas: number | null,
) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: SIN_PERMISO };
  if (!ranchoId) return { error: "Elegí primero un negocio." };

  if (limiteRespuestas !== null) {
    if (!Number.isFinite(limiteRespuestas) || limiteRespuestas < 1 || limiteRespuestas > 200) {
      return { error: "El límite de respuestas tiene que ser un número entre 1 y 200." };
    }
  }

  const texto = instrucciones.trim();
  const { error } = await supabase
    .from("ranchos")
    .update({
      asistente_activo: activo,
      asistente_instrucciones: texto || null,
      asistente_max_respuestas: limiteRespuestas,
    })
    .eq("id", ranchoId);

  if (error) {
    // Si la 0093 todavía no corrió, esta columna no existe y el mensaje
    // crudo de Postgres confunde más que ayuda.
    if (/asistente_max_respuestas/.test(error.message)) {
      return {
        error: "Falta correr la migración 0093_limite_respuestas_asistente.sql en Supabase.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/ia");
  return { error: null };
}
