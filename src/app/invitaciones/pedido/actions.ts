"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  crearPedidoInvitacion,
  notificarPedidoNuevo,
  notificarPedidoPagado,
  registrarPagoPedido,
  type DatosPedido,
} from "@/lib/invitaciones/pedido";

/**
 * El pedido de una invitación digital desde el sitio: el cliente elige
 * paquete, llena los datos de su fiesta y elige cómo pagar.
 *
 * La lógica de verdad (validación, precio, insert y correos) vive en
 * src/lib/invitaciones/pedido — la comparten estas acciones y el
 * endpoint que usa la app móvil. Acá solo queda lo propio de la web:
 * leer el FormData y redirigir.
 */

export type EstadoPedido = { error?: string };

/** El FormData del navegador, pasado a objeto plano para el módulo. */
function datosDelForm(form: FormData): DatosPedido {
  const campos = [
    "tipo_evento",
    "nombre_evento",
    "anfitriones",
    "fecha_evento",
    "hora",
    "lugar_nombre",
    "lugar_direccion",
    "maps_url",
    "tematica",
    "colores",
    "cantidad_invitados",
    "fecha_limite_confirmacion",
    "mensaje",
    "idioma",
    "contacto_nombre",
    "contacto_whatsapp",
    "contacto_correo",
  ] as const;

  const datos: Record<string, unknown> = {};
  for (const campo of campos) datos[campo] = form.get(campo);
  return datos as DatosPedido;
}

/** Guarda el pedido y manda al cliente a la pantalla de pago. */
export async function crearPedido(
  paqueteId: string,
  _estado: EstadoPedido,
  form: FormData,
): Promise<EstadoPedido> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/cuenta?next=/invitaciones/pedido/${paqueteId}`);
  }

  const resultado = await crearPedidoInvitacion({
    supabase,
    clienteId: user.id,
    correoCuenta: user.email ?? null,
    paqueteId,
    datos: datosDelForm(form),
  });

  if (!resultado.ok) return { error: resultado.error };

  // El aviso a los administradores sale DESPUÉS de responder: el
  // cliente pasa a su pantalla de pago sin esperar a Resend. Se
  // registra antes del redirect a propósito — `redirect()` lanza, así
  // que cualquier cosa escrita debajo no correría nunca.
  const pedido = resultado.pedido;
  after(() => notificarPedidoNuevo(pedido));

  redirect(`/invitaciones/pago/${resultado.pedidoId}`);
}

/**
 * El cliente eligió SINPE o transferencia y adjuntó su comprobante:
 * el pedido pasa a revisión y salen los correos (al cliente y al
 * equipo de Bookea).
 */
export async function registrarPago(
  pedidoId: string,
  _estado: EstadoPedido,
  form: FormData,
): Promise<EstadoPedido> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta");

  const resultado = await registrarPagoPedido({
    supabase,
    pedidoId,
    clienteId: user.id,
    metodo: String(form.get("metodo_pago") ?? "").trim(),
    comprobanteUrl: String(form.get("comprobante_url") ?? "").trim(),
    referencia: String(form.get("referencia_pago") ?? "").trim() || null,
  });

  if (!resultado.ok) return { error: resultado.error };

  // Los correos salen después de responder: que el cliente vea su
  // pantalla de "listo" sin esperar a Resend.
  const pedido = resultado.pedido!;
  after(() => notificarPedidoPagado(pedido));

  redirect(`/invitaciones/pago/${pedidoId}?listo=1`);
}
