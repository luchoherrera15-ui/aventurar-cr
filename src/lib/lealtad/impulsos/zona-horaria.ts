/**
 * HORA LOCAL DE UN NEGOCIO, SIN DEPENDER DEL RELOJ DEL SERVIDOR.
 *
 * Vercel corre en UTC y GitHub Actions también. «Mandalo a las 9:00 de la
 * mañana» tiene que querer decir las 9:00 de donde está el negocio, no las
 * del servidor. Todo lo que sigue se apoya en `Intl` con una zona explícita:
 * ninguna función de acá lee `process.env.TZ` ni usa la hora local del
 * proceso.
 *
 * Módulo PURO (no lee el reloj): quien llama trae el instante.
 */

export type PartesLocales = {
  /** AAAA-MM-DD en la zona. */
  fecha: string;
  /** Minutos desde la medianoche local (0–1439). */
  minutos: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
};

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatos = new Map<string, Intl.DateTimeFormat>();

function formatoDe(zona: string): Intl.DateTimeFormat {
  let f = formatos.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    formatos.set(zona, f);
  }
  return f;
}

/** ¿Es un nombre de zona que `Intl` conoce («America/Costa_Rica»)? */
export function zonaValida(zona: string | null | undefined): zona is string {
  if (!zona || typeof zona !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/** La fecha, los minutos del día y el día de la semana que marca el reloj de esa zona en ese instante. */
export function partesLocales(instante: Date | number, zona: string): PartesLocales {
  const ms = typeof instante === "number" ? instante : instante.getTime();
  const partes = formatoDe(zona).formatToParts(new Date(ms));
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  // Algunas implementaciones devuelven «24» a medianoche aun con h23.
  const hora = Number(valor("hour")) % 24;
  return {
    fecha: `${valor("year")}-${valor("month")}-${valor("day")}`,
    minutos: hora * 60 + Number(valor("minute")),
    diaSemana: DIAS[valor("weekday")] ?? 0,
  };
}

/** Cuánto se adelanta el reloj de la zona respecto de UTC en ese instante, en milisegundos. */
function desfaseMs(instante: number, zona: string): number {
  const minuto = Math.floor(instante / 60_000) * 60_000;
  const p = partesLocales(minuto, zona);
  const [y, m, d] = p.fecha.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 0, 0) + p.minutos * 60_000 - minuto;
}

/**
 * El instante en que el reloj de esa zona marca esa fecha y esa hora.
 *
 * Con horario de verano hay dos casos raros, y se resuelven como lo hace la
 * mayoría de las agendas:
 *   · una hora que NO existe (el reloj salta de las 2:00 a las 3:00) se corre
 *     hacia adelante: las 2:30 pasan a ser las 3:30;
 *   · una hora que existe DOS veces (el reloj retrocede) toma la primera.
 */
export function instanteLocal(fecha: string, minutos: number, zona: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const ingenuo = Date.UTC(y, m - 1, d, 0, 0) + minutos * 60_000;
  const DIA = 86_400_000;
  // El desfase un día antes y un día después encierra cualquier cambio de hora.
  const antes = desfaseMs(ingenuo - DIA, zona);
  const despues = desfaseMs(ingenuo + DIA, zona);
  const candidatoAntes = ingenuo - antes;
  const candidatoDespues = ingenuo - despues;

  const validoAntes = desfaseMs(candidatoAntes, zona) === antes;
  const validoDespues = desfaseMs(candidatoDespues, zona) === despues;
  if (validoAntes && validoDespues) return new Date(Math.min(candidatoAntes, candidatoDespues));
  if (validoAntes) return new Date(candidatoAntes);
  if (validoDespues) return new Date(candidatoDespues);
  // La hora no existe: se usa el desfase de antes del salto, que la corre hacia adelante.
  return new Date(candidatoAntes);
}

/** Suma (o resta) días a una fecha AAAA-MM-DD, sin pasar por la zona horaria del proceso. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha AAAA-MM-DD. */
export function diaDeLaSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Días enteros entre dos fechas AAAA-MM-DD (hasta − desde). */
export function diasEntreFechas(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
