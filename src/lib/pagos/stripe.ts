import Stripe from "stripe";

/**
 * EL CLIENTE DE STRIPE, y la verificación de la firma del webhook.
 *
 * Mismo patrón que `credencialesGoogleDelEntorno()` en
 * src/lib/wallet/google.ts: sin llave, devuelve null. Todo lo que
 * dependa de Stripe pregunta primero y, si no hay, ni se dibuja el
 * botón.
 *
 * ------------------------------------------------------------------
 * POR QUÉ «NULL SI NO HAY LLAVE» ES UNA DECISIÓN Y NO UNA COMODIDAD
 * ------------------------------------------------------------------
 * Los planes de pago se compran HOY por SINPE con comprobante, y ese
 * camino se queda: muchas tarjetas costarricenses vienen bloqueadas
 * para compras internacionales y la LLC cobra desde Estados Unidos.
 *
 * O sea que Stripe es la segunda opción, no la única. Si este módulo
 * lanzara al no encontrar la llave, un despliegue con la variable mal
 * escrita tumbaría la pantalla de planes ENTERA y se llevaría puesto
 * también el SINPE — que no tiene nada que ver. Devolviendo null, lo
 * único que pasa es que no aparece el botón de tarjeta.
 */

let cache: Stripe | null = null;

export function stripeDelEntorno(): Stripe | null {
  const llave = process.env.STRIPE_SECRET_KEY?.trim();
  if (!llave) return null;
  // Un solo cliente por proceso: cada `new Stripe()` arma su propio
  // agente HTTP con su pool de conexiones.
  if (!cache) {
    cache = new Stripe(llave, {
      // Sin `apiVersion`: se usa la que el SDK trae pinneada, que es la
      // que sus tipos describen. Fijar acá una versión distinta de la
      // del paquete es cómo se consiguen respuestas que no calzan con
      // los tipos, y en pagos eso se descubre en producción.
      appInfo: { name: "Bookea", url: "https://www.bookea.lat" },
    });
  }
  return cache;
}

/** ¿Se puede cobrar con tarjeta en este servidor? */
export function hayStripe(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim();
}

/**
 * EL ÚNICO PORTÓN DEL WEBHOOK.
 *
 * Devuelve el evento solo si la firma es de Stripe. Cualquier otra
 * cosa —sin secreto configurado, sin cabecera, firma que no calza,
 * cuerpo alterado, evento viejo (Stripe tolera 5 minutos)— devuelve
 * null, y el que llama contesta 400 sin escribir absolutamente nada.
 *
 * ------------------------------------------------------------------
 * EL CUERPO TIENE QUE VENIR CRUDO
 * ------------------------------------------------------------------
 * `cuerpo` es el texto TAL CUAL llegó: en App Router, `await
 * req.text()`. Si se hace `req.json()` y después se vuelve a
 * serializar, el resultado es JSON válido pero byte a byte distinto
 * —el orden de las llaves, los espacios, los decimales— y la firma no
 * valida NUNCA. Es el error clásico de este endpoint, y el síntoma
 * («todos los eventos dan 400») no apunta para nada al parseo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ NO SE USA EL CLIENTE DE ARRIBA
 * ------------------------------------------------------------------
 * `Stripe.webhooks` es estático: verificar una firma es HMAC-SHA256
 * contra el signing secret y no necesita la llave secreta de la
 * cuenta. Así, un servidor al que le falte `STRIPE_SECRET_KEY` igual
 * rechaza bien lo que no viene de Stripe, en vez de reventar antes de
 * mirar la firma.
 *
 * El secreto entra por parámetro (con el entorno como default) para
 * poder probar esto de verdad: el test firma un cuerpo con
 * `Stripe.webhooks.generateTestHeaderString` y comprueba las dos
 * mitades — que la firma buena pasa y que la mala no.
 */
export function verificarEventoStripe(
  cuerpo: string,
  firma: string | null | undefined,
  secreto: string | null | undefined = process.env.STRIPE_WEBHOOK_SECRET,
): Stripe.Event | null {
  const llave = secreto?.trim();
  if (!llave || !firma) return null;
  try {
    return Stripe.webhooks.constructEvent(cuerpo, firma, llave);
  } catch {
    // A propósito sin distinguir el motivo: al que manda una firma
    // inválida no se le explica por qué no le sirvió.
    return null;
  }
}

/** ¿Está configurado el webhook? Sin esto no se puede activar nada. */
export function haySecretoDeWebhook(): boolean {
  return !!process.env.STRIPE_WEBHOOK_SECRET?.trim();
}

/**
 * El sitio, para las URLs de vuelta de Checkout y del Portal.
 *
 * Mismo default que el resto del repo (`https://www.bookea.lat`). Ojo
 * con el apex sin `www`: los pases de Wallet ya se quedaron mudos una
 * vez por esa diferencia.
 */
export function sitioBase(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (url || "https://www.bookea.lat").replace(/\/+$/, "");
}
