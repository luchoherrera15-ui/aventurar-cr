"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sincronizarAgendaExterna, type ResultadoSync } from "@/lib/agenda/importar-ics";

/**
 * Las acciones de "Sincronizar agendas" del panel web: conectar un
 * calendario externo (Google/Apple, por su dirección .ics privada),
 * re-sincronizarlo y desconectarlo. Las escrituras a
 * `agendas_externas` van con la sesión del dueño — la RLS de la 0072
 * garantiza que nadie toque agendas de un negocio ajeno; la
 * importación en sí corre en la lib con la llave de servicio.
 */

function normalizarUrlIcs(cruda: string): string | null {
  let url = cruda.trim();
  if (url.startsWith("webcal://")) url = "https://" + url.slice("webcal://".length);
  if (!/^https:\/\/[^\s]+\.[^\s]+/.test(url)) return null;
  return url.slice(0, 2000);
}

export async function conectarAgendaExterna(
  ranchoId: string,
  input: { nombre: string; url: string },
): Promise<{ error?: string; importados?: number }> {
  const url = normalizarUrlIcs(input.url);
  if (!url) {
    return { error: "Pegá la dirección completa (empieza con https:// o webcal://)." };
  }
  const nombre = input.nombre.trim().slice(0, 80) || "Mi calendario";

  const supabase = await createClient();
  const { data: creada, error } = await supabase
    .from("agendas_externas")
    .insert({ rancho_id: ranchoId, nombre, url })
    .select("id")
    .maybeSingle();
  if (error || !creada) {
    return { error: "No se pudo conectar el calendario. Revisá que la publicación sea tuya." };
  }

  const resultado: ResultadoSync = await sincronizarAgendaExterna(creada.id as string);
  revalidatePath(`/mi-rancho/${ranchoId}`);
  if (!resultado.ok) {
    // Queda conectada con su error anotado: se puede reintentar.
    return { error: resultado.error };
  }
  return { importados: resultado.importados };
}

export async function resincronizarAgendaExterna(
  ranchoId: string,
  agendaId: string,
): Promise<{ error?: string; importados?: number }> {
  // La RLS ya limita al dueño, pero se verifica la pertenencia para
  // no dejar que un id ajeno dispare descargas con esta sesión.
  const supabase = await createClient();
  const { data: propia } = await supabase
    .from("agendas_externas")
    .select("id")
    .eq("id", agendaId)
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  if (!propia) return { error: "No encontramos ese calendario." };

  const resultado = await sincronizarAgendaExterna(agendaId);
  revalidatePath(`/mi-rancho/${ranchoId}`);
  if (!resultado.ok) return { error: resultado.error };
  return { importados: resultado.importados };
}

export async function desconectarAgendaExterna(
  ranchoId: string,
  agendaId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agendas_externas")
    .delete()
    .eq("id", agendaId)
    .eq("rancho_id", ranchoId);
  if (error) return { error: "No se pudo desconectar el calendario." };
  // El cascade de la base borra también los bloqueos importados.
  revalidatePath(`/mi-rancho/${ranchoId}`);
  return {};
}
