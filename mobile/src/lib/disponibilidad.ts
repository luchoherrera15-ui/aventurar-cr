import { horaAMinutos, minutosAHora, type HorarioSemana } from "./citas";

/**
 * El motor PRO de disponibilidad en el app: espejo a mano de
 * src/lib/agenda/disponibilidad.ts de /web (misma base de Supabase,
 * misma lógica pura). Si cambiás algo acá, cambialo también allá —
 * son gemelos porque el app no puede importar código del proyecto
 * Next. Y el RPC crear_cita (0081) valida exactamente estas reglas
 * en el servidor.
 *
 * Qué sabe este motor que espaciosLibres (v1) no sabía:
 * - Horario propio por recurso (horarios_recurso), con HERENCIA: un
 *   recurso sin horario propio trabaja el horario del negocio.
 * - Buffer del servicio (limpieza/preparación): el espacio que una
 *   cita ocupa es su duración + su buffer.
 * - Bloqueos (bloqueos_agenda_publicos): vacaciones u horas cerradas,
 *   de un recurso o del negocio entero.
 * - Asignación servicio↔recurso (servicios_recurso): sin filas, el
 *   servicio lo dan todos; con filas, solo esos.
 * - "Cualquier profesional": la unión de los espacios de los recursos.
 */

/** Un rango laboral dentro de un día, en minutos desde medianoche. */
export type Rango = { inicio: number; fin: number };

export type RecursoDisponibilidad = {
  id: string;
  /**
   * Horario propio: llaves "0" (domingo) a "6" (sábado), cada día con
   * sus rangos (puede ser partido: mañana y tarde). `null` = sin
   * horario propio → hereda el del negocio. La convención (igual que
   * la web y el RPC): claves SOLO para los días con filas.
   */
  horario: Partial<Record<string, { abre: string; cierra: string }[]>> | null;
};

export type BloqueoDisponibilidad = {
  /** null = bloquea el negocio completo. */
  miembroId: string | null;
  /** Instantes ISO con zona (timestamptz de bloqueos_agenda). */
  inicio: string;
  fin: string;
};

export type CitaExistente = {
  /** null = cita del negocio como recurso único (sin equipo). */
  miembroId: string | null;
  /** "HH:MM" o "HH:MM:SS" como viene de la vista de disponibilidad. */
  horaInicio: string;
  duracionMinutos: number;
  /** El buffer del servicio de ESA cita (0 si no se conoce). */
  bufferMinutos?: number;
};

export type ParametrosDisponibilidad = {
  /** El día consultado, "YYYY-MM-DD" en la zona del negocio. */
  fecha: string;
  /** Zona IANA del negocio (ranchos.zona_horaria). */
  zonaHoraria: string;
  /** Horario semanal del negocio (ranchos.detalles.horario_citas). */
  horarioNegocio: HorarioSemana | null;
  /** El equipo que puede dar el servicio. Vacío = el negocio es un
   * solo recurso sin equipo. */
  recursos: RecursoDisponibilidad[];
  /** Duración del servicio consultado, en minutos. */
  duracionMinutos: number;
  /** Buffer del servicio consultado (rancho_items.buffer_min). */
  bufferMinutos?: number;
  citas: CitaExistente[];
  bloqueos: BloqueoDisponibilidad[];
  /** Cada cuántos minutos se ofrece un espacio. */
  intervaloMinutos?: number;
  /** El instante actual — si el día consultado es "hoy" en la zona
   * del negocio, las horas ya pasadas no se ofrecen. Omitirlo = no
   * filtrar (útil en tests). */
  ahora?: Date;
};

export type Disponibilidad = {
  /** Espacios "HH:MM" por recurso (o llave "" si no hay equipo). */
  porRecurso: Record<string, string[]>;
  /** "Cualquier profesional": la unión, ordenada y sin repetidos. */
  cualquiera: string[];
};

/** El día de la semana (0=domingo) de una fecha "YYYY-MM-DD". */
export function diaDeSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Traduce un instante ISO a la fecha y minutos locales de una zona
 * IANA. En Hermes el Intl completo llegó hace poco: si el motor del
 * teléfono no soporta la zona, se cae con gracia a UTC-6 fijo — la
 * hora de Costa Rica, que no tiene horario de verano.
 */
export function instanteEnZona(
  iso: string,
  zona: string,
): { fecha: string; minutos: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const partes: Record<string, string> = {};
    for (const p of fmt.formatToParts(new Date(iso))) partes[p.type] = p.value;
    return {
      fecha: `${partes.year}-${partes.month}-${partes.day}`,
      minutos: Number(partes.hour) * 60 + Number(partes.minute),
    };
  } catch {
    const d = new Date(new Date(iso).getTime() - 6 * 60 * 60 * 1000);
    return {
      fecha: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
      minutos: d.getUTCHours() * 60 + d.getUTCMinutes(),
    };
  }
}

/** Recorta un bloqueo al día consultado, en minutos [0, 1440]. */
function bloqueoDelDia(
  bloqueo: BloqueoDisponibilidad,
  fecha: string,
  zona: string,
): Rango | null {
  const inicio = instanteEnZona(bloqueo.inicio, zona);
  const fin = instanteEnZona(bloqueo.fin, zona);

  // Fuera del día por completo.
  if (fin.fecha < fecha || inicio.fecha > fecha) return null;

  const desde = inicio.fecha < fecha ? 0 : inicio.minutos;
  const hasta = fin.fecha > fecha ? 1440 : fin.minutos;
  return desde < hasta ? { inicio: desde, fin: hasta } : null;
}

function seSolapan(a: Rango, b: Rango): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** Los rangos laborales del recurso ese día, con herencia del negocio. */
export function rangosDelDia(
  recurso: RecursoDisponibilidad | null,
  dow: number,
  horarioNegocio: HorarioSemana | null,
): Rango[] {
  const llave = String(dow);

  const propio = recurso?.horario?.[llave];
  if (recurso?.horario && propio !== undefined) {
    return propio.map((r) => ({ inicio: horaAMinutos(r.abre), fin: horaAMinutos(r.cierra) }));
  }
  // Herencia: sin horario propio (o sin ese día definido) rige el del
  // negocio.
  const negocio = horarioNegocio?.[llave];
  if (!negocio) return [];
  return [{ inicio: horaAMinutos(negocio.abre), fin: horaAMinutos(negocio.cierra) }];
}

/**
 * Los espacios libres de UN recurso: dentro de sus rangos laborales,
 * sin chocar con sus citas (cada una ocupa duración + buffer), ni con
 * sus bloqueos, ni con los del negocio entero.
 */
function espaciosDeRecurso({
  rangos,
  duracion,
  buffer,
  intervalo,
  ocupados,
  bloqueados,
  desdeMinutos,
}: {
  rangos: Rango[];
  duracion: number;
  buffer: number;
  intervalo: number;
  ocupados: Rango[];
  bloqueados: Rango[];
  desdeMinutos: number;
}): number[] {
  const libres: number[] = [];
  for (const rango of rangos) {
    for (let t = rango.inicio; t + duracion <= rango.fin; t += intervalo) {
      if (t < desdeMinutos) continue;
      // La cita nueva ocupa su atención + su buffer de limpieza; el
      // buffer puede correr después del cierre (es limpieza, no
      // atención), pero nunca encima de otra cita.
      const ocupa: Rango = { inicio: t, fin: t + duracion + buffer };
      const atiende: Rango = { inicio: t, fin: t + duracion };
      if (ocupados.some((o) => seSolapan(o, ocupa))) continue;
      if (bloqueados.some((b) => seSolapan(b, atiende))) continue;
      libres.push(t);
    }
  }
  return libres;
}

export function calcularDisponibilidad(params: ParametrosDisponibilidad): Disponibilidad {
  const {
    fecha,
    zonaHoraria,
    horarioNegocio,
    recursos,
    duracionMinutos,
    bufferMinutos = 0,
    citas,
    bloqueos,
    intervaloMinutos = 30,
    ahora,
  } = params;

  const dow = diaDeSemana(fecha);

  // Para hoy (en la zona del negocio) no se ofrecen horas pasadas.
  let desdeMinutos = 0;
  if (ahora) {
    const local = instanteEnZona(ahora.toISOString(), zonaHoraria);
    if (local.fecha === fecha) desdeMinutos = local.minutos + 1;
    else if (local.fecha > fecha) return { porRecurso: {}, cualquiera: [] };
  }

  const bloqueosDia = bloqueos
    .map((b) => ({ miembroId: b.miembroId, rango: bloqueoDelDia(b, fecha, zonaHoraria) }))
    .filter((b): b is { miembroId: string | null; rango: Rango } => b.rango !== null);
  const bloqueosNegocio = bloqueosDia.filter((b) => b.miembroId === null).map((b) => b.rango);

  const citaARango = (c: CitaExistente): Rango => {
    const inicio = horaAMinutos(c.horaInicio.slice(0, 5));
    return { inicio, fin: inicio + c.duracionMinutos + (c.bufferMinutos ?? 0) };
  };

  const porRecurso: Record<string, string[]> = {};

  // Sin equipo: el negocio entero es un único recurso ("") y chocan
  // todas las citas — el comportamiento v1 de espaciosLibres.
  const lista: (RecursoDisponibilidad | null)[] = recursos.length > 0 ? recursos : [null];

  for (const recurso of lista) {
    const id = recurso?.id ?? "";
    // Las citas sin miembro son del negocio entero y estorban a
    // CUALQUIER recurso: ahí viven los compromisos que el sync trae
    // del calendario del dueño (0072), que nunca llevan miembro.
    const ocupados = citas
      .filter((c) => (recurso ? c.miembroId === recurso.id || c.miembroId === null : true))
      .map(citaARango);
    const bloqueados = [
      ...bloqueosNegocio,
      ...bloqueosDia.filter((b) => recurso && b.miembroId === recurso.id).map((b) => b.rango),
    ];

    porRecurso[id] = espaciosDeRecurso({
      rangos: rangosDelDia(recurso, dow, horarioNegocio),
      duracion: duracionMinutos,
      buffer: bufferMinutos,
      intervalo: intervaloMinutos,
      ocupados,
      bloqueados,
      desdeMinutos,
    }).map(minutosAHora);
  }

  const union = new Set<string>();
  for (const horas of Object.values(porRecurso)) for (const h of horas) union.add(h);
  const cualquiera = [...union].sort((a, b) => horaAMinutos(a) - horaAMinutos(b));

  return { porRecurso, cualquiera };
}
