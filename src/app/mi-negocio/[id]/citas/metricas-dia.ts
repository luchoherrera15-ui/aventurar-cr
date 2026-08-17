/**
 * LOS NÚMEROS DEL DÍA de la pantalla de Citas.
 *
 * Regla única de este archivo: NO SE PINTA UN NÚMERO QUE NO SALGA DE LA
 * BASE. Todo lo de acá se deriva de lo que la pantalla YA cargó para
 * dibujar la agenda —las citas de hoy, el equipo, el horario semanal,
 * el horario propio de cada quien y los bloqueos—, así que no hay una
 * sola consulta de más ni un solo dato de ejemplo.
 *
 * Lo que quedó AFUERA a propósito, y por qué:
 *
 *   · «+12% vs. el mes pasado». Un porcentaje contra el mes anterior
 *     compara un mes a medias contra uno completo; y para hacerlo bien
 *     haría falta saber CUÁNDO se cobró cada cita, no solo la fecha de
 *     la cita. Los rangos reales (30/90/365 días) ya están en la
 *     sección "Cómo va el negocio", calculados sobre las reservas.
 *   · «Clientes nuevos este mes». La ficha de cliente se deriva al
 *     vuelo (lib/crm-citas) y no expone la primera visita; recalcular
 *     la identidad acá duplicaría la regla de agrupación y contaría dos
 *     veces a quien reservó con cuenta y también a mano.
 *   · «3 alertas de stock», «₡286k por liquidar», «2 fichas por
 *     revisar». Inventario, comisiones y fichas no existen todavía como
 *     tablas: no hay de dónde sacarlos.
 *
 * Módulo NEUTRAL (sin "use client"): lo llama la página en el servidor.
 */

import {
  agruparHorarioRecurso,
  diaDeSemana,
  instanteEnZona,
  rangosDelDia,
  type Rango,
} from "@/lib/agenda/disponibilidad";
import type { HorarioSemana } from "@/app/citas/tipos";

/** Lo que se necesita de una cita del día (subconjunto de `CitaDia`). */
export type CitaParaMetricas = {
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  estado: string;
  monto_total: number | null;
  evento_pagado: boolean;
  monto_cobrado_final: number | null;
};

/** Lo que se necesita de un colaborador (subconjunto de `MiembroEquipo`). */
export type MiembroParaMetricas = {
  id: string;
  activo: boolean;
  /** Reservas simultáneas que aguanta el recurso (0109). Ausente = 1. */
  cupo_simultaneo?: number | null;
};

/** Lo que se necesita de un bloqueo (subconjunto de `BloqueoAgenda`). */
export type BloqueoParaMetricas = {
  /** null = bloquea el negocio entero. */
  miembro_id: string | null;
  inicio: string;
  fin: string;
};

/**
 * Las citas de verdad del día: una persona que viene (o que no vino).
 * Las canceladas ya no son el día de nadie y las `bloqueada` son
 * compromisos del calendario del dueño (0072), no clientes.
 */
const ESTADOS_REALES = new Set(["pendiente", "confirmada", "cumplida", "no_asistio"]);

/** Las que todavía pueden pagar. A quien no vino no se le está cobrando. */
const ESTADOS_COBRABLES = new Set(["pendiente", "confirmada", "cumplida"]);

/** Sin duración guardada, la agenda dibuja 30 min: acá se mide igual. */
const DURACION_POR_DEFECTO = 30;

export type MetricasDia = {
  /** Citas reales del día (sin canceladas ni bloqueos). */
  total: number;
  confirmadas: number;
  sinConfirmar: number;
  yaVinieron: number;
  noVinieron: number;
  /** Minutos que ocupan esas citas. */
  minutosAgendados: number;
  /** Minutos de trabajo del día, ya descontados los bloqueos. */
  minutosDeAgenda: number;
  /**
   * Porcentaje redondeado de agenda ocupada, o `null` cuando no hay
   * jornada contra la cual medir (nadie trabaja hoy, o el negocio
   * todavía no configuró su horario). `null` NO es 0%: es "este número
   * no se puede saber", y la tarjeta no se pinta.
   *
   * Puede pasar de 100 si se agendó por encima del horario — se muestra
   * tal cual, junto a las dos horas crudas de las que sale.
   */
  ocupacion: number | null;
  /** Lo marcado como cobrado en el día (misma definición que la agenda). */
  cobrado: number;
  /** Lo que queda por cobrar de las citas de hoy. */
  porCobrar: number;
};

/**
 * Lo que vale una cita: manda lo cobrado de verdad sobre la cotización
 * —es `totalEvento` de lib/finanzas—. No se usa aquella función porque
 * pide la fila completa de una reserva de eventos (adelanto, invitados,
 * fechas de pago) y en Citas el adelanto es SIEMPRE 0: tanto el RPC
 * `crear_cita` (0081) como `crearCitaManual` insertan `deposito_monto:
 * 0`, así que `totalEvento`/`saldoPendiente` se reducen a esto.
 */
function montoDe(c: CitaParaMetricas): number {
  return Number(c.monto_cobrado_final ?? c.monto_total ?? 0);
}

function minutosDe(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** El rango centinela de "día libre" (00:00–00:01) NO es jornada. */
function esRangoLibre(r: Rango): boolean {
  return r.inicio === 0 && r.fin <= 1;
}

/** Une rangos que se tocan o se solapan, para no contar minutos dos veces. */
function unir(rangos: Rango[]): Rango[] {
  const ordenados = rangos
    .filter((r) => r.fin > r.inicio)
    .sort((a, b) => a.inicio - b.inicio);
  const unidos: Rango[] = [];
  for (const r of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && r.inicio <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, r.fin);
    else unidos.push({ ...r });
  }
  return unidos;
}

function largo(rangos: Rango[]): number {
  return rangos.reduce((suma, r) => suma + (r.fin - r.inicio), 0);
}

/** `base` menos `quitar` — ambos ya unidos y ordenados. */
function restar(base: Rango[], quitar: Rango[]): Rango[] {
  let resto = base;
  for (const q of quitar) {
    const nuevo: Rango[] = [];
    for (const r of resto) {
      if (q.fin <= r.inicio || q.inicio >= r.fin) {
        nuevo.push(r);
        continue;
      }
      if (q.inicio > r.inicio) nuevo.push({ inicio: r.inicio, fin: q.inicio });
      if (q.fin < r.fin) nuevo.push({ inicio: q.fin, fin: r.fin });
    }
    resto = nuevo;
  }
  return resto;
}

/**
 * El pedazo de un bloqueo que cae en el día consultado, en minutos.
 * `disponibilidad.ts` tiene el mismo cálculo pero sin exportar; se
 * repite acá (seis líneas) en vez de tocar ese archivo, que es el motor
 * de la reserva pública y no debe moverse por una métrica del panel.
 */
function rangoDelBloqueo(
  bloqueo: BloqueoParaMetricas,
  fecha: string,
  zona: string,
): Rango | null {
  const inicio = instanteEnZona(bloqueo.inicio, zona);
  const fin = instanteEnZona(bloqueo.fin, zona);
  if (fin.fecha < fecha || inicio.fecha > fecha) return null;
  const desde = inicio.fecha < fecha ? 0 : inicio.minutos;
  const hasta = fin.fecha > fecha ? 1440 : fin.minutos;
  return desde < hasta ? { inicio: desde, fin: hasta } : null;
}

export type ParametrosMetricasDia = {
  /** El día que se está mirando, "YYYY-MM-DD". */
  fecha: string;
  /** Zona del negocio: los bloqueos son timestamptz. */
  zona: string;
  citas: CitaParaMetricas[];
  equipo: MiembroParaMetricas[];
  /** El horario semanal del negocio (ranchos.detalles.horario_citas). */
  horario: HorarioSemana | null;
  /** Horario propio por colaborador (0061), como lo arma la página. */
  horariosPorMiembro: Record<string, { dow: number; abre: string; cierra: string }[]>;
  bloqueos: BloqueoParaMetricas[];
};

/**
 * La jornada del día en minutos: la suma de lo que trabaja cada
 * colaborador activo, menos lo que tiene bloqueado.
 *
 * Sin equipo activo el negocio ES el recurso (una sola columna, igual
 * que la agenda). El horario propio manda sobre el del negocio y un día
 * libre no suma nada — misma herencia que usa la reserva pública, por
 * `rangosDelDia`, para que el denominador de la ocupación sea
 * exactamente el horario en el que un cliente puede reservar.
 */
export function minutosDeAgenda({
  fecha,
  zona,
  citas,
  equipo,
  horario,
  horariosPorMiembro,
  bloqueos,
}: ParametrosMetricasDia): number {
  const dow = diaDeSemana(fecha);
  const activos = equipo.filter((m) => m.activo);
  const columnas: { id: string | null; cupo: number }[] =
    activos.length > 0
      ? activos.map((m) => ({
          id: m.id as string | null,
          cupo: Math.max(1, Number(m.cupo_simultaneo ?? 1)),
        }))
      : [{ id: null, cupo: 1 }];

  // Los bloqueos del negocio entero (miembro_id null) le quitan horas a
  // TODAS las columnas: es lo que significan.
  const delNegocio = bloqueos
    .filter((b) => b.miembro_id === null)
    .map((b) => rangoDelBloqueo(b, fecha, zona))
    .filter((r): r is Rango => r !== null);

  let total = 0;
  for (const col of columnas) {
    const recurso =
      col.id === null
        ? null
        : { id: col.id, horario: agruparHorarioRecurso(horariosPorMiembro[col.id] ?? []) };
    const trabajo = unir(
      rangosDelDia(recurso, dow, horario).filter((r) => !esRangoLibre(r)),
    );
    if (trabajo.length === 0) continue;

    const propios = bloqueos
      .filter((b) => b.miembro_id === col.id)
      .map((b) => rangoDelBloqueo(b, fecha, zona))
      .filter((r): r is Rango => r !== null);

    // Un compromiso traído del calendario del dueño (estado
    // 'bloqueada') tampoco es hora disponible: baja la jornada de SU
    // columna. Si no tiene columna (viene sin asignar y el negocio sí
    // tiene equipo) no se adivina de quién es.
    const sincronizados = citas
      .filter((c) => c.estado === "bloqueada" && c.miembro_id === col.id)
      .map((c) => {
        const ini = minutosDe(c.hora_inicio.slice(0, 5));
        return { inicio: ini, fin: ini + (c.duracion_minutos ?? DURACION_POR_DEFECTO) };
      });

    const cerrado = unir([...delNegocio, ...propios, ...sincronizados]);
    total += largo(restar(trabajo, cerrado)) * col.cupo;
  }

  return total;
}

/** Todos los números del día, de una pasada. */
export function metricasDelDia(params: ParametrosMetricasDia): MetricasDia {
  const reales = params.citas.filter((c) => ESTADOS_REALES.has(c.estado));

  let minutosAgendados = 0;
  let cobrado = 0;
  let porCobrar = 0;
  for (const c of reales) {
    minutosAgendados += c.duracion_minutos ?? DURACION_POR_DEFECTO;
    if (c.evento_pagado) cobrado += montoDe(c);
    else if (ESTADOS_COBRABLES.has(c.estado)) porCobrar += Number(c.monto_total ?? 0);
  }

  const jornada = minutosDeAgenda(params);

  return {
    total: reales.length,
    confirmadas: reales.filter((c) => c.estado === "confirmada").length,
    sinConfirmar: reales.filter((c) => c.estado === "pendiente").length,
    yaVinieron: reales.filter((c) => c.estado === "cumplida").length,
    noVinieron: reales.filter((c) => c.estado === "no_asistio").length,
    minutosAgendados,
    minutosDeAgenda: jornada,
    ocupacion: jornada > 0 ? Math.round((minutosAgendados / jornada) * 100) : null,
    cobrado,
    porCobrar,
  };
}

/** "510" → "8 h 30 min" para las horas de la jornada. */
export function etiquetaHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
