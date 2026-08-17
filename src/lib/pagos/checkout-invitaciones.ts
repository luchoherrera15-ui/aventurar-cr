import "server-only";
import { SIN_STRIPE, type ResultadoPago } from "./checkout";
import {
  CLAVE_PEDIDO,
  CLAVE_PRODUCTO,
  MONEDA_INVITACIONES,
  PRODUCTO_INVITACION,
  centavosDeColones,
} from "./invitaciones-pagadas";
import { sitioBase, stripeDelEntorno } from "./stripe";

/**
 * ABRIR STRIPE CHECKOUT PARA UNA INVITACIÓN — el único lugar donde se
 * arma el cobro suelto de un pedido.
 *
 * Hermano de `abrirCheckoutDeSuscripcion` (checkout.ts) y con las
 * mismas dos reglas de fondo:
 *
 *   · ACÁ NO SE ACTIVA NADA. Esta función abre una puerta. El pedido lo
 *     marca pagado el webhook cuando Stripe manda un evento FIRMADO. Que
 *     el navegador vuelva a la `success_url` no prueba nada: esa URL se
 *     teclea a mano, y si activara algo cualquiera se regalaría su
 *     invitación.
 *   · EL CONTEXTO LO ESCRIBE EL SERVIDOR. El pedido viaja en la
 *     metadata y en `client_reference_id` después de que quien llama
 *     comprobó que ese pedido es de quien paga. Del navegador no sale
 *     nada más que un id.
 *
 * ------------------------------------------------------------------
 * POR QUÉ `price_data` Y NO UN `price_id`
 * ------------------------------------------------------------------
 * Lealtad tiene seis precios fijos y se mapean por variables de entorno
 * (`STRIPE_PRICE_<PLAN>_<PERIODO>`). Las invitaciones son otra cosa: el
 * catálogo tiene packs, sueltos, el álbum como complemento y una promo
 * con fecha de vencimiento, y el total de UN pedido depende de qué
 * marcó el cliente. Serían decenas de precios en Stripe y una variable
 * por cada uno.
 *
 * Así que el monto viaja inline, y sale de `pedidos_invitacion.monto_crc`
 * —la base, la regla de la 0087— que es el mismo número que la pantalla
 * muestra y que el SINPE pide depositar. El webhook lo vuelve a leer de
 * la base para confirmar que lo cobrado es lo que el pedido vale.
 *
 * ------------------------------------------------------------------
 * APPLE PAY Y GOOGLE PAY SALEN SOLOS — SI NO SE LOS APAGA
 * ------------------------------------------------------------------
 * Acá NO se declara `payment_method_types`. Es deliberado y es la parte
 * fácil de romper: en el momento en que esa lista se escribe a mano
 * (`["card"]`, por ejemplo), Checkout deja de resolver los métodos
 * automáticamente y las billeteras DESAPARECEN de la pantalla, junto
 * con cualquier método que el dueño active en el panel de Stripe más
 * adelante. Sin la lista, Stripe muestra tarjeta + Apple Pay + Google
 * Pay según el dispositivo, sin una línea de código de nuestro lado.
 */

export type ContextoDeCobroInvitacion = {
  pedidoId: string;
  /** El total EN COLONES, tal como lo guarda la base. */
  montoCrc: number;
  /** Lo que el cliente ve en la línea del cobro ("Invitación Premium"). */
  descripcion: string;
  /** Para precargarle el correo en Checkout. */
  correo: string | null;
  /** A dónde vuelve el navegador. Se le agrega `?pago=listo|cancelado`. */
  volverA: string;
};

/** ¿Se puede cobrar una invitación con tarjeta en este servidor? */
export function sePuedeCobrarInvitacion(): boolean {
  return !!stripeDelEntorno();
}

export async function abrirCheckoutDeInvitacion(
  ctx: ContextoDeCobroInvitacion,
): Promise<ResultadoPago> {
  const stripe = stripeDelEntorno();
  if (!stripe) return { ok: false, motivo: SIN_STRIPE };

  // Un cobro sin pedido no se abre: sería plata entrando sin nada a qué
  // atribuirla, y atarla después es a mano y con el cliente esperando.
  if (!ctx.pedidoId) {
    return { ok: false, motivo: "No sabemos de qué pedido es este pago." };
  }
  // Y un monto que no es un monto tampoco. Sin esto, un `monto_crc` en
  // cero abriría un Checkout de ₡0 que Stripe da por pagado.
  if (!Number.isFinite(ctx.montoCrc) || ctx.montoCrc <= 0) {
    return {
      ok: false,
      motivo: "No pudimos calcular el monto de tu pedido. Escribinos por el chat.",
    };
  }

  const marca: Record<string, string> = {
    [CLAVE_PRODUCTO]: PRODUCTO_INVITACION,
    [CLAVE_PEDIDO]: ctx.pedidoId,
  };

  const base = ctx.volverA.startsWith("http") ? ctx.volverA : `${sitioBase()}${ctx.volverA}`;
  const separador = base.includes("?") ? "&" : "?";

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: MONEDA_INVITACIONES,
            unit_amount: centavosDeColones(ctx.montoCrc),
            product_data: { name: ctx.descripcion },
          },
        },
      ],
      client_reference_id: ctx.pedidoId,
      customer_email: ctx.correo ?? undefined,
      metadata: marca,
      // La copia en el PaymentIntent: los eventos de `payment_intent.*`
      // no llevan la metadata de la sesión, y si algún día hay que
      // rastrear un reembolso, ahí está de qué pedido era.
      payment_intent_data: { metadata: marca },
      locale: "es-419",
      // Sin `allow_promotion_codes`, al revés que Lealtad: un cupón
      // cambiaría el total y el webhook mandaría el pedido a revisión
      // humana por no cuadrar con `monto_crc`. Los descuentos de
      // invitaciones viven en el catálogo (la promo de lanzamiento), o
      // sea en el monto que la base ya calculó.
      success_url: `${base}${separador}pago=listo`,
      cancel_url: `${base}${separador}pago=cancelado`,
    });

    if (!sesion.url) return { ok: false, motivo: "Stripe no devolvió la página de pago." };
    return { ok: true, url: sesion.url };
  } catch (e) {
    console.error("[stripe] No se pudo crear el Checkout de la invitación:", e);
    return {
      ok: false,
      motivo: "No se pudo abrir el pago con tarjeta. Probá de nuevo o pagá por SINPE.",
    };
  }
}
