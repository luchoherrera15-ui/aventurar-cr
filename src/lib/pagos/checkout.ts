import "server-only";
import type { PlanId } from "@/lib/lealtad/planes";
import { precioDePlan, type Periodo } from "./precios";
import { sitioBase, stripeDelEntorno } from "./stripe";

/**
 * ABRIR STRIPE CHECKOUT — el único lugar donde se arma una sesión de
 * cobro.
 *
 * Lo llaman los dos botones de tarjeta que existen, y son dos casos muy
 * distintos:
 *
 *   · el PANEL de un negocio que ya tiene el módulo, que sube o cambia
 *     de paquete (`/lealtad/panel/[id]/suscripcion-actions.ts`);
 *   · la PÁGINA DE PAQUETES, donde compra alguien que puede no tener
 *     negocio todavía (`/lealtad/planes/pago-actions.ts`).
 *
 * Vive en un archivo propio porque lo que NO puede pasar es que las dos
 * sesiones se armen distinto. Si un día se agrega un campo —un cupón,
 * un impuesto, un `trial_period_days`— y solo se agrega en uno, el
 * síntoma aparece en la factura de un cliente y no en ninguna pantalla.
 *
 * ------------------------------------------------------------------
 * ACÁ NO SE ACTIVA NADA, Y ESO ES TODO EL DISEÑO
 * ------------------------------------------------------------------
 * Esta función abre una puerta y nada más. El plan lo escribe el
 * webhook cuando Stripe manda un evento FIRMADO
 * (src/app/api/stripe/webhook/route.ts). Que el navegador vuelva a la
 * `success_url` no prueba nada: esa URL se teclea a mano, y si activara
 * algo cualquiera se regalaría el paquete de $89.
 *
 * ------------------------------------------------------------------
 * EL CONTEXTO QUE VIAJA, Y POR QUÉ VIAJA DOS VECES
 * ------------------------------------------------------------------
 * De quién es el cobro va en la SESIÓN (`client_reference_id` +
 * `metadata`) y también en la SUSCRIPCIÓN (`subscription_data.metadata`).
 * No es redundancia: los eventos `customer.subscription.*` —los de la
 * renovación, la mora y la cancelación— no llevan `client_reference_id`
 * ni la metadata de la sesión. Sin la copia en la suscripción, la
 * segunda renovación llegaría sin decir de quién es.
 *
 * Todo lo que se manda lo escribe el SERVIDOR después de comprobar
 * quién es quien paga. Nada de esto sale del navegador.
 */

export type ResultadoPago = { ok: true; url: string } | { ok: false; motivo: string };

export const SIN_STRIPE =
  "El pago con tarjeta no está disponible por ahora — podés pagar por SINPE.";

export type ContextoDeCobro = {
  plan: PlanId;
  periodo: Periodo;
  /** Para precargarle el correo a quien todavía no es cliente de Stripe. */
  correo: string | null;
  /** El `customer` que este negocio ya tenga. Reusarlo evita fichas duplicadas. */
  clienteStripe: string | null;
  /** El negocio, si ya existe. */
  ranchoId: string | null;
  cuentaId: string | null;
  /**
   * La solicitud de alta (0130) que está esperando este cobro, cuando el
   * negocio TODAVÍA NO EXISTE. El webhook la convierte en negocio recién
   * cuando Stripe confirma.
   */
  solicitudId: string | null;
  /** A dónde vuelve el navegador. Se le agrega `?pago=listo|cancelado`. */
  volverA: string;
  /** El ancla a la que baja al volver («plan»), sin la almohadilla. */
  ancla?: string;
};

/** ¿Se puede cobrar este paquete y período en este servidor? */
export function sePuedeCobrar(plan: PlanId, periodo: Periodo): boolean {
  return !!stripeDelEntorno() && precioDePlan(plan, periodo) !== null;
}

export async function abrirCheckoutDeSuscripcion(
  ctx: ContextoDeCobro,
): Promise<ResultadoPago> {
  const stripe = stripeDelEntorno();
  const precio = precioDePlan(ctx.plan, ctx.periodo);
  if (!stripe || !precio) return { ok: false, motivo: SIN_STRIPE };

  // Sin nada a qué atribuir el cobro no se abre nada: una suscripción
  // huérfana es plata cobrada que nadie sabe a quién activarle, y
  // atarla después es a mano y con el cliente esperando.
  if (!ctx.ranchoId && !ctx.cuentaId && !ctx.solicitudId) {
    return { ok: false, motivo: "No sabemos para qué negocio es este pago." };
  }

  const marca: Record<string, string> = { plan: ctx.plan, periodo: ctx.periodo };
  if (ctx.ranchoId) marca.rancho_id = ctx.ranchoId;
  if (ctx.cuentaId) marca.cuenta_id = ctx.cuentaId;
  // `solicitud_id` SOLO cuando el negocio no existe: es lo que le dice
  // al webhook «esto es un alta, creá el negocio». Ver el despacho de
  // `checkout.session.completed` en suscripciones.ts.
  if (ctx.solicitudId) marca.solicitud_id = ctx.solicitudId;

  const base = ctx.volverA.startsWith("http") ? ctx.volverA : `${sitioBase()}${ctx.volverA}`;
  const separador = base.includes("?") ? "&" : "?";
  // El ancla va SIEMPRE al final: `…#plan?pago=listo` no es una query,
  // es parte del fragmento, y la página volvería sin saber que hubo pago.
  const ancla = ctx.ancla ? `#${ctx.ancla}` : "";

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: precio, quantity: 1 }],
      // El negocio si lo hay; si no, la solicitud que espera el cobro.
      // Lo lee el webhook, pero SOLO como rancho cuando no hay
      // `solicitud_id` en la metadata — un id de solicitud no es un id
      // de negocio y confundirlos activaría el plan en el lugar
      // equivocado.
      client_reference_id: ctx.ranchoId ?? ctx.solicitudId ?? undefined,
      ...(ctx.clienteStripe
        ? { customer: ctx.clienteStripe }
        : { customer_email: ctx.correo ?? undefined }),
      metadata: marca,
      subscription_data: { metadata: marca },
      allow_promotion_codes: true,
      locale: "es-419",
      success_url: `${base}${separador}pago=listo${ancla}`,
      cancel_url: `${base}${separador}pago=cancelado${ancla}`,
    });

    if (!sesion.url) return { ok: false, motivo: "Stripe no devolvió la página de pago." };
    return { ok: true, url: sesion.url };
  } catch (e) {
    console.error("[stripe] No se pudo crear la sesión de Checkout:", e);
    return {
      ok: false,
      motivo: "No se pudo abrir el pago con tarjeta. Probá de nuevo o pagá por SINPE.",
    };
  }
}
