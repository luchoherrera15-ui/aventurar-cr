"use server";

import { verificarAccesoRancho } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sitioBase, stripeDelEntorno } from "@/lib/pagos/stripe";
import { esPeriodo, esPlanConCobro } from "@/lib/pagos/precios";
import {
  abrirCheckoutDeSuscripcion,
  SIN_STRIPE,
  type ResultadoPago,
} from "@/lib/pagos/checkout";
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

    // ⚠️ CAMBIAR DE PAQUETE NO ES UNA COMPRA NUEVA.
    //    Los dos estados son los que `daDerechoAlPlan` considera
    //    vivos: si hay una suscripción andando, abrir un Checkout la
    //    duplicaría en vez de reemplazarla. Al portal, que sabe hacer
    //    el prorrateo y mover la fecha de renovación.
    const yaPaga = previa?.estado === "activa" || previa?.estado === "en_prueba";
    if (yaPaga) return abrirPortalDeFacturacion(datos.ranchoId);
  }

  // La sesión la arma `abrirCheckoutDeSuscripcion`, que es la misma que
  // usa /lealtad/planes: dos sesiones de cobro armadas por separado se
  // desincronizan, y la diferencia se ve en la factura de un cliente.
  //
  // Sin `solicitudId`: acá el negocio EXISTE, y este cobro es del
  // negocio. El alta —cobrar antes de que el negocio exista— solo pasa
  // en la página de paquetes.
  return abrirCheckoutDeSuscripcion({
    plan: datos.plan,
    periodo: datos.periodo,
    correo: acceso.user.email ?? null,
    clienteStripe,
    ranchoId: datos.ranchoId,
    cuentaId,
    solicitudId: null,
    volverA: `/lealtad/panel/${datos.ranchoId}`,
    ancla: "plan",
  });
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
