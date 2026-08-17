"use server";

import { createClient } from "@/lib/supabase/server";
import {
  abrirCheckoutDeInvitacion,
  sePuedeCobrarInvitacion,
} from "@/lib/pagos/checkout-invitaciones";
import { SIN_STRIPE, type ResultadoPago } from "@/lib/pagos/checkout";
import { ESTADOS_COBRABLES } from "@/lib/pagos/invitaciones-pagadas";
import { resolverPaquete } from "@/lib/paquetes-invitaciones";

/**
 * PAGAR UNA INVITACIÓN DIGITAL CON TARJETA.
 *
 * El hermano de `iniciarPagoDelPaquete` (/lealtad/planes/pago-actions),
 * y mucho más corto por una razón de fondo: acá NO nace nada. El pedido
 * ya existe —lo creó el formulario del paso anterior con su precio
 * puesto por la base (0087)— así que lo único que falta es cobrarlo.
 * No hay solicitud que reservar, ni negocio que crear, ni plan que
 * activar.
 *
 * ------------------------------------------------------------------
 * LO ÚNICO QUE VIAJA DESDE EL NAVEGADOR ES EL ID DEL PEDIDO
 * ------------------------------------------------------------------
 * Ni el monto, ni el paquete, ni el correo. El monto se lee del pedido
 * acá y el webhook lo vuelve a leer del pedido para confirmarlo. Es la
 * misma regla de la 0087 —«el precio lo pone la base»— sostenida
 * también en el camino de la tarjeta: si el monto viajara en el
 * formulario, se reabriría exactamente el agujero que esa migración
 * cerró, y esta vez con la tarjeta de por medio.
 *
 * ------------------------------------------------------------------
 * DE QUIÉN ES EL PEDIDO: LO DECIDE LA RLS
 * ------------------------------------------------------------------
 * El pedido se lee con la SESIÓN de la persona, no con la llave de
 * servicio. La política de la 0075 («El cliente ve sus pedidos») hace
 * que un id ajeno simplemente no devuelva nada, sin que este archivo
 * tenga que comparar `cliente_id` a mano — comparaciones que se olvidan.
 *
 * ------------------------------------------------------------------
 * EL SINPE NO SE TOCA
 * ------------------------------------------------------------------
 * Este archivo es TODO lo que agrega la tarjeta a esta pantalla. Sin
 * llaves de Stripe la página no dibuja el botón y el depósito con
 * comprobante queda exactamente como estaba.
 */
export async function iniciarPagoDeInvitacion(pedidoId: string): Promise<ResultadoPago> {
  // Se pregunta antes de leer nada: sin llaves no tiene sentido ir a la
  // base para terminar diciendo que no se puede.
  if (!sePuedeCobrarInvitacion()) return { ok: false, motivo: SIN_STRIPE };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "Iniciá sesión para pagar." };

  const { data: pedido } = await supabase
    .from("pedidos_invitacion")
    .select("id, paquete, monto_crc, estado, nombre_evento")
    .eq("id", pedidoId)
    .maybeSingle();

  // No existe, o no es suyo: la RLS no distingue los dos casos, y está
  // bien que no lo haga — a quien no es dueño no se le confirma que ese
  // pedido existe.
  if (!pedido) return { ok: false, motivo: "No encontramos ese pedido." };

  if (!(ESTADOS_COBRABLES as readonly string[]).includes(String(pedido.estado))) {
    return { ok: false, motivo: "Ese pedido ya no está esperando pago." };
  }

  // `monto_crc` es la única fuente del monto. Un pedido viejo que no lo
  // tenga NO se cobra con tarjeta calculando el precio acá: eso sería
  // volver a ponerle el precio a TypeScript. Se le ofrece el SINPE, que
  // pasa por una persona.
  const monto = Number(pedido.monto_crc);
  if (!Number.isFinite(monto) || monto <= 0) {
    console.error(
      `[invitaciones] El pedido ${pedidoId} no tiene monto_crc; no se puede cobrar con tarjeta.`,
    );
    return {
      ok: false,
      motivo: "No pudimos calcular el monto de tu pedido — pagá por SINPE y lo resolvemos.",
    };
  }

  const paquete = resolverPaquete(String(pedido.paquete));
  const evento = String(pedido.nombre_evento ?? "").trim();
  // Lo que la persona lee en la línea del cobro y después en el estado
  // de cuenta de su tarjeta. Que diga de qué fiesta es evita el reclamo
  // de «no reconozco este cargo».
  const descripcion = [
    `Invitación digital ${paquete?.nombre ?? String(pedido.paquete)}`,
    evento,
  ]
    .filter(Boolean)
    .join(" · ");

  return abrirCheckoutDeInvitacion({
    pedidoId: String(pedido.id),
    montoCrc: monto,
    descripcion,
    correo: user.email ?? null,
    volverA: `/invitaciones/pago/${pedidoId}`,
  });
}
