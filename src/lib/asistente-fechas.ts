import { fechaLargaCR } from "@/lib/fechas";

/**
 * Todo lo que el asistente de IA necesita saber sobre "cuándo es hoy"
 * para no confundirse con fechas — la causa raíz del bug reportado
 * (interpretaba y consultaba meses y días que ya habían pasado):
 * Claude no sabe qué fecha es "hoy" por su cuenta, así que si el
 * prompt no se lo dice explícitamente, adivina con su fecha de
 * entrenamiento o con lo que escriba el cliente, sin poder detectar
 * que algo ya pasó.
 *
 * 100% puro (sin Date(), sin Supabase): `hoy` y `horaActual` los
 * calcula quien llama (hoyISOCR() / fmtHoraCR(new Date())), así se
 * puede probar con cualquier fecha sin depender del reloj real.
 */

const ZONA_HORARIA = "America/Costa_Rica";

/**
 * El bloque de "fecha y hora actual" + las reglas de interpretación de
 * fechas que va al principio de cada prompt del asistente — la ÚNICA
 * referencia temporal válida que se le da al modelo.
 */
export function contextoFechaActual(hoy: string, horaActual: string): string {
  return [
    "FECHA Y HORA ACTUAL — la ÚNICA referencia temporal válida. Nunca uses otra fecha (ni la de tu entrenamiento, ni una que hayas asumido en un mensaje anterior):",
    `Hoy es ${fechaLargaCR(hoy)}, ${horaActual}. Zona horaria: ${ZONA_HORARIA}.`,
    "",
    "REGLAS PARA INTERPRETAR FECHAS QUE MENCIONE EL CLIENTE (obligatorias, siempre a partir de la fecha de arriba):",
    '- Si menciona un mes SIN decir año y ese mes de este año YA PASÓ, no lo trates como válido ni asumas el año pasado: decile que ese mes ya pasó y preguntale si se refiere al mismo mes del año que viene (ej.: "Julio ya pasó — ¿te referís a julio de 2027?").',
    "- Si menciona día y mes sin año, asumí la PRÓXIMA vez que esa fecha ocurra a partir de hoy (si ya pasó este año, es el año que viene) — nunca el año pasado.",
    '- Si menciona solo un día ("el 8", "el 15"), usá el mes que el cliente haya mencionado antes en esta conversación; si no hay ninguno, preguntale el mes antes de confirmar nada.',
    '- "Mañana", "este sábado", "la próxima semana" y expresiones parecidas se calculan a partir de la fecha de HOY de arriba, nunca a ojo.',
    "- Si la fecha que pide ya pasó, decíselo con la fecha completa y preguntale si quiso decir el año que viene — nunca la trates como válida ni digas si hay disponibilidad para ella.",
    "- Si la expresión puede referirse a más de una fecha, pedile que la confirme antes de decir nada sobre disponibilidad.",
    "- Nunca cambies en silencio el mes o el año que pidió el cliente por otro: si hace falta ajustarlo (por ejemplo, porque ya pasó), decíselo explícitamente.",
    '- Al confirmar cualquier fecha, escribila completa: día, mes y año (ej. "8 de agosto de 2026"), nunca solo "el día 8".',
    "- Usá lo que el cliente ya dijo antes en este chat (qué mes o fecha mencionó): no le preguntes de nuevo algo que ya contestó, y si corrige la fecha, quedate con la corregida y olvidate de la anterior.",
  ].join("\n");
}

/**
 * Saca del listado cualquier fecha anterior a hoy — red de seguridad
 * ADEMÁS del filtro que ya hace la consulta a Supabase
 * (`.gte("fecha", hoy)`): si algo se cuela igual, se descarta acá en
 * vez de dejar que el asistente le muestre al cliente un mes que ya
 * pasó. Comparación por string: las fechas vienen en ISO (YYYY-MM-DD),
 * que ordena igual lexicográfica y cronológicamente.
 */
export function filtrarFechasPasadas(
  fechas: string[],
  hoy: string,
): { validas: string[]; descartadas: string[] } {
  const validas: string[] = [];
  const descartadas: string[] = [];
  for (const fecha of fechas) {
    (fecha >= hoy ? validas : descartadas).push(fecha);
  }
  return { validas, descartadas };
}
