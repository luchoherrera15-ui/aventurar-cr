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

/**
 * "YYYY-MM-DDTHH:MM" en hora de Costa Rica — el MINUTO en que pasó algo.
 *
 * Existe para las llaves de idempotencia del mostrador. La llave de un
 * canje o de una acreditación se arma con quién, qué y en qué minuto
 * (`llaveDeCanje`, src/lib/lealtad/canje.ts): dos toques del mismo
 * botón dentro del mismo minuto producen la misma llave, y el segundo
 * choca contra el índice único y no escribe nada.
 *
 * Por eso el minuto tiene que salir de UNA sola función. Si cada
 * llamador lo calculara por su cuenta, uno usaría UTC y otro CR, las
 * llaves no coincidirían en la frontera de la hora y el doble cobro
 * volvería justo a las 6 de la tarde — el peor momento para que un
 * mostrador falle.
 *
 * `sv-SE` y no `en-CA` porque acá hace falta fecha Y hora: es el único
 * locale que escribe "2026-08-13 14:30" (ISO sin la T). Con `es-CR`
 * saldría "13/8/2026, 2:30 p. m." y habría que parsearlo.
 */
export function minutoISOCR(t: Date = new Date()): string {
  return t
    .toLocaleString("sv-SE", { timeZone: TZ_CR, hour12: false })
    .replace(" ", "T")
    .slice(0, 16);
}

/** La fecha (YYYY-MM-DD) de un timestamp, vista desde Costa Rica. */
export function fechaISOCR(t: Date): string {
  return fechaISOEnZona(t, TZ_CR);
}

/**
 * La fecha (YYYY-MM-DD) de un timestamp vista desde CUALQUIER zona.
 *
 * Bookea ya no es solo de Costa Rica: cada negocio guarda la suya en
 * `ranchos.zona_horaria` (0062, 0170). "Qué día es hoy" depende de
 * dónde está el negocio, y donde eso decide plata —el cobro de
 * plataforma se devenga el DÍA DEL EVENTO— usar la zona equivocada
 * cobra el día anterior.
 *
 * Si la zona guardada no es una zona IANA válida, `Intl` tira
 * RangeError; acá eso NO puede tumbar un barrido de cobros, así que se
 * cae a Costa Rica, que es el default de la columna.
 */
export function fechaISOEnZona(t: Date, zona: string | null | undefined): string {
  const formatear = (tz: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(t);

  const pedida = (zona ?? "").trim();
  if (!pedida) return formatear(TZ_CR);
  try {
    return formatear(pedida);
  } catch {
    return formatear(TZ_CR);
  }
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

/**
 * "Hace cuánto" en español de Costa Rica, en escalones legibles (hoy,
 * ayer, hace N días/semanas/meses/años). Sirve para leer antigüedad de
 * un vistazo -ej. "cliente desde" en /admin/complementos- sin perder la
 * fecha exacta, que se sigue mostrando aparte (normalmente en un
 * `title`, como ya se hace con "dato cruzado" en ese mismo panel).
 *
 * SIN `Intl.RelativeTimeFormat` a propósito: esa API no elige la unidad
 * sola -hay que pasarle `format(-3, 'month')` ya decidido-, así que no
 * ahorra la parte difícil, que es elegir el escalón. El resto de este
 * archivo (`fechaLargaCR`, `fmtHoraCR`, `fechaCortaMensaje`) ya escribe
 * el texto a mano para controlar exactamente el español de Costa Rica;
 * mantenerlo a mano acá es consistente con el archivo, no una excepción.
 *
 * `null` si la fecha es inválida o falta -mismo criterio que el resto
 * del archivo: un dato roto no se disfraza mostrando cualquier cosa.
 */
export function haceCuanto(iso: string | null, ahora: Date = new Date()): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;

  // Por CALENDARIO de Costa Rica, no por el reloj del runtime (Vercel
  // corre en UTC) — mismo motivo que el resto de este archivo (ver el
  // comentario de cabecera): sin esto, entre las 6pm y medianoche hora
  // de CR el "día" que ven getFullYear()/getMonth()/getDate() ya es el
  // de mañana en UTC. `hoyISOCR()`/`fechaISOCR()` ya resuelven esto en
  // todo el resto del archivo — acá se reusan, no se reinventa la regla.
  //
  // `ahora` es un parámetro (no siempre `new Date()`) por lo mismo que
  // ya hace `minutoISOCR` acá arriba: sin poder fijar "el momento
  // actual" desde afuera, no hay forma de probar el borde real que
  // encontró la auditoría (26 horas de diferencia cruzando la
  // medianoche de Costa Rica).
  const [anioAhora, mesAhora, diaAhora] = fechaISOCR(ahora).split("-").map(Number);
  const [anioFecha, mesFecha, diaFecha] = fechaISOCR(fecha).split("-").map(Number);

  // Días de diferencia por CALENDARIO, no por milisegundos: dos
  // instantes 26 horas aparte pueden ser "hoy" y "pasado mañana" en
  // días de calendario CR, no "hace 1 día" — restar los componentes
  // año/mes/día ya resueltos (vía Date.UTC, que acá solo sirve de
  // calculadora de fechas, no de huso horario) da el día calendario
  // exacto sin arrastrar la hora del instante original.
  const diasAhora = Date.UTC(anioAhora, mesAhora - 1, diaAhora);
  const diasFecha = Date.UTC(anioFecha, mesFecha - 1, diaFecha);
  const dias = Math.round((diasAhora - diasFecha) / 86_400_000);

  if (dias <= 0) return "hoy"; // incluye el reloj del cliente adelantado
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) {
    const semanas = Math.round(dias / 7);
    return semanas === 1 ? "hace 1 semana" : `hace ${semanas} semanas`;
  }

  // A partir de acá, por MES DE CALENDARIO -no `Math.floor(dias / 30)`.
  // Un mes de calendario no son siempre 30 días, y derivar con floor()
  // se desalinea con el tiempo: "hace 1 año calendario exacto" podría
  // leer "hace 12 meses" según dónde caiga el redondeo, y eso es peor
  // que impreciso -es inconsistente consigo mismo según la fecha de hoy.
  let meses = (anioAhora - anioFecha) * 12 + (mesAhora - mesFecha);
  if (diaAhora < diaFecha) meses -= 1;
  meses = Math.max(meses, 1);

  if (dias < 365) {
    return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
  }

  const anios = Math.max(1, Math.floor(meses / 12));
  return anios === 1 ? "hace 1 año" : `hace ${anios} años`;
}
