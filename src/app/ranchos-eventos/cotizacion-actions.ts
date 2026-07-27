"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CotizacionState = { error?: string } | undefined;

/**
 * "Solicitar cotización" para todo lo que no es Lugares: no reserva
 * una fecha en un calendario (esas categorías se contratan por trato,
 * no por disponibilidad), es un pedido de contacto real que:
 *  1) queda guardado como reserva "pendiente" — el proveedor la ve en
 *     su panel, no se pierde en un chat de WhatsApp externo.
 *  2) habilita el chat en vivo que ya existe (está ligado a una
 *     reserva), para que cliente y proveedor negocien precio ahí.
 *
 * Exige sesión iniciada a propósito: sin cliente_id no hay a quién
 * darle acceso al chat de esa conversación.
 */
export async function solicitarCotizacion(
  ranchoId: string,
  _prevState: CotizacionState,
  formData: FormData,
): Promise<CotizacionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Iniciá sesión para solicitar una cotización." };

  const fecha = String(formData.get("fecha") || "");
  const tipoEvento = String(formData.get("tipo_evento") || "").trim();
  const invitadosRaw = String(formData.get("invitados") || "").trim();
  const invitados = invitadosRaw ? parseInt(invitadosRaw, 10) : null;
  const notas = String(formData.get("notas") || "").trim();

  if (!fecha) return { error: "Decinos para qué fecha es tu evento." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  const { data: reserva, error } = await supabase
    .from("reservas")
    .insert({
      rancho_id: ranchoId,
      cliente_id: user.id,
      fecha,
      tipo_evento: tipoEvento || null,
      invitados: invitados && invitados > 0 ? invitados : null,
      nombre: perfil?.nombre || user.email,
      correo: user.email,
      notas: notas || null,
      estado: "pendiente",
      origen: "web",
    })
    .select("id")
    .single();

  if (error || !reserva) {
    return { error: "No se pudo enviar la solicitud. Intentá de nuevo." };
  }

  redirect(`/mensajes/${reserva.id}`);
}
