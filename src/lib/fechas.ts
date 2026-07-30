/**
 * Todo lo que dependa de "hoy" o de mostrar una hora usa la zona de
 * Costa Rica explícitamente: el servidor (Vercel) corre en UTC, que va
 * 6 horas adelantado — sin esto, desde las 6 p.m. de CR el sitio creía
 * que ya era "mañana" y las horas de los mensajes salían corridas.
 */
export const TZ_CR = "America/Costa_Rica";

/** "YYYY-MM-DD" de hoy en hora de Costa Rica, corra donde corra. */
export function hoyISOCR(): string {
  // en-CA formatea como YYYY-MM-DD, que es justo el formato ISO.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** La fecha (YYYY-MM-DD) de un timestamp, vista desde Costa Rica. */
export function fechaISOCR(t: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_CR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(t);
}

/** Suma días a una fecha ISO sin pasar por zonas horarias. */
export function sumarDiasISO(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Hora corta de un timestamp en hora de Costa Rica ("2:41 p. m."). */
export function fmtHoraCR(timestamp: string | Date): string {
  return new Date(timestamp).toLocaleTimeString("es-CR", {
    timeZone: TZ_CR,
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Para bandejas de mensajes: la hora si el mensaje es de hoy (en CR),
 * o "27 jul" si es de antes.
 */
export function fechaCortaMensaje(timestamp: string): string {
  const t = new Date(timestamp);
  if (fechaISOCR(t) === hoyISOCR()) return fmtHoraCR(t);
  return t.toLocaleDateString("es-CR", { timeZone: TZ_CR, day: "numeric", month: "short" });
}

export function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DIAS_LARGOS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "2026-12-12" → "Sábado 12 de diciembre de 2026" (es-CR, sin dudas de
 * zona horaria). La usan la invitación pública y el espacio del
 * anfitrión para hablar de la fecha del evento en grande.
 */
export function fechaLargaCR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dia = DIAS_LARGOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d} de ${MESES_LARGOS[m - 1]} de ${y}`;
}

export function fmtFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
  });
}

export function esFechaHoy(iso: string) {
  return iso === hoyISOCR();
}

export const DIAS_DISPONIBILIDAD = 60;

/**
 * Próxima fecha libre de un lugar dentro de los próximos 60 días, o
 * `null` si está confirmado todos esos días (agotado). Es el dato
 * real que tenemos hoy (un evento = un día completo), sin inventar
 * bloques de horas.
 */
export function proximaFechaLibre(
  ranchoId: string,
  ocupadosPorFecha: Map<string, Set<string>>,
  dias: number = DIAS_DISPONIBILIDAD,
): string | null {
  const hoy = hoyISOCR();
  for (let i = 0; i < dias; i++) {
    const iso = sumarDiasISO(hoy, i);
    if (!ocupadosPorFecha.get(iso)?.has(ranchoId)) return iso;
  }
  return null;
}
