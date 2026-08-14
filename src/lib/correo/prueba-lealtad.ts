import { escaparHtml, layoutBento } from "@/lib/email";
import { urlDeRenovacion } from "./suscripcion";

/**
 * EL AVISO DE QUE SE ACABA LA PRUEBA DE 14 DÍAS.
 *
 * Sale ANTES del corte, no después. Un dueño que se entera el día
 * después es un dueño que ya tuvo a un cliente parado en el mostrador
 * con el teléfono en la mano y la tarjeta sin sellar: ese momento no
 * se arregla con un correo posterior por bien escrito que esté.
 *
 * Sigue la forma de `./suscripcion.ts`, que es la familia a la que
 * pertenece —los correos del estado del servicio contratado—: mismo
 * armazón bento, mismo pie, mismo botón a `urlDeRenovacion`, y la
 * misma promesa repetida en la tarjeta naranja, que es la pregunta que
 * un dueño se hace primero: **no se borra nada**.
 *
 * Es TRANSACCIONAL: informa del estado de un servicio que la persona
 * contrató, así que no lleva link de baja ni consulta
 * `consentimientos`. Las supresiones de `supresiones_correo` (0082) sí
 * se respetan, en la puerta.
 */

const PIE = "Recibiste este correo porque sos el dueño de un programa de lealtad en Bookea.";

export type DatosPrueba = {
  nombreNegocio: string;
  /** Para armar el botón. null = no hay panel al que mandarlo. */
  ranchoId: string | null;
  /** Días enteros que faltan. 0 = se termina hoy. */
  diasRestantes: number;
  /**
   * El día del corte ya escrito para una persona
   * ("Jueves 27 de agosto de 2026").
   */
  hasta: string;
};

/** «Faltan 3 días» / «Falta 1 día» / «Se termina hoy». */
function cuantoFalta(dias: number): string {
  if (dias <= 0) return "se termina hoy";
  if (dias === 1) return "queda 1 día";
  return `quedan ${dias} días`;
}

/**
 * EL AVISO PREVIO — «tu prueba se termina el jueves».
 *
 * El tono no es de cobro sino de continuidad: la persona ya armó su
 * tarjeta, ya tiene clientes con sellos, y lo que se le está diciendo
 * es cómo NO perder eso. Por eso el correo dice primero qué conserva y
 * después qué hay que hacer.
 */
export function plantillaPruebaPorVencer(d: DatosPrueba) {
  const falta = cuantoFalta(d.diasRestantes);
  return layoutBento({
    kicker: escaparHtml(d.nombreNegocio),
    titulo:
      d.diasRestantes <= 0
        ? "Tu prueba se termina hoy"
        : `Tu prueba se termina en ${d.diasRestantes === 1 ? "1 día" : `${d.diasRestantes} días`}`,
    introHtml:
      `Los 14 días de prueba de tu programa de lealtad terminan el ` +
      `<strong>${escaparHtml(d.hasta)}</strong> — o sea que ${falta}.`,
    naranjaHtml:
      "NO SE BORRA NADA. Tus clientes, sus sellos, sus pases y todos los movimientos quedan " +
      "exactamente como están. Al terminar la prueba, el programa queda EN PAUSA hasta que " +
      "elijas un paquete: nadie pierde lo que juntó.",
    cuerpoHtml:
      "<strong>Mientras esté en pausa:</strong> el mostrador no puede dar sellos ni canjear " +
      "premios, y no se pueden emitir tarjetas nuevas. Las que tus clientes ya tienen en el " +
      "teléfono se quedan ahí, con sus sellos, esperando." +
      "<br><br>Elegí tu paquete antes de esa fecha y no se interrumpe nada.",
    cta: { href: urlDeRenovacion(d.ranchoId), label: "Ver los paquetes" },
    pie: PIE,
  });
}

/** El asunto, para que la ruta que envía no lo escriba a mano. */
export function asuntoPruebaPorVencer(d: DatosPrueba): string {
  if (d.diasRestantes <= 0) return `Hoy se termina la prueba de ${d.nombreNegocio}`;
  if (d.diasRestantes === 1) return `Mañana se termina la prueba de ${d.nombreNegocio}`;
  return `Faltan ${d.diasRestantes} días para que termine la prueba de ${d.nombreNegocio}`;
}
