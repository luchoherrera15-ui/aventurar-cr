import { supabase } from "@/lib/supabase";

/**
 * Abre (o retoma) el hilo de consulta con un negocio — el mismo
 * mecanismo que /mensajes/consulta/[ranchoId] en la web: si el hilo ya
 * existe se reusa, y si dos pantallas lo crean a la vez, gana el que
 * llegó primero y el otro lo encuentra al reintentar.
 *
 * Devuelve el id de la conversación, o null si no se pudo (negocio
 * inexistente o propio — no se puede consultar a uno mismo).
 */
export async function abrirHiloConsulta(
  ranchoId: string,
  userId: string,
): Promise<string | null> {
  const { data: existente } = await supabase
    .from("conversaciones")
    .select("id")
    .eq("rancho_id", ranchoId)
    .eq("cliente_id", userId)
    .is("reserva_id", null)
    .maybeSingle();

  if (existente?.id) return existente.id as string;

  const { data: creada } = await supabase
    .from("conversaciones")
    .insert({ rancho_id: ranchoId })
    .select("id")
    .maybeSingle();

  if (creada?.id) return creada.id as string;

  // Carrera con otra pestaña/dispositivo: el hilo ya existe.
  const { data: reintento } = await supabase
    .from("conversaciones")
    .select("id")
    .eq("rancho_id", ranchoId)
    .eq("cliente_id", userId)
    .is("reserva_id", null)
    .maybeSingle();

  return (reintento?.id as string) ?? null;
}
