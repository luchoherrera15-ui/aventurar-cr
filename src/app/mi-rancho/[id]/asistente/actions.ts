"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verificarAccesoRancho } from "@/lib/auth";

/**
 * Lo que el dueño le enseña a su asistente del chat: el interruptor por
 * negocio (ranchos.asistente_activo), el tono con el que contesta
 * (ranchos.asistente_instrucciones) y la lista de respuestas propias
 * (conocimiento_negocio, migración 0078).
 *
 * Ninguna acción lanza: todas devuelven { error } para que la pantalla
 * muestre el problema sin tumbar el panel. Y ninguna confía en el id
 * que llega del navegador — antes de escribir se confirma que quien
 * edita es el dueño de ESA publicación (o un admin ayudando), igual
 * que en precios/actions.ts: una misma cuenta puede tener varios
 * negocios, así que filtrar solo por owner_id tocaría todos a la vez.
 */

export type ConocimientoFila = {
  id: string;
  pregunta: string;
  respuesta: string;
  activo: boolean;
  orden: number;
};

export type ConocimientoInput = {
  pregunta: string;
  respuesta: string;
  activo: boolean;
};

type Resultado = { error: string | null; fila?: ConocimientoFila };

const PREGUNTA_MAX = 160;
const RESPUESTA_MAX = 700;
const INSTRUCCIONES_MAX = 800;
/** Tope sano: más respuestas que esto encarecen cada mensaje del chat. */
const FILAS_MAX = 60;

async function verificarDueno(ranchoId: string) {
  const { supabase, user, ok } = await verificarAccesoRancho(ranchoId);
  if (!user) redirect("/mi-rancho/login");
  return { supabase, ok };
}

/**
 * La 0078 es la que crea la tabla y las dos columnas del asistente. Si
 * todavía no se corrió, el mensaje tiene que decir exactamente eso en
 * vez del error crudo de Postgres.
 */
function mensajeDeError(mensaje: string) {
  if (/conocimiento_negocio|asistente_activo|asistente_instrucciones/.test(mensaje)) {
    return "Falta correr la migración supabase/migrations/0078_panel_ia.sql en Supabase.";
  }
  return "No se pudo guardar: " + mensaje;
}

function refrescar(ranchoId: string) {
  revalidatePath(`/mi-rancho/${ranchoId}/asistente`);
  revalidatePath(`/mi-rancho/${ranchoId}`);
}

function limpiar(datos: ConocimientoInput) {
  return {
    pregunta: datos.pregunta.trim(),
    respuesta: datos.respuesta.trim(),
    activo: datos.activo,
  };
}

function validar(datos: { pregunta: string; respuesta: string }) {
  if (!datos.pregunta) return "Escribí la pregunta del cliente.";
  if (datos.pregunta.length > PREGUNTA_MAX) {
    return `La pregunta es muy larga (máximo ${PREGUNTA_MAX} caracteres).`;
  }
  if (!datos.respuesta) return "Escribí la respuesta que querés que dé el asistente.";
  if (datos.respuesta.length > RESPUESTA_MAX) {
    return `La respuesta es muy larga (máximo ${RESPUESTA_MAX} caracteres).`;
  }
  return null;
}

/**
 * El interruptor de tres estados: null = la regla por defecto de la
 * plataforma (hoy: los negocios de Lugares y los del piloto), true lo
 * fuerza encendido y false lo apaga aunque sea de Lugares.
 */
export async function guardarAsistenteActivo(
  ranchoId: string,
  valor: boolean | null,
): Promise<{ error: string | null }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("ranchos")
    .update({ asistente_activo: valor })
    .eq("id", ranchoId);

  if (error) return { error: mensajeDeError(error.message) };

  refrescar(ranchoId);
  return { error: null };
}

export async function guardarInstruccionesAsistente(
  ranchoId: string,
  texto: string,
): Promise<{ error: string | null }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const limpio = texto.trim();
  if (limpio.length > INSTRUCCIONES_MAX) {
    return { error: `Las indicaciones son muy largas (máximo ${INSTRUCCIONES_MAX} caracteres).` };
  }

  const { error } = await supabase
    .from("ranchos")
    // Vacío se guarda como null: así el asistente vuelve a su tono
    // normal en vez de arrastrar un texto en blanco.
    .update({ asistente_instrucciones: limpio || null })
    .eq("id", ranchoId);

  if (error) return { error: mensajeDeError(error.message) };

  refrescar(ranchoId);
  return { error: null };
}

export async function crearConocimiento(
  ranchoId: string,
  datos: ConocimientoInput,
): Promise<Resultado> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const limpio = limpiar(datos);
  const invalido = validar(limpio);
  if (invalido) return { error: invalido };

  const { count } = await supabase
    .from("conocimiento_negocio")
    .select("id", { count: "exact", head: true })
    .eq("rancho_id", ranchoId);
  if ((count ?? 0) >= FILAS_MAX) {
    return {
      error: `Ya tenés ${FILAS_MAX} respuestas cargadas. Borrá alguna que no uses para agregar otra.`,
    };
  }

  // La nueva va al final; las flechas del panel reacomodan `orden`.
  const { data: ultima } = await supabase
    .from("conocimiento_negocio")
    .select("orden")
    .eq("rancho_id", ranchoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("conocimiento_negocio")
    .insert({
      rancho_id: ranchoId,
      pregunta: limpio.pregunta,
      respuesta: limpio.respuesta,
      activo: limpio.activo,
      orden: (ultima?.orden ?? 0) + 1,
    })
    .select("id, pregunta, respuesta, activo, orden")
    .single();

  if (error) return { error: mensajeDeError(error.message) };

  refrescar(ranchoId);
  return { error: null, fila: data as ConocimientoFila };
}

export async function actualizarConocimiento(
  ranchoId: string,
  filaId: string,
  datos: ConocimientoInput,
): Promise<Resultado> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const limpio = limpiar(datos);
  const invalido = validar(limpio);
  if (invalido) return { error: invalido };

  const { data, error } = await supabase
    .from("conocimiento_negocio")
    .update({ ...limpio, updated_at: new Date().toISOString() })
    .eq("id", filaId)
    .eq("rancho_id", ranchoId)
    .select("id, pregunta, respuesta, activo, orden")
    .single();

  if (error) return { error: mensajeDeError(error.message) };

  refrescar(ranchoId);
  return { error: null, fila: data as ConocimientoFila };
}

/** Guarda el orden completo tal como quedó en pantalla (flechas ↑/↓). */
export async function reordenarConocimiento(
  ranchoId: string,
  idsEnOrden: string[],
): Promise<{ error: string | null }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  for (let i = 0; i < idsEnOrden.length; i++) {
    const { error } = await supabase
      .from("conocimiento_negocio")
      .update({ orden: i + 1 })
      .eq("id", idsEnOrden[i])
      .eq("rancho_id", ranchoId);
    if (error) return { error: mensajeDeError(error.message) };
  }

  refrescar(ranchoId);
  return { error: null };
}

export async function eliminarConocimiento(
  ranchoId: string,
  filaId: string,
): Promise<{ error: string | null }> {
  const { supabase, ok } = await verificarDueno(ranchoId);
  if (!ok) return { error: "No encontramos tu publicación." };

  const { error } = await supabase
    .from("conocimiento_negocio")
    .delete()
    .eq("id", filaId)
    .eq("rancho_id", ranchoId);

  if (error) return { error: "No se pudo borrar: " + error.message };

  refrescar(ranchoId);
  return { error: null };
}
