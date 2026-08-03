/**
 * La vertical de Citas en el app: espejo de src/app/citas/tipos.ts de
 * /web (misma base de Supabase, misma lógica pura de espacios libres).
 * Si cambiás algo acá, cambialo también allá — son gemelos a mano
 * porque el app no puede importar código del proyecto Next.
 */

import { instanteEnZona } from "./disponibilidad";

export const CATEGORIAS_CITAS = [
  "belleza",
  "barberia",
  "unas",
  "spa",
  "consultorio",
  "otros",
] as const;

export type CategoriaCita = (typeof CATEGORIAS_CITAS)[number];

export const CATEGORIA_CITA_LABEL: Record<CategoriaCita, string> = {
  belleza: "Belleza",
  barberia: "Barbería",
  unas: "Uñas",
  spa: "Spa y bienestar",
  consultorio: "Consultorios",
  otros: "Otros",
};

export function normalizarCategoriaCita(valor: string | null): CategoriaCita {
  return (CATEGORIAS_CITAS as readonly string[]).includes(valor ?? "")
    ? (valor as CategoriaCita)
    : "otros";
}

/** Un día del horario semanal: null u omitido = cerrado. */
export type DiaHorario = { abre: string; cierra: string } | null;

/** Claves "0" (domingo) a "6" (sábado), como extract(dow) en Postgres. */
export type HorarioSemana = Partial<Record<string, DiaHorario>>;

export const DIAS_SEMANA_LABEL = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MESES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "dic",
];

/** Lee el horario guardado en ranchos.detalles.horario_citas. */
export function horarioDeDetalles(detalles: unknown): HorarioSemana | null {
  if (!detalles || typeof detalles !== "object") return null;
  const h = (detalles as Record<string, unknown>).horario_citas;
  if (!h || typeof h !== "object") return null;
  return h as HorarioSemana;
}

/** "09:00" → minutos desde medianoche. */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutosAHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "14:30" → "2:30 p. m." para mostrar. */
export function horaBonita(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const sufijo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${sufijo}`;
}

// El armado de espacios libres vive en mobile/src/lib/disponibilidad.ts
// (calcularDisponibilidad, gemelo del motor pro de /web): horario por
// recurso, buffers y bloqueos. El espaciosLibres v1 que vivía acá se
// retiró cuando la reserva pasó al motor pro (0081).

/** "45" → "45 min" · "90" → "1 h 30 min" — como lo muestra Fresha. */
export function etiquetaMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * El rango centinela que representa "ese día NO trabaja" en el horario
 * propio de un miembro (espejo de src/app/citas/tipos.ts de /web). El
 * esquema de horarios_recurso no puede decir "libre" directamente (un
 * día sin filas HEREDA el horario del negocio, 0061), así que un día
 * libre se guarda como un rango de un minuto a medianoche: ninguna
 * cita de 5+ minutos cabe ahí, y los tres motores lo tratan igual.
 */
export const RANGO_LIBRE = { abre: "00:00", cierra: "00:01" } as const;

/** ¿Estas filas de un día significan "no trabaja"? */
export function esDiaLibre(rangos: { abre: string; cierra: string }[]): boolean {
  return (
    rangos.length === 1 &&
    rangos[0].abre.slice(0, 5) === RANGO_LIBRE.abre &&
    rangos[0].cierra.slice(0, 5) === RANGO_LIBRE.cierra
  );
}

export function fechaISOLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sumarMinutosHora(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * La inversa de `instanteEnZona` (espejo de src/lib/agenda/zona.ts de
 * /web): de "esta fecha y hora DE PARED en la zona del negocio" al
 * instante UTC real. La necesitan los bloqueos de agenda
 * (bloqueos_agenda.inicio/fin son timestamptz). Sin librerías: se
 * propone el instante como si la pared fuera UTC y se corrige con lo
 * que `instanteEnZona` devuelva; dos pasadas alcanzan.
 */
export function utcDesdeZona(fecha: string, hora: string, zona: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const deseado = Date.UTC(y, m - 1, d, hh, mm);

  let instante = deseado;
  for (let i = 0; i < 2; i++) {
    const pared = instanteEnZona(new Date(instante).toISOString(), zona);
    const [py, pm, pd] = pared.fecha.split("-").map(Number);
    const obtenido = Date.UTC(py, pm - 1, pd, 0, pared.minutos);
    if (obtenido === deseado) break;
    instante += deseado - obtenido;
  }
  return new Date(instante);
}
