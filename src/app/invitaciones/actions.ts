"use server";

import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notificarMensajeNuevo } from "@/lib/notificaciones-mensaje";
import {
  PAQUETES_INVITACIONES,
  PAQUETES_PRINCIPALES,
  SLUG_NEGOCIO_INVITACIONES,
  precioPaquete,
} from "@/lib/paquetes-invitaciones";

/**
 * "Quiero este paquete": abre (o retoma) el hilo de consulta del
 * usuario con el negocio de Invitaciones de Bookea — el mismo
 * mecanismo de /mensajes/consulta/[ranchoId] — y deja mandado el
 * primer mensaje con el paquete elegido, para que el pedido caiga en
 * la bandeja de mensajes normal de Bookea. Sin sesión, primero a
 * iniciar sesión.
 */
export async function pedirPaquete(paqueteId: string): Promise<void> {
  const conAlbum = PAQUETES_INVITACIONES.find((p) => p.id === paqueteId);
  const principal = PAQUETES_PRINCIPALES.find((p) => p.id === paqueteId);
  const paquete = conAlbum ?? principal;
  if (!paquete) notFound();

  const etiquetaPrecio = conAlbum
    ? precioPaquete(conAlbum.precio)
    : principal!.precioEtiqueta;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  // El negocio destino del chat (lo siembra el seed; si no está, 404).
  const { data: negocio } = await supabase
    .from("ranchos")
    .select("id")
    .eq("slug", SLUG_NEGOCIO_INVITACIONES)
    .eq("estado", "aprobado")
    .maybeSingle();
  if (!negocio) notFound();

  // ¿Ya existe el hilo de consulta con Invitaciones Bookea?
  let conversacionId: string;
  const { data: existente } = await supabase
    .from("conversaciones")
    .select("id")
    .eq("rancho_id", negocio.id)
    .eq("cliente_id", user.id)
    .is("reserva_id", null)
    .maybeSingle();

  if (existente) {
    conversacionId = existente.id;
  } else {
    const { data: creada, error } = await supabase
      .from("conversaciones")
      .insert({ rancho_id: negocio.id })
      .select("id")
      .single();

    if (error || !creada) {
      // Carrera (dos pestañas a la vez) o la cuenta dueña del negocio.
      const { data: reintento } = await supabase
        .from("conversaciones")
        .select("id")
        .eq("rancho_id", negocio.id)
        .eq("cliente_id", user.id)
        .is("reserva_id", null)
        .maybeSingle();
      if (!reintento) notFound();
      conversacionId = reintento.id;
    } else {
      conversacionId = creada.id;
    }
  }

  const texto =
    `¡Hola! Quiero el paquete ${paquete.nombre} (${etiquetaPrecio}) ` +
    "para mi invitación digital. Mi evento es: (contanos fecha, tipo de " +
    "evento y estilo que soñás)";

  // Doble click o volver a tocar la misma card: si el último mensaje
  // del hilo ya es este mismo pedido, no lo repetimos.
  const { data: ultimo } = await supabase
    .from("mensajes")
    .select("autor_id, texto")
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultimo || ultimo.autor_id !== user.id || ultimo.texto !== texto) {
    const { data: mensaje } = await supabase
      .from("mensajes")
      .insert({ conversacion_id: conversacionId, autor_id: user.id, texto })
      .select("id")
      .single();

    // El aviso por correo sale después de responder, como en enviarMensaje.
    if (mensaje) {
      after(async () => {
        await notificarMensajeNuevo(mensaje.id).catch((e) => {
          console.error("[invitaciones] Falló el aviso del pedido:", e);
        });
      });
    }
  }

  redirect(`/mensajes/hilo/${conversacionId}`);
}
