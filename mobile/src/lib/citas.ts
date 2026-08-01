/**
 * La vertical de Citas en el app: espejo de src/app/citas/tipos.ts de
 * /web (misma base de Supabase, misma lógica pura de espacios libres).
 * Si cambiás algo acá, cambialo también allá — son gemelos a mano
 * porque el app no puede importar código del proyecto Next.
 */

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

export function fechaISOLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sumarMinutosHora(hhmm: string, minutos: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutos;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
