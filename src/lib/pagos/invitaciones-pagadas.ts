/**
 * EL COBRO DE UNA INVITACIÓN DIGITAL CON TARJETA — la parte que decide.
 *
 * Lógica pura: sin Stripe, sin Supabase, sin red. Misma separación que
 * `precios.ts` frente a `suscripciones.ts`, y por el mismo motivo — en
 * código que mueve plata, poder probarlo entero no es un lujo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO NO ES UNA SUSCRIPCIÓN
 * ------------------------------------------------------------------
 * Los paquetes de Lealtad se cobran en `mode: "subscription"`: hay un
 * `price_id` creado en Stripe, hay renovación, hay mora y hay corte.
 * Una invitación es un PAGO SUELTO (`mode: "payment"`): se cobra una
 * vez, no se renueva nunca, no se puede caer en mora y no hay nada que
 * apagar después. Por eso no pasa por `precios.ts` ni por el
 * interruptor de `corte.ts` — no tendrían qué hacer.
 *
 * ------------------------------------------------------------------
 * DE DÓNDE SALE EL PRECIO
 * ------------------------------------------------------------------
 * De `pedidos_invitacion.monto_crc`, o sea de la BASE, que es la regla
 * que puso la 0087 y que la 0091 extendió al álbum: lo único que viaja
 * desde el navegador es el id del pedido. El monto se lee del pedido
 * para ABRIR el cobro y se vuelve a leer del pedido para CONFIRMARLO —
 * y si los dos números no coinciden, el pedido va a revisión humana en
 * vez de darse por bueno.
 *
 * Y no hay `price_id` que mapear: el monto viaja como `price_data` en
 * la sesión. Un paquete nuevo se vende sin tocar una variable de Vercel.
 *
 * ------------------------------------------------------------------
 * LA MONEDA, Y POR QUÉ ES COLONES
 * ------------------------------------------------------------------
 * El pedido guarda `monto_crc` y es el número exacto que la pantalla le
 * muestra al cliente y que el SINPE le pide depositar. Cobrar la
 * tarjeta en esa misma moneda hace que los dos caminos cobren
 * LITERALMENTE lo mismo, sin un tipo de cambio en el medio que los
 * separe el día que se mueva.
 *
 * El colón NO es de las monedas sin decimales de Stripe (esas son el
 * yen, el guaraní, el won y compañía), así que el monto va en céntimos:
 * ₡44 900 son 4 490 000. Equivocarse acá es cobrar cien veces de más o
 * de menos, y por eso la conversión es una función con su prueba en vez
 * de un `* 100` suelto en medio de la sesión.
 */

/** La marca que distingue este cobro de uno de Lealtad. */
export const CLAVE_PRODUCTO = "bookea_producto";
export const PRODUCTO_INVITACION = "invitacion";
/** Dónde viaja el pedido dentro de la metadata de la sesión. */
export const CLAVE_PEDIDO = "pedido_id";

/**
 * Colones, la moneda del cobro. Constante y no variable de entorno a
 * propósito: cambiarla NO es cambiar un ajuste, es cambiar qué número
 * se le cobra a la tarjeta, y eso se hace con una migración del monto,
 * no con una variable.
 */
export const MONEDA_INVITACIONES = "crc";

/** ₡44 900 → 4 490 000 céntimos. El colón lleva dos decimales. */
export function centavosDeColones(colones: number): number {
  return Math.round(colones * 100);
}

/** Un pedido de invitación, con lo único que el cobro necesita saber. */
export type PedidoInvitacion = {
  id: string;
  /** Lo que la BASE dice que cuesta. Es el único precio que manda. */
  montoCrc: number | null;
  estado: string;
};

/**
 * Los estados en los que un pedido YA está cobrado. Un evento que
 * llegue sobre uno de estos no vuelve a cobrar ni a mandar correos.
 */
export const ESTADOS_YA_COBRADOS = ["pagado", "en_diseno", "entregado"] as const;

/** Y los estados en los que todavía se puede reclamar el cobro. */
export const ESTADOS_COBRABLES = ["pendiente_pago", "en_revision"] as const;

/** Lo que dice una sesión de Checkout de invitaciones, ya leída. */
export type DatosPagoInvitacion = {
  pedidoId: string;
  sesionStripe: string;
  /** Lo que Stripe COBRÓ, en la unidad mínima de `moneda`. */
  cobrado: number | null;
  moneda: string | null;
  /** `payment_status === "paid"`. Lo único que autoriza a activar. */
  pagado: boolean;
};

// ── Leer lo que manda Stripe, sin `any` ──────────────────────────────
//
// Los mismos dos lectores que usa `suscripciones.ts`, repetidos acá a
// propósito: importarlos de allá cerraría un ciclo entre los dos
// módulos (el motor ya importa este archivo), y son cinco renglones.

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * ¿Esta sesión de Checkout es el cobro de una invitación? Si lo es,
 * qué dice.
 *
 * null cuando NO lo es —una sesión de Lealtad, o cualquier otra cosa
 * que llegue a la misma cuenta de Stripe—, y también cuando dice serlo
 * pero le falta el pedido: sin pedido no hay nada que activar, y
 * adivinar cuál era sería inventar a quién se le entrega una invitación
 * pagada.
 *
 * La marca se lee de la metadata de la SESIÓN, que la escribe el
 * servidor al abrir el cobro (checkout-invitaciones.ts). Nunca sale del
 * navegador.
 */
export function datosDePagoDeInvitacion(
  sesion: Record<string, unknown>,
): DatosPagoInvitacion | null {
  const meta = objeto(sesion.metadata) ?? {};
  if (texto(meta[CLAVE_PRODUCTO]) !== PRODUCTO_INVITACION) return null;

  const sesionStripe = texto(sesion.id);
  // `client_reference_id` como respaldo del pedido: van los dos por la
  // misma razón por la que Lealtad manda el negocio dos veces — que un
  // solo campo perdido no deje un cobro sin dueño.
  const pedidoId = texto(meta[CLAVE_PEDIDO]) ?? texto(sesion.client_reference_id);
  if (!sesionStripe || !pedidoId) return null;

  return {
    pedidoId,
    sesionStripe,
    cobrado: numero(sesion.amount_total),
    moneda: texto(sesion.currency)?.toLowerCase() ?? null,
    // "paid" y nada más. "unpaid" es el medio de pago diferido que
    // todavía no acreditó, y "no_payment_required" sería un total en
    // cero — ninguno de los dos paga una invitación.
    pagado: texto(sesion.payment_status) === "paid",
  };
}

/**
 * Qué hacer con este cobro.
 *
 * `revisar` no es un error del cliente: la plata ENTRÓ y el pedido
 * queda registrado como pagado por tarjeta, solo que en `en_revision`
 * para que una persona lo mire antes de mandarlo a diseño. Es la misma
 * doctrina del resto del sistema —«cuando la duda cuesta plata, la duda
 * no activa»— aplicada sin castigar a quien ya pagó.
 */
export type VeredictoDeCobro =
  | { estado: "cobrar" }
  | {
      estado: "revisar";
      motivo: "sin_monto" | "moneda_distinta" | "monto_distinto";
      detalle: string;
    }
  | {
      estado: "ignorar";
      motivo: "sin_cobrar" | "sin_pedido" | "ya_cobrado" | "no_cobrable";
    };

export function decidirCobroDeInvitacion(d: {
  pago: DatosPagoInvitacion;
  /** null = ese pedido no existe en la base. */
  pedido: PedidoInvitacion | null;
}): VeredictoDeCobro {
  // Todavía no entró la plata. Pasa con los medios de pago diferidos:
  // Stripe manda el `completed` al elegirlos y el
  // `async_payment_succeeded` cuando acreditan. Este no activa nada, y
  // tampoco es un problema que haya que avisar.
  if (!d.pago.pagado) return { estado: "ignorar", motivo: "sin_cobrar" };

  // Entró un cobro para un pedido que no existe. Nadie tiene que perder
  // plata por esto: el que llama avisa y el evento queda entero en
  // `eventos_stripe`.
  if (!d.pedido) return { estado: "ignorar", motivo: "sin_pedido" };

  // Ya estaba cobrado: el segundo evento del mismo cobro, o un pedido
  // que el equipo dio por pagado a mano. No se toca ni se avisa.
  if ((ESTADOS_YA_COBRADOS as readonly string[]).includes(d.pedido.estado)) {
    return { estado: "ignorar", motivo: "ya_cobrado" };
  }

  // Y el que no está ni cobrado ni esperando plata: hoy eso es
  // `cancelado`. Entró un cobro por algo que ya no se iba a hacer —una
  // pestaña vieja que quedó abierta— y no se puede resucitar el pedido
  // por las malas: alguien tiene que hablar con esa persona y devolverle
  // la plata o rehacerle el pedido.
  if (!(ESTADOS_COBRABLES as readonly string[]).includes(d.pedido.estado)) {
    return { estado: "ignorar", motivo: "no_cobrable" };
  }

  // Un pedido viejo, de antes de que la base guardara el total, no se
  // puede verificar contra nada. Se cobra igual —la plata está— pero lo
  // mira una persona.
  if (d.pedido.montoCrc === null) {
    return {
      estado: "revisar",
      motivo: "sin_monto",
      detalle: "el pedido no tiene `monto_crc` con qué comparar lo cobrado",
    };
  }

  if (d.pago.moneda !== MONEDA_INVITACIONES) {
    return {
      estado: "revisar",
      motivo: "moneda_distinta",
      detalle: `se cobró en ${d.pago.moneda ?? "(sin moneda)"} y el pedido está en ${MONEDA_INVITACIONES}`,
    };
  }

  const esperado = centavosDeColones(d.pedido.montoCrc);
  if (d.pago.cobrado !== esperado) {
    return {
      estado: "revisar",
      motivo: "monto_distinto",
      detalle:
        `se cobraron ${d.pago.cobrado ?? 0} céntimos y el pedido vale ${esperado} ` +
        `(₡${d.pedido.montoCrc})`,
    };
  }

  return { estado: "cobrar" };
}
