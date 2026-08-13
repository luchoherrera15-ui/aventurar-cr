"use server";

import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sitioBase, stripeDelEntorno } from "@/lib/pagos/stripe";
import { esPeriodo, esPlanConCobro, precioDePlan } from "@/lib/pagos/precios";
import { suscripcionDelNegocio } from "@/lib/pagos/puerta-supabase";

/**
 * PAGAR EL PAQUETE CON TARJETA, y administrar la suscripción.
 *
 * Dos acciones y nada más: abrir Stripe Checkout y abrir el Customer
 * Portal. Las dos devuelven una URL a la que el navegador se va; el
 * resto —cobrar, reintentar, avisar del vencimiento de la tarjeta,
 * cambiar de plan, cancelar— lo hace Stripe.
 *
 * ------------------------------------------------------------------
 * LO QUE ACÁ NO PASA
 * ------------------------------------------------------------------
 * Acá NO se activa ningún plan. Estas acciones solo abren una puerta;
 * el plan lo escribe el webhook cuando Stripe confirma el cobro con un
 * evento firmado (src/app/api/stripe/webhook/route.ts). Que la persona
 * vuelva a la pantalla de éxito no prueba absolutamente nada: esa URL
 * se puede escribir a mano.
 *
 * ------------------------------------------------------------------
 * Y EL SINPE SIGUE INTACTO
 * ------------------------------------------------------------------
 * Si no hay llaves de Stripe, estas acciones contestan que no está
 * disponible y la pantalla no dibuja el botón de tarjeta. El camino de
 * siempre —depósito por SINPE con comprobante, aprobado a mano desde
 * /admin/complementos— no depende de nada de este archivo. Muchas
 * tarjetas costarricenses vienen bloqueadas para compras
 * internacionales y la LLC cobra desde Estados Unidos: el SINPE no es
 * un respaldo temporal, es la mitad del negocio.
 */

export type ResultadoPago = { ok: true; url: string } | { ok: false; motivo: string };

const SIN_STRIPE = "El pago con tarjeta no está disponible por ahora — podés pagar por SINPE.";

/**
 * Abre Stripe Checkout para un paquete.
 *
 * QUIÉN PUEDE: solo el dueño del negocio (o un admin de Bookea).
 * `verificarAccesoRancho` es la función que NO incluye colaboradores —
 * la 0116 las separó justamente para que sumar una acción al panel no
 * le diera al encargado acceso a la plata. Comprar un plan es plata.
 *
 * Y se comprueba EN EL SERVIDOR, no en el formulario: una petición
 * armada a mano no pasa por la pantalla. Sin esto, cualquiera con
 * sesión podría abrir un checkout con el `client_reference_id` de un
 * negocio ajeno y —peor que regalarle un plan— dejar el cobro de su
 * tarjeta atado a un negocio que no es suyo.
 */
export async function iniciarPagoConTarjeta(datos: {
  ranchoId: string;
  plan: string;
  periodo: string;
}): Promise<ResultadoPago> {
  if (!esPlanConCobro(datos.plan)) {
    // Incluye el plan `prueba`: es gratis y se activa solo, nunca pasa
    // por Stripe (regla explícita del dueño).
    return { ok: false, motivo: "Ese paquete no se cobra con tarjeta." };
  }
  if (!esPeriodo(datos.periodo)) {
    return { ok: false, motivo: "Elegí si querés pagarlo por mes o por año." };
  }

  const acceso = await verificarAccesoRancho(datos.ranchoId);
  if (!acceso.user) return { ok: false, motivo: "Iniciá sesión para pagar." };
  if (!acceso.ok) return { ok: false, motivo: "Solo el dueño del negocio puede pagar el paquete." };

  const stripe = stripeDelEntorno();
  const precio = precioDePlan(datos.plan, datos.periodo);
  if (!stripe || !precio) return { ok: false, motivo: SIN_STRIPE };

  // La cuenta (0134) y el cliente de Stripe que este negocio ya tenga.
  // Reusar el `customer` importa: sin esto, cada compra crearía un
  // cliente nuevo en Stripe y el mismo negocio terminaría con tres
  // tarjetas guardadas en tres fichas que no se ven entre sí.
  const admin = createAdminClient();
  let clienteStripe: string | null = null;
  let cuentaId: string | null = null;
  if (admin) {
    const { data: cuenta } = await admin
      .from("cuentas")
      .select("id")
      .eq("rancho_id", datos.ranchoId)
      .maybeSingle();
    cuentaId = (cuenta?.id as string | null) ?? null;

    const previa = await suscripcionDelNegocio(admin, { ranchoId: datos.ranchoId, cuentaId });
    clienteStripe = previa?.clienteStripe || null;
  }

  // Lo que viaja a Stripe para poder devolver el cobro a su negocio.
  // Va en la SESIÓN y también en la SUSCRIPCIÓN: los eventos
  // `customer.subscription.*` no llevan `client_reference_id`, así que
  // sin `subscription_data.metadata` una renovación llegaría sin decir
  // de quién es.
  const marca: Record<string, string> = {
    rancho_id: datos.ranchoId,
    plan: datos.plan,
    periodo: datos.periodo,
  };
  if (cuentaId) marca.cuenta_id = cuentaId;

  const volverA = `${sitioBase()}/lealtad/panel/${datos.ranchoId}`;

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: precio, quantity: 1 }],
      client_reference_id: datos.ranchoId,
      // Cliente existente si lo hay; si no, se le precarga el correo
      // para que no lo escriba de nuevo.
      ...(clienteStripe
        ? { customer: clienteStripe }
        : { customer_email: acceso.user.email ?? undefined }),
      metadata: marca,
      subscription_data: { metadata: marca },
      allow_promotion_codes: true,
      locale: "es-419",
      // La página de éxito NO activa nada: solo dice que el pago entró
      // y que el plan aparece en cuanto Stripe lo confirme.
      success_url: `${volverA}?pago=listo#plan`,
      cancel_url: `${volverA}?pago=cancelado#plan`,
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

/**
 * Abre el Customer Portal de Stripe: cambiar tarjeta, cambiar de plan,
 * ver facturas y cancelar.
 *
 * No construimos ninguna de esas pantallas a propósito. Son gratis,
 * están mejor mantenidas que cualquier cosa que escribamos, y cada una
 * que hiciéramos nosotros sería un lugar más donde un error toca plata
 * de verdad.
 */
export async function abrirPortalDeFacturacion(ranchoId: string): Promise<ResultadoPago> {
  const acceso = await verificarAccesoRancho(ranchoId);
  if (!acceso.user) return { ok: false, motivo: "Iniciá sesión." };
  if (!acceso.ok) {
    return { ok: false, motivo: "Solo el dueño del negocio puede ver la facturación." };
  }

  const stripe = stripeDelEntorno();
  const admin = createAdminClient();
  if (!stripe || !admin) return { ok: false, motivo: SIN_STRIPE };

  const { data: cuenta } = await admin
    .from("cuentas")
    .select("id")
    .eq("rancho_id", ranchoId)
    .maybeSingle();

  const suscripcion = await suscripcionDelNegocio(admin, {
    ranchoId,
    cuentaId: (cuenta?.id as string | null) ?? null,
  });
  if (!suscripcion?.clienteStripe) {
    return {
      ok: false,
      motivo: "Este negocio no tiene una suscripción con tarjeta.",
    };
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: suscripcion.clienteStripe,
      return_url: `${sitioBase()}/lealtad/panel/${ranchoId}#plan`,
    });
    return { ok: true, url: portal.url };
  } catch (e) {
    // El error más probable acá es que el Customer Portal no esté
    // activado en el panel de Stripe (Settings → Billing → Customer
    // portal). Se dice sin tecnicismos y queda el detalle en el log.
    console.error("[stripe] No se pudo abrir el Customer Portal:", e);
    return {
      ok: false,
      motivo: "No se pudo abrir la facturación. Escribinos y lo resolvemos.",
    };
  }
}
