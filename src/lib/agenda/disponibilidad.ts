import {
  horaAMinutos,
  minutosAHora,
  type HorarioSemana,
} from "@/app/citas/tipos";
import { normalizarCupo } from "@/lib/reservas/tipo-reserva";

/**
 * FASE 2 de la Agenda — el motor PRO de disponibilidad.
 *
 * 100% PURO: recibe todos los datos ya cargados y no toca Supabase ni
 * el reloj — por eso se puede probar con datos de mentira y corre
 * igual en el servidor o en el navegador. Extiende `espaciosLibres`
 * (v1, src/app/citas/tipos.ts) con lo que llegó en la 0061:
 *
 * - Horario propio por recurso (horarios_recurso), con HERENCIA: un
 *   recurso sin horario propio trabaja el horario del negocio.
 * - Buffer del servicio (limpieza/preparación): el espacio que una
 *   cita ocupa es su duración + su buffer.
 * - Bloqueos (bloqueos_agenda_publicos): vacaciones u horas cerradas,
 *   de un recurso o del negocio entero, como instantes con zona
 *   horaria que acá se traducen al día consultado.
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
   * horario propio → hereda el del negocio. Un array vacío en un día
   * = ese día no trabaja.
   */
  horario: Partial<Record<string, { abre: string; cierra: string }[]>> | null;
  /**
   * Cuántas RESERVAS caben a la vez en este recurso
   * (`equipo_rancho.cupo_simultaneo`, 0109). null/ausente = 1 =
   * exclusivo, que es todo lo que existía antes.
   *
   * No confundir con `equipo_rancho.capacidad`, que son PERSONAS que
   * caben (el tamaño de una mesa) y que ningún motor lee.
   */
  cupoSimultaneo?: number | null;
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
  /**
   * ¿Esta fila tapa la franja ENTERA, sin importar el cupo del
   * recurso? (`disponibilidad_citas.exclusiva`, 0109 — es true para
   * las reservas en estado 'bloqueada': los compromisos que el sync
   * trae del calendario del dueño, 0072.)
   *
   * Ausente = true a propósito. Con cupo 1 da lo mismo (cualquier
   * solape tapa la franja igual), y con cupo mayor el lado
   * conservador es el correcto: preferimos no ofrecer una hora antes
   * que dejar que un cliente reserve encima de la cita médica del
   * dueño porque la vista todavía no tenía la columna.
   */
  exclusiva?: boolean;
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
  /** Anticipación mínima del servicio en horas (0118). Corre el corte
   * de "ya pasó" hacia adelante, para no ofrecer un espacio que el
   * motor va a rechazar. Necesita `ahora`; sin él no hace nada. */
  anticipacionMinHoras?: number;
};

export type Disponibilidad = {
  /** Espacios "HH:MM" por recurso (o llave "" si no hay equipo). */
  porRecurso: Record<string, string[]>;
  /** "Cualquier profesional": la unión, ordenada y sin repetidos. */
  cualquiera: string[];
};

/**
 * Días entre dos fechas "YYYY-MM-DD". Se arma en UTC a propósito: son
 * fechas de calendario, no instantes, y construirlas en la zona local
 * del servidor haría que un cambio de horario de verano corriera la
 * cuenta un día.
 */
function diasEntre(desde: string, hasta: string): number {
  const aUtc = (f: string) =>
    Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000);
}

/** El día de la semana (0=domingo) de una fecha "YYYY-MM-DD". */
export function diaDeSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Traduce un instante ISO a la fecha y minutos locales de una zona
 * IANA. Puro respecto al reloj: solo depende del instante recibido.
 */
export function instanteEnZona(
  iso: string,
  zona: string,
): { fecha: string; minutos: number } {
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

/**
 * Agrupa las filas de horarios_recurso en el objeto que espera
 * RecursoDisponibilidad: claves SOLO para los días con filas — un día
 * sin filas queda `undefined` y hereda el horario del negocio (misma
 * convención que el RPC crear_cita en la 0081).
 */
export function agruparHorarioRecurso(
  filas: { dow: number; abre: string; cierra: string }[],
): RecursoDisponibilidad["horario"] {
  if (filas.length === 0) return null;
  const horario: NonNullable<RecursoDisponibilidad["horario"]> = {};
  for (const f of filas) {
    (horario[String(f.dow)] ??= []).push({ abre: f.abre.slice(0, 5), cierra: f.cierra.slice(0, 5) });
  }
  return horario;
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

/** Un rango ya tomado, y si tapa la franja entera por sí solo. */
type RangoOcupado = Rango & { exclusiva: boolean };

/**
 * Los espacios libres de UN recurso: dentro de sus rangos laborales,
 * sin chocar con sus citas (cada una ocupa duración + buffer), ni con
 * sus bloqueos, ni con los del negocio entero.
 *
 * CONCURRENCIA (0109): `cupo` es cuántas reservas caben a la vez en el
 * recurso. Con cupo 1 — todo lo que existía antes — `choques.length >= 1`
 * es exactamente el `ocupados.some(...)` de siempre, así que el
 * veredicto no cambia para ningún negocio que no haya configurado nada.
 *
 * Lo que se cuenta son las reservas que TOCAN la franja pedida, que es
 * una cota superior de la concurrencia real en un instante: con cupo 2,
 * una de 09:00-09:30 y otra de 10:30-11:00 hacen que una de 09:15-10:45
 * vea dos choques y se rechace, aunque en ningún momento haya tres
 * encima. Sub-vende, nunca sobre-vende — es la dirección segura, y con
 * cupo 1 es indistinguible.
 */
function espaciosDeRecurso({
  rangos,
  duracion,
  buffer,
  intervalo,
  ocupados,
  bloqueados,
  desdeMinutos,
  cupo,
}: {
  rangos: Rango[];
  duracion: number;
  buffer: number;
  intervalo: number;
  ocupados: RangoOcupado[];
  bloqueados: Rango[];
  desdeMinutos: number;
  cupo: number;
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
      const choques = ocupados.filter((o) => seSolapan(o, ocupa));
      // Un bloqueo del calendario del dueño tapa la franja entera,
      // tenga el recurso el cupo que tenga.
      if (choques.some((o) => o.exclusiva)) continue;
      if (choques.length >= cupo) continue;
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
    anticipacionMinHoras,
  } = params;

  const dow = diaDeSemana(fecha);

  // Para hoy (en la zona del negocio) no se ofrecen horas pasadas, y
  // desde la 0118 tampoco las que caen dentro de la anticipación
  // mínima del servicio: crear_cita las rechazaría igual, así que
  // ofrecerlas solo sirve para que el cliente choque contra un error.
  let desdeMinutos = 0;
  if (ahora) {
    const local = instanteEnZona(ahora.toISOString(), zonaHoraria);
    if (local.fecha > fecha) return { porRecurso: {}, cualquiera: [] };
    // El margen puede pasar de la medianoche: con 48 horas de
    // anticipación el corte cae dos días adelante, así que se mide
    // desde el arranque del día consultado y no solo contra "hoy".
    const corte = local.minutos + 1 + Math.max(0, anticipacionMinHoras ?? 0) * 60;
    const diasDelta = diasEntre(local.fecha, fecha);
    desdeMinutos = Math.max(0, corte - diasDelta * 1440);
  }

  const bloqueosDia = bloqueos
    .map((b) => ({ miembroId: b.miembroId, rango: bloqueoDelDia(b, fecha, zonaHoraria) }))
    .filter((b): b is { miembroId: string | null; rango: Rango } => b.rango !== null);
  const bloqueosNegocio = bloqueosDia.filter((b) => b.miembroId === null).map((b) => b.rango);

  const citaARango = (c: CitaExistente): RangoOcupado => {
    const inicio = horaAMinutos(c.horaInicio.slice(0, 5));
    return {
      inicio,
      fin: inicio + c.duracionMinutos + (c.bufferMinutos ?? 0),
      // Sin dato, se asume exclusiva: ver el comentario de CitaExistente.
      exclusiva: c.exclusiva ?? true,
    };
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
      // Sin recurso (el negocio como recurso único) el cupo es 1: la
      // concurrencia se declara por recurso, y un negocio sin equipo
      // no tiene dónde ponerla.
      cupo: recurso ? normalizarCupo(recurso.cupoSimultaneo) : 1,
    }).map(minutosAHora);
  }

  const union = new Set<string>();
  for (const horas of Object.values(porRecurso)) for (const h of horas) union.add(h);
  const cualquiera = [...union].sort((a, b) => horaAMinutos(a) - horaAMinutos(b));

  return { porRecurso, cualquiera };
}
