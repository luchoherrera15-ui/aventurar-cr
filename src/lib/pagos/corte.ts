/**
 * ¿ESTE NEGOCIO SIGUE OPERANDO SU PROGRAMA?
 *
 * La decisión del dueño de Bookea, escrita en una función pura:
 *
 *   «Todo debe ser automático: una vez finaliza el MES, de una vez se
 *    cancela su suscripción y todo deja de funcionar hasta que
 *    renueven.»
 *
 * Acá adentro no hay Supabase, ni Stripe, ni reloj. Se recibe lo que
 * Stripe dice del cobro y se devuelve qué corresponde hacer. Por eso
 * cada caso —el que cancela el día 3, el que rebotó la tarjeta, el que
 * paga por SINPE— se puede fijar con una prueba en vez de esperar a
 * que pase en un negocio de verdad.
 *
 * ------------------------------------------------------------------
 * 1. SE CORTA AL FINAL DEL PERÍODO PAGADO, NUNCA AL CANCELAR
 * ------------------------------------------------------------------
 * Alguien que cancela el día 3 y pagó hasta el 30 opera hasta el 30.
 * No es cortesía: ese mes está pagado y quitárselo antes es quedarse
 * con plata cobrada.
 *
 * Stripe modela esto solo y no hay que llevar ninguna cuenta:
 *
 *   · cancelar desde el Portal deja `status: "active"` con
 *     `cancel_at_period_end: true` — el negocio SIGUE OPERANDO;
 *   · cuando el período termina de verdad, Stripe manda
 *     `customer.subscription.deleted` y ahí el status ya es
 *     `canceled` — recién ahí se apaga.
 *
 * O sea: quien decide el «cuándo» es el reloj de Stripe. Nosotros
 * nunca comparamos `periodo_fin` contra la hora del servidor, que es
 * de donde salen los cortes un día antes por zona horaria.
 *
 * ------------------------------------------------------------------
 * 2. EL PAGO FALLIDO NO ES UNA CANCELACIÓN
 * ------------------------------------------------------------------
 * Una tarjeta vencida es un ACCIDENTE, no una decisión. Stripe lo
 * sabe: pone la suscripción en `past_due` y reintenta durante días
 * (los «smart retries», ~3 semanas por defecto) mientras le manda
 * correos al cliente.
 *
 * Apagarle el programa a un negocio en el primer rebote es la forma
 * más rápida de perder un cliente que SÍ quería pagar: se entera
 * porque un cliente suyo no pudo sellar en el mostrador, por una
 * tarjeta que él habría cambiado en dos minutos si le avisaban.
 *
 * Así que `past_due` e `incomplete` AVISAN y no apagan.
 *
 * La única mora que sí apaga es `unpaid`, y la diferencia importa:
 * `unpaid` no es un rebote, es Stripe diciendo «agoté todos los
 * reintentos y dejé de intentar». A esa altura ya pasaron semanas de
 * correos y el período pagado terminó hace rato. Si `unpaid` no
 * cortara, un negocio que dejó de pagar operaría gratis para siempre
 * —Stripe no manda ningún evento más— y eso es justo lo contrario de
 * lo que se pidió.
 *
 * ------------------------------------------------------------------
 * 3. LA DUDA NO APAGA (igual que la duda no activa)
 * ------------------------------------------------------------------
 * Un `status` que este código no conoce —porque Stripe agregó uno
 * nuevo— no apaga nada. Es la contracara exacta de `estadoDesdeStripe`
 * en precios.ts, donde lo desconocido tampoco ACTIVA: lo que no se
 * entiende no mueve el mundo en ninguna de las dos direcciones.
 *
 * ------------------------------------------------------------------
 * 4. NO SE APAGA A QUIEN SIGUE PAGO POR OTRO LADO
 * ------------------------------------------------------------------
 * Una suscripción que se termina NO significa que el negocio dejó de
 * pagar. Hay dos casos reales donde significa lo contrario:
 *
 *   · EL QUE PAGA POR SINPE. El depósito con comprobante (0126 + 0128
 *     + 0130) es lo único que cobra dinero de verdad hoy, y esos
 *     negocios no tienen —ni van a tener— suscripción de Stripe:
 *     muchas tarjetas costarricenses vienen bloqueadas para compras
 *     internacionales. Normalmente ni se rozan (sin suscripción no
 *     llega ningún evento), pero el caso MIXTO existe: el que probó
 *     con tarjeta, la canceló, y hoy paga por depósito.
 *
 *   · EL QUE CAMBIÓ DE PAQUETE. Subir de plan deja la suscripción
 *     vieja cancelada y una nueva activa. Si el `deleted` de la vieja
 *     llega después —los eventos de Stripe pueden llegar
 *     desordenados—, apagaría a un negocio que acaba de pagar más.
 *
 * Los dos se resuelven con la misma pregunta antes de apagar: ¿este
 * negocio sigue cubierto por otra vía? La respuesta la da la base, no
 * este archivo.
 *
 * ------------------------------------------------------------------
 * 5. LO QUE NUNCA ACTIVÓ NADA NO PUEDE APAGAR NADA
 * ------------------------------------------------------------------
 * `incomplete_expired` —el Checkout que alguien abrió y abandonó, que
 * Stripe archiva a las 23 horas— NO apaga. Esa suscripción jamás
 * estuvo activa y jamás le dio el paquete a nadie; tratarla como un
 * final apagaría al negocio que abrió el Checkout para SUBIR de plan y
 * se arrepintió, con su suscripción de siempre al día. Es el error más
 * fácil de cometer acá y el más difícil de explicar después.
 */

/** Por qué se apaga. Va al correo y al log: son cosas distintas. */
export type MotivoDeCorte =
  /** Se terminó: el cliente canceló y el período pagado ya venció. */
  | "cancelada"
  /** Stripe agotó los reintentos y dejó de cobrar (`unpaid`). */
  | "incobrable";

export type VeredictoDeCobro =
  /**
   * Opera con normalidad. `avisoPrevio` = el cliente ya programó la
   * cancelación pero el período pagado sigue corriendo: es el momento
   * de contarle en qué fecha se apaga.
   */
  | { estado: "opera"; avisoPrevio: boolean }
  /** El cobro falló y Stripe sigue intentando: se avisa, no se apaga. */
  | { estado: "en_mora" }
  /** Se apaga: los programas se PAUSAN (nada se borra). */
  | { estado: "corta"; motivo: MotivoDeCorte }
  /** Correspondía apagar, pero el negocio sigue cubierto por otra vía. */
  | { estado: "protegido"; motivo: MotivoDeCorte };

/**
 * ¿Este `status` de Stripe, por sí solo, apaga el programa?
 *
 * Se exporta aparte porque el motor la usa como pre-pregunta barata:
 * solo cuando el corte está sobre la mesa vale la pena ir a la base a
 * averiguar si el negocio sigue cubierto por otro lado.
 */
export function motivoDeCorte(statusStripe: string | null | undefined): MotivoDeCorte | null {
  switch (statusStripe) {
    // El fin del camino: el período pagado terminó después de una
    // cancelación, o alguien la puso en pausa desde el panel de Stripe.
    //
    // `incomplete_expired` NO está acá y no es un olvido: ver el punto
    // 5 del encabezado. Esa suscripción nunca activó nada.
    case "canceled":
    case "paused":
      return "cancelada";

    // Stripe agotó los reintentos. Ver el punto 2 del encabezado: esto
    // NO es el primer rebote de una tarjeta, es semanas después.
    case "unpaid":
      return "incobrable";

    default:
      return null;
  }
}

/** Los estados en los que el programa opera con normalidad. */
function operaCon(statusStripe: string | null | undefined): boolean {
  return statusStripe === "active" || statusStripe === "trialing";
}

/**
 * El veredicto completo.
 *
 * @param statusStripe   el `status` CRUDO de la suscripción en Stripe.
 *   Crudo a propósito: `estadoDesdeStripe` colapsa `past_due` y
 *   `unpaid` en el mismo `morosa`, y esa es justamente la distinción
 *   entre «avisale» y «apagalo».
 * @param cancelaAlFinal `cancel_at_period_end`. true = el cliente ya
 *   canceló pero el período pagado sigue corriendo.
 * @param sigueCubierto  el negocio sigue pago por otra vía: un depósito
 *   por SINPE vigente, u OTRA suscripción de Stripe activa (el que
 *   cambió de paquete). true = no se apaga.
 */
export function decidirPorCobro(d: {
  statusStripe: string | null | undefined;
  cancelaAlFinal: boolean;
  sigueCubierto: boolean;
}): VeredictoDeCobro {
  const motivo = motivoDeCorte(d.statusStripe);

  if (motivo) {
    // La protección se aplica ACÁ y no antes: el veredicto sigue
    // diciendo por qué se habría cortado, que es lo que hace que el
    // aviso interno sirva para algo.
    return d.sigueCubierto ? { estado: "protegido", motivo } : { estado: "corta", motivo };
  }

  if (operaCon(d.statusStripe)) {
    // `cancel_at_period_end` con la suscripción activa es EL caso del
    // encargo: canceló el día 3, pagó hasta el 30, opera hasta el 30.
    return { estado: "opera", avisoPrevio: d.cancelaAlFinal };
  }

  // Todo lo demás —`past_due`, `incomplete`, y cualquier status que
  // Stripe invente mañana— avisa y no apaga.
  return { estado: "en_mora" };
}

/**
 * ¿Qué pasa con los PASES que la gente ya tiene en el teléfono cuando
 * el programa se apaga?
 *
 * (Decisión de producto pendiente de que la confirme el dueño; acá
 * queda escrito el criterio, no aplicado — la generación del pase no
 * se toca.)
 *
 * EL PASE SE QUEDA. Borrarlo o vaciarlo sería lo peor de todas las
 * opciones: el pase que el cliente tiene en su Wallet es SU tarjeta con
 * SUS sellos, no una licencia del negocio. Un negocio que se atrasa un
 * mes en la factura de Bookea no puede hacer que a doscientos clientes
 * suyos les desaparezcan los sellos del teléfono; ese daño no se
 * deshace al renovar, porque el cliente que vio su tarjeta vacía ya la
 * borró.
 *
 * Además el pase NO es lo que autoriza nada: `autorizarCanje`
 * (src/lib/lealtad/canje.ts) rechaza cualquier canje con el programa
 * pausado leyendo la BASE, no el pase. O sea que un pase intacto en un
 * teléfono no deja pasar ni un canje mientras el programa esté
 * apagado — el pase es un dibujo, y esa es la doctrina de siempre.
 *
 * Lo que sí recomiendo es CAMBIARLE EL TEXTO, que es gratis y ya está
 * cableado en las dos plataformas:
 *   · Apple: `avisarPaseActualizado` (src/lib/wallet/apns.ts) manda un
 *     push vacío y el teléfono vuelve a pedir el pase.
 *   · Google: un PATCH del objeto y Google actualiza los teléfonos
 *     solo (src/lib/wallet/google.ts).
 * Con eso, el pase pasaría a decir algo como «Este programa está en
 * pausa» conservando los sellos a la vista. El cliente no se asusta y
 * el negocio se entera por el lado que más le duele.
 *
 * Y hay un motivo práctico para NO tocar el pase en el corte: el
 * refresco de los dos wallets cuesta una llamada por pase. Apagar un
 * negocio con 1.150 miembros dispararía 1.150 llamadas dentro del
 * webhook, que tiene que contestarle a Stripe en segundos. Si se hace,
 * va en un trabajo aparte y no acá.
 */
