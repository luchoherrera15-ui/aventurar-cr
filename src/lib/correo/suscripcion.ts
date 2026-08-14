import { escaparHtml, layoutBento } from "@/lib/email";

/**
 * LOS CORREOS DEL COBRO DEL MÓDULO DE LEALTAD.
 *
 * Un negocio que se despierta con su programa apagado y sin ningún
 * correo es un cliente perdido: no sabe qué pasó, no sabe que se
 * arregla pagando, y lo primero que ve es un cliente suyo parado en el
 * mostrador con el teléfono en la mano. Por eso cada movimiento del
 * cobro tiene su aviso, y los cuatro dicen lo mismo en distinto
 * momento: QUÉ pasó, QUÉ conserva, y CÓMO se arregla.
 *
 * ------------------------------------------------------------------
 * LO QUE TODOS REPITEN, A PROPÓSITO
 * ------------------------------------------------------------------
 * «No se borró nada». Es la pregunta que un dueño se hace primero y la
 * que decide si renueva o si da el módulo por perdido: si cree que sus
 * clientes y sus sellos se fueron, no vuelve. Y es verdad — el corte
 * PAUSA el programa (mismo estado que el botón «Pausar» del panel, el
 * que ya dice «conserva todo»): miembros, sellos, pases y movimientos
 * quedan exactamente donde estaban.
 *
 * Mismo armazón bento y las mismas reglas de siempre: tablas + estilos
 * inline, y TODO dato que escribió una persona (el nombre del negocio)
 * pasa por `escaparHtml`.
 *
 * Estos correos son TRANSACCIONALES —el estado del servicio que el
 * negocio contrató—, así que no llevan link de baja ni consultan
 * `consentimientos`. Las supresiones de `supresiones_correo` (0082) SÍ
 * se respetan, y se comprueban en la puerta (puerta-supabase.ts): no
 * son una preferencia, son un buzón que no recibe.
 */

const SITIO_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bookea.lat";

/** A dónde se manda a renovar: su panel si lo hay, los paquetes si no. */
export function urlDeRenovacion(ranchoId: string | null): string {
  return ranchoId ? `${SITIO_URL}/lealtad/panel/${ranchoId}#plan` : `${SITIO_URL}/lealtad/planes`;
}

const PIE = "Recibiste este correo porque sos el dueño de un programa de lealtad en Bookea.";

/** Lo que comparten los cuatro avisos. */
export type DatosAvisoCobro = {
  nombreNegocio: string;
  /** Para armar el botón. null = no hay panel al que mandarlo. */
  ranchoId: string | null;
  /** Cómo se llama el paquete ("Impulso"). null = no se sabe. */
  nombrePlan: string | null;
  /**
   * Hasta cuándo está pago, ya escrito para una persona
   * ("Domingo 30 de agosto de 2026"). null = Stripe no lo dijo.
   */
  hasta: string | null;
};

/**
 * EL AVISO PREVIO — «tu programa se apaga el 30».
 *
 * Sale en cuanto Stripe dice `cancel_at_period_end: true`, o sea el
 * mismo día que la persona cancela, con el corte todavía a semanas de
 * distancia. Es el único «unos días antes» que Stripe permite saber:
 * no existe ningún evento que avise «faltan tres días para el corte»
 * —para una suscripción que se va a cancelar, Stripe ni siquiera
 * genera la factura próxima (`invoice.upcoming`)—, así que el momento
 * en que se puede avisar es el momento en que nos enteramos.
 *
 * El tono NO es de despedida: la mitad de las cancelaciones se hacen
 * para «pensarlo» y se revierten desde el mismo Portal. El correo dice
 * la fecha exacta y deja el camino de vuelta a un toque.
 */
export function plantillaCorteProgramado(d: DatosAvisoCobro) {
  const fecha = d.hasta ? escaparHtml(d.hasta) : "que termine el período que ya pagaste";
  return layoutBento({
    kicker: escaparHtml(d.nombreNegocio),
    titulo: d.hasta ? `Tu programa funciona hasta el ${fecha}` : "Cancelaste tu suscripción",
    introHtml:
      `Recibimos la cancelación de tu suscripción${
        d.nombrePlan ? ` del paquete ${escaparHtml(d.nombrePlan)}` : ""
      }. ` +
      `No pasa nada todavía: ya pagaste este período y tu programa de lealtad sigue ` +
      `funcionando con normalidad hasta ${d.hasta ? `el ${fecha}` : fecha}.`,
    naranjaHtml:
      "Después de esa fecha el programa queda EN PAUSA: no se pueden dar sellos ni canjear " +
      "premios hasta que renovés. Nada se borra — tus clientes, sus sellos, sus pases y todo " +
      "el historial quedan tal cual, esperándote.",
    cuerpoHtml:
      "¿Cancelaste sin querer, o cambiaste de idea? Volver a activarla antes de esa fecha hace " +
      "que no se interrumpa nada: el programa nunca llega a pausarse.",
    cta: { href: urlDeRenovacion(d.ranchoId), label: "Ver mi plan" },
    pie: PIE,
  });
}

/**
 * EL CORTE — «tu programa quedó en pausa».
 *
 * Sale en el momento exacto en que Stripe cierra la suscripción. Tiene
 * que responder tres cosas en el primer vistazo, porque es el correo
 * que se lee con un cliente esperando en el mostrador: qué pasó, que
 * NO se borró nada, y qué hay que tocar para que vuelva.
 */
export function plantillaProgramaPausado(
  d: DatosAvisoCobro & { motivo: "cancelada" | "incobrable" },
) {
  return layoutBento({
    kicker: escaparHtml(d.nombreNegocio),
    titulo: "Tu programa de lealtad quedó en pausa",
    introHtml:
      d.motivo === "incobrable"
        ? "No pudimos cobrar tu suscripción después de varios intentos, así que el período " +
          "que tenías pago terminó sin renovarse."
        : "Terminó el período que tenías pago y la suscripción no se renovó.",
    naranjaHtml:
      "NO SE BORRÓ NADA. Tus clientes, sus sellos, sus pases y todos los movimientos quedan " +
      "exactamente como estaban. Con renovar, el programa vuelve a funcionar tal cual lo " +
      "dejaste — el mismo día, en el mismo paquete.",
    cuerpoHtml:
      "<strong>Mientras esté en pausa:</strong> el mostrador no puede dar sellos ni canjear " +
      "premios, y las tarjetas nuevas no se pueden emitir. Los pases que tus clientes ya " +
      "tienen en el teléfono NO se borran: se quedan con sus sellos, esperando." +
      (d.nombrePlan
        ? `<br><br>Tu paquete era <strong>${escaparHtml(d.nombrePlan)}</strong>.`
        : ""),
    cta: { href: urlDeRenovacion(d.ranchoId), label: "Renovar mi plan" },
    pie: PIE,
  });
}

/** LA VUELTA — el correo que hace que renovar se sienta terminado. */
export function plantillaProgramaReanudado(d: DatosAvisoCobro) {
  return layoutBento({
    kicker: escaparHtml(d.nombreNegocio),
    titulo: "Tu programa volvió a funcionar",
    introHtml:
      `Listo: recibimos tu pago${
        d.nombrePlan ? ` del paquete ${escaparHtml(d.nombrePlan)}` : ""
      } y tu programa de lealtad ya está operando otra vez.`,
    naranjaHtml:
      "Todo volvió como estaba: los mismos clientes, los mismos sellos y las mismas tarjetas. " +
      "El mostrador ya puede sellar y canjear.",
    cta: { href: urlDeRenovacion(d.ranchoId), label: "Abrir mi panel" },
    pie: PIE,
  });
}

/**
 * EL COBRO QUE REBOTÓ — y que NO apaga nada.
 *
 * Este correo existe para que el corte no sorprenda a nadie. Se manda
 * cuando la tarjeta falla, con el programa funcionando igual: Stripe
 * reintenta durante semanas y en el 90% de los casos se resuelve con
 * cambiar la tarjeta. Decirle «tu programa sigue funcionando» en el
 * mismo correo es lo que evita el llamado en pánico.
 */
export function plantillaCobroFallido(d: DatosAvisoCobro) {
  return layoutBento({
    kicker: escaparHtml(d.nombreNegocio),
    titulo: "No pudimos cobrar tu suscripción",
    introHtml:
      `El cobro${d.nombrePlan ? ` del paquete ${escaparHtml(d.nombrePlan)}` : ""} no pasó — ` +
      "suele ser una tarjeta vencida o sin cupo internacional.",
    naranjaHtml:
      "Tu programa SIGUE FUNCIONANDO. No se apagó nada y no hay que hacer nada urgente: " +
      "vamos a reintentar el cobro durante los próximos días.",
    cuerpoHtml:
      "Si el cobro no entra en ese plazo, el programa queda en pausa (sin borrar nada) hasta " +
      "que renovés. Actualizar la tarjeta ahora evita todo eso.",
    cta: { href: urlDeRenovacion(d.ranchoId), label: "Actualizar mi tarjeta" },
    pie: PIE,
  });
}
