import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Punto de entrada del "Preguntar por el chat": abre (o retoma) el
 * hilo de consulta del usuario con ese negocio y manda directo a la
 * conversación. Sin sesión, primero a iniciar sesión.
 */
export default async function AbrirConsultaPage({
  params,
}: {
  params: Promise<{ ranchoId: string }>;
}) {
  const { ranchoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  // ¿Ya existe el hilo de consulta con este negocio?
  const { data: existente } = await supabase
    .from("conversaciones")
    .select("id")
    .eq("rancho_id", ranchoId)
    .eq("cliente_id", user.id)
    .is("reserva_id", null)
    .maybeSingle();

  if (existente) redirect(`/mensajes/hilo/${existente.id}`);

  const { data: creada, error } = await supabase
    .from("conversaciones")
    .insert({ rancho_id: ranchoId })
    .select("id")
    .single();

  if (error || !creada) {
    // Carrera (dos pestañas a la vez) o negocio inexistente/propio.
    const { data: reintento } = await supabase
      .from("conversaciones")
      .select("id")
      .eq("rancho_id", ranchoId)
      .eq("cliente_id", user.id)
      .is("reserva_id", null)
      .maybeSingle();
    if (!reintento) notFound();
    redirect(`/mensajes/hilo/${reintento.id}`);
  }

  redirect(`/mensajes/hilo/${creada.id}`);
}
