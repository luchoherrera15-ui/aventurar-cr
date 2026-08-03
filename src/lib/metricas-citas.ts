/**
 * Los números del negocio de citas — puro y sin Supabase, para poder
 * probarlo con datos de mentira. Es el "cómo va el mes" del panel:
 * cuántas citas, quién las atendió, qué servicios se piden y a qué
 * horas, y la tasa de no-shows (el dato que alimenta el re-enganche).
 */

export type CitaReporte = {
  fecha: string; // YYYY-MM-DD
  hora_inicio: string | null;
  estado: string;
  miembro_id: string | null;
  monto_total: number | null;
  tipo_evento: string | null;
};

export type ReporteMiembro = {
  miembroId: string | null;
  citas: number;
  cumplidas: number;
  noShows: number;
  ingresos: number;
};

export type ReporteCitas = {
  /** Citas reales del rango (sin bloqueos, holds ni temporales). */
  total: number;
  cumplidas: number;
  noShows: number;
  canceladas: number;
  /** Fecha ya pasada y siguen 'confirmada': nadie marcó asistencia. */
  sinMarcar: number;
  /** Lo cobrado en citas cumplidas. */
  ingresos: number;
  /** no-shows / (cumplidas + no-shows); null si no hay resueltas. */
  tasaNoShow: number | null;
  /** Ordenado por citas, de más a menos. */
  porMiembro: ReporteMiembro[];
  /** Top 5 por veces pedidas. */
  topServicios: { nombre: string; veces: number; ingresos: number }[];
  /** Actividad por hora del día (solo horas con citas). */
  horasPico: { hora: number; veces: number }[];
};

/** Los estados que cuentan como cita de un cliente real. */
const ESTADOS_CITA = new Set([
  "pendiente",
  "confirmada",
  "cumplida",
  "no_asistio",
  "cancelada",
  "rechazada",
]);

export function reporteCitas(citas: CitaReporte[], hoy: string): ReporteCitas {
  let cumplidas = 0;
  let noShows = 0;
  let canceladas = 0;
  let sinMarcar = 0;
  let ingresos = 0;
  const porMiembro = new Map<string | null, ReporteMiembro>();
  const porServicio = new Map<string, { veces: number; ingresos: number }>();
  const porHora = new Map<number, number>();
  let total = 0;

  for (const c of citas) {
    if (!ESTADOS_CITA.has(c.estado)) continue;
    total++;

    const monto = Number(c.monto_total ?? 0);
    if (c.estado === "cumplida") {
      cumplidas++;
      ingresos += monto;
    } else if (c.estado === "no_asistio") {
      noShows++;
    } else if (c.estado === "cancelada" || c.estado === "rechazada") {
      canceladas++;
    } else if (c.estado === "confirmada" && c.fecha < hoy) {
      sinMarcar++;
    }

    const m = porMiembro.get(c.miembro_id) ?? {
      miembroId: c.miembro_id,
      citas: 0,
      cumplidas: 0,
      noShows: 0,
      ingresos: 0,
    };
    m.citas++;
    if (c.estado === "cumplida") {
      m.cumplidas++;
      m.ingresos += monto;
    } else if (c.estado === "no_asistio") {
      m.noShows++;
    }
    porMiembro.set(c.miembro_id, m);

    const servicio = (c.tipo_evento ?? "").trim();
    if (servicio && c.estado !== "cancelada" && c.estado !== "rechazada") {
      const s = porServicio.get(servicio) ?? { veces: 0, ingresos: 0 };
      s.veces++;
      if (c.estado === "cumplida") s.ingresos += monto;
      porServicio.set(servicio, s);
    }

    // Actividad real: lo agendado que ocurrió u ocurrirá (los
    // cancelados no dicen nada de las horas pico).
    if (c.hora_inicio && c.estado !== "cancelada" && c.estado !== "rechazada") {
      const hora = Number(String(c.hora_inicio).slice(0, 2));
      if (Number.isInteger(hora)) porHora.set(hora, (porHora.get(hora) ?? 0) + 1);
    }
  }

  const resueltas = cumplidas + noShows;
  return {
    total,
    cumplidas,
    noShows,
    canceladas,
    sinMarcar,
    ingresos,
    tasaNoShow: resueltas > 0 ? noShows / resueltas : null,
    porMiembro: [...porMiembro.values()].sort((a, b) => b.citas - a.citas),
    topServicios: [...porServicio.entries()]
      .map(([nombre, s]) => ({ nombre, ...s }))
      .sort((a, b) => b.veces - a.veces)
      .slice(0, 5),
    horasPico: [...porHora.entries()]
      .map(([hora, veces]) => ({ hora, veces }))
      .sort((a, b) => a.hora - b.hora),
  };
}
