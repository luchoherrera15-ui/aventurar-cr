import { supabase } from "@/lib/supabase";
import { pedirAvisoDeMensaje } from "@/lib/notificaciones";

/** El tope de la columna `mensajes.texto`. */
const TOPE_MENSAJE = 2000;

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

/**
 * Manda el primer mensaje de una consulta Y pide el aviso al proveedor.
 *
 * Las dos cosas van juntas en un solo helper a propósito: el insert va
 * DIRECTO a Supabase (la app no tiene servidor propio), así que sin el
 * pedido al endpoint nadie se entera de la consulta — ni push ni
 * correo, y el proveedor pierde el cliente en silencio. Cada pantalla
 * que insertaba a mano era una oportunidad de olvidarlo, y así fue como
 * la agenda por horas de eventos quedó muda.
 *
 * Espejo de lo que hace la web en `chat-flotante.tsx`. El aviso NO se
 * espera: el mensaje ya quedó guardado y es la fuente de verdad.
 *
 * Devuelve el error de Supabase si el insert falló (null si salió bien).
 */
export async function mandarPrimerMensajeConsulta({
  conversacionId,
  autorId,
  texto,
}: {
  conversacionId: string;
  autorId: string;
  texto: string;
}): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: conversacionId,
      autor_id: autorId,
      texto: texto.slice(0, TOPE_MENSAJE),
    })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (data?.id) void pedirAvisoDeMensaje(data.id as string);
  return { error: null };
}
