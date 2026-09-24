import "server-only";
import type Stripe from "stripe";
import { CLAVE_PRODUCTO, centavosDeColones } from "@/lib/pagos/invitaciones-pagadas";
import { stripeDelEntorno } from "@/lib/pagos/stripe";
import type { PaqueteACobrar } from "@/lib/celebrar/creditos";
import { CLAVE_CREDITOS, CLAVE_DUENO, CLAVE_PAQUETE, CLAVE_PRECIO, PRODUCTO_CELEBRAR_CREDITOS, datosDePagoDeCreditos, type DatosPagoCreditos } from "./creditos-pagados";

/**
 * ABRIR STRIPE CHECKOUT PARA UN PAQUETE DE CRÉDITOS.
 *
 * Hermano de `abrirCheckoutDeInvitacion` (src/lib/pagos) y con las
 * mismas reglas: acá no se acredita nada —eso lo hace el webhook o la
 * verificación de la sesión contra la API—, el contexto lo escribe el
 * SERVIDOR (el dueño y el paquete van en la metadata después de saber
 * quién está logueado), y no se declara `payment_method_types` para que
 * Apple Pay / Google Pay salgan solos.
 *
 * El monto sale de `PAQUETES` (lib/celebrar/creditos.ts), inline con
 * `price_data`: son tres paquetes que el dueño va a mover mientras
 * calibra precios, y un `price_id` por paquete sería una variable de
 * entorno por cada cambio.
 */
export type ResultadoCheckout = { ok: true; url: string } | { ok: false; motivo: string };

export const SIN_STRIPE_CELEBRAR = "El pago con tarjeta no está disponible en este servidor. Escribinos y te cargamos los créditos a mano.";

export function sePuedenComprarCreditos(): boolean {
  return !!stripeDelEntorno();
}

export async function abrirCheckoutDeCreditos(ctx: {
  ownerId: string;
  correo: string | null;
  /** El paquete YA resuelto por el servidor (público, o partner con su descuento). */
  paquete: PaqueteACobrar;
  /** URL ABSOLUTA de /app/creditos en el host de la visita. */
  volverA: string;
}): Promise<ResultadoCheckout> {
  const stripe = stripeDelEntorno();
  if (!stripe) return { ok: false, motivo: SIN_STRIPE_CELEBRAR };

  const { paquete } = ctx;
  if (!Number.isFinite(paquete.precioCRC) || paquete.precioCRC <= 0) return { ok: false, motivo: "No pudimos calcular el precio del paquete." };

  const marca: Record<string, string> = {
    [CLAVE_PRODUCTO]: PRODUCTO_CELEBRAR_CREDITOS,
    [CLAVE_DUENO]: ctx.ownerId,
    [CLAVE_PAQUETE]: paquete.id,
    [CLAVE_CREDITOS]: String(paquete.creditos),
    [CLAVE_PRECIO]: String(paquete.precioCRC),
  };
  const separador = ctx.volverA.includes("?") ? "&" : "?";

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "crc",
            unit_amount: centavosDeColones(paquete.precioCRC),
            product_data: {
              name: paquete.nombre,
              description: paquete.partner ? "Paquete mayorista del programa de partners. Los créditos no vencen." : "Los créditos no vencen.",
            },
          },
        },
      ],
      client_reference_id: ctx.ownerId,
      customer_email: ctx.correo ?? undefined,
      metadata: marca,
      // La copia en el PaymentIntent: los eventos de `payment_intent.*`
      // no traen la metadata de la sesión, y un reembolso tiene que
      // saber de quién era.
      payment_intent_data: { metadata: marca },
      locale: "es-419",
      // Stripe reemplaza el marcador por el id de la sesión: con él la
      // vuelta verifica el pago contra la API y acredita al instante.
      success_url: `${ctx.volverA}${separador}pago=listo&sesion={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ctx.volverA}${separador}pago=cancelado`,
    });
    if (!sesion.url) return { ok: false, motivo: "Stripe no devolvió la página de pago." };
    return { ok: true, url: sesion.url };
  } catch (e) {
    console.error("[celebrar] No se pudo crear el Checkout de créditos:", e);
    return { ok: false, motivo: "No se pudo abrir el pago con tarjeta. Probá de nuevo en un momento." };
  }
}

/**
 * LA VUELTA DEL NAVEGADOR: lee la sesión EN STRIPE (no en la URL) y la
 * devuelve como compra de créditos solo si es de CELEBRAR y de esta
 * cuenta. null = no es nuestra, no existe, o no es de quien pregunta.
 */
export async function leerSesionDeCompra(sesionId: string, ownerId: string): Promise<DatosPagoCreditos | null> {
  const stripe = stripeDelEntorno();
  if (!stripe || !/^cs_[A-Za-z0-9_]+$/.test(sesionId)) return null;
  let sesion: Stripe.Checkout.Session;
  try {
    sesion = await stripe.checkout.sessions.retrieve(sesionId);
  } catch {
    return null;
  }
  const pago = datosDePagoDeCreditos(sesion as unknown as Record<string, unknown>);
  if (!pago || pago.ownerId !== ownerId) return null;
  return pago;
}
