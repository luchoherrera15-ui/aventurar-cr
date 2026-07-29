/**
 * La vertical de Citas: sus categorías, el horario semanal y el
 * armado de espacios libres. Todo puro y sin Supabase, para poder
 * probarlo con datos de mentira.
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

export type CitaOcupada = {
  hora_inicio: string; // "14:30:00" como viene de la vista
  duracion_minutos: number | null;
  miembro_id: string | null;
};

/**
 * Los espacios libres de un día, cada 30 minutos, para un servicio de
 * `duracionServicio` minutos:
 *
 * - Con una persona elegida: chocan solo las citas de ESA persona.
 * - Con "cualquiera" (miembroId null y hay equipo): el espacio está
 *   libre si al menos una persona del equipo no tiene choque.
 * - Sin equipo: el negocio es un solo recurso — choca cualquier cita.
 */
export function espaciosLibres({
  horarioDia,
  duracionServicio,
  ocupadas,
  miembroId,
  equipoIds,
  minutosMinimos,
}: {
  horarioDia: DiaHorario | undefined;
  duracionServicio: number;
  ocupadas: CitaOcupada[];
  miembroId: string | null;
  equipoIds: string[];
  /** Para hoy: no ofrecer horas que ya pasaron (minutos desde 00:00). */
  minutosMinimos?: number;
}): string[] {
  if (!horarioDia) return [];
  const abre = horaAMinutos(horarioDia.abre);
  const cierra = horaAMinutos(horarioDia.cierra);

  const chocaCon = (citas: CitaOcupada[], inicio: number, fin: number) =>
    citas.some((c) => {
      const cInicio = horaAMinutos(c.hora_inicio.slice(0, 5));
      const cFin = cInicio + (c.duracion_minutos ?? 30);
      return inicio < cFin && cInicio < fin;
    });

  const libres: string[] = [];
  for (let t = abre; t + duracionServicio <= cierra; t += 30) {
    if (minutosMinimos !== undefined && t < minutosMinimos) continue;
    const fin = t + duracionServicio;

    let libre: boolean;
    if (miembroId) {
      libre = !chocaCon(ocupadas.filter((c) => c.miembro_id === miembroId), t, fin);
    } else if (equipoIds.length > 0) {
      libre = equipoIds.some(
        (id) => !chocaCon(ocupadas.filter((c) => c.miembro_id === id), t, fin),
      );
    } else {
      libre = !chocaCon(ocupadas, t, fin);
    }
    if (libre) libres.push(minutosAHora(t));
  }
  return libres;
}

/** "45" → "45 min" · "90" → "1 h 30 min" — como lo muestra Fresha. */
export function etiquetaMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
