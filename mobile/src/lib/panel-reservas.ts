import type { TonoEstado } from "@/components/ui";
import { DIAS_CORTO, MESES_CORTO, fechaISOLocal, horaBonita, sumarMinutosHora } from "@/lib/citas";
import {
  adelantoCobrado,
  aFecha,
  saldoPendiente,
  totalEvento,
  type ReservaFinanzas,
} from "@/lib/finanzas";

/**
 * El panel del dueño, en datos: la forma de una reserva tal como la lee
 * el panel (todas las columnas que sirven para auditar) y las tres
 * vistas que arma la pantalla de Inicio — lo que espera aprobación, la
 * agenda de los próximos días y el histórico con la plata.
 *
 * Vive en lib y no dentro de la pantalla a propósito: es orden y
 * aritmética, sin React, igual que metricas.ts en /web. Y la plata NO
 * se recalcula acá: sale de lib/finanzas (adelantoCobrado,
 * saldoPendiente, totalEvento), que es el gemelo exacto del sitio — un
 * mismo evento tiene que dar el mismo número en la compu y en el
 * teléfono.
 */

export type EstadoReserva = ReservaFinanzas["estado"];

/**
 * Una reserva con todo lo que el dueño necesita para auditarla: quién
 * la hizo, con qué correo, cuándo la hizo (created_at, con hora), qué
 * día es el evento, cuánto entró y cuánto falta.
 *
 * Extiende `ReservaFinanzas` en vez de repetir sus campos: así las
 * funciones de plata la aceptan tal cual, sin conversiones ni castings.
 */
export type ReservaPanel = ReservaFinanzas & {
  /** Cuándo se hizo la reserva (no cuándo es el evento). */
  created_at: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  duracion_minutos: number | null;
  horario_bloque: string | null;
  correo: string | null;
  whatsapp: string | null;
  contacto: string | null;
  cedula: string | null;
  notas: string | null;
  metodo_pago: string | null;
  origen: string | null;
  codigo_descuento: string | null;
  descuento_monto: number | null;
  deposito_comprobante_url: string | null;
};

export const ESTADO_LABEL: Record<EstadoReserva, string> = {
  pendiente: "Por aceptar",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  bloqueada: "Bloqueada",
  temporal: "Sin terminar",
  cancelada: "Cancelada",
  cumplida: "Cumplida",
  no_asistio: "No asistió",
};

/** El mismo código de color que la agenda y las reservas del cliente. */
export const ESTADO_TONO: Record<EstadoReserva, TonoEstado> = {
  pendiente: "naranja",
  confirmada: "verde",
  rechazada: "rojo",
  bloqueada: "gris",
  temporal: "gris",
  cancelada: "gris",
  cumplida: "verde",
  no_asistio: "rojo",
};

export const METODO_PAGO_LABEL: Record<string, string> = {
  sinpe: "SINPE Móvil",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
};

export const ORIGEN_LABEL: Record<string, string> = {
  web: "Sitio web",
  movil: "App móvil",
  manual: "Cargada a mano",
};

/**
 * ¿Esto lo hizo un cliente? Un bloqueo es un día que el dueño cerró a
 * mano y un "temporal" es un carrito a medio llenar: ninguno de los dos
 * es historia que auditar (sí ocupan la agenda, eso es aparte).
 */
export function esDeCliente(r: ReservaPanel): boolean {
  return r.estado !== "bloqueada" && r.estado !== "temporal";
}

/** Las que esperan el sí o el no del dueño, la más nueva primero. */
export function porAceptar(reservas: ReservaPanel[]): ReservaPanel[] {
  return reservas
    .filter((r) => r.estado === "pendiente")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * El histórico de auditoría: las últimas reservas REALIZADAS, ordenadas
 * por cuándo se hicieron (created_at), no por cuándo es el evento.
 */
export function historico(reservas: ReservaPanel[], limite = 40): ReservaPanel[] {
  return reservas
    .filter(esDeCliente)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limite);
}

export type MontosReserva = {
  /** Lo que ya entró: el adelanto que el dueño dio por recibido. */
  adelanto: number;
  /** Lo que falta cobrar el día del evento. */
  pendiente: number;
  /** Lo que vale el evento (manda lo cobrado de verdad). */
  total: number;
};

export function montosDe(r: ReservaPanel): MontosReserva {
  return {
    adelanto: adelantoCobrado(r),
    pendiente: saldoPendiente(r),
    total: totalEvento(r),
  };
}

/* ------------------------------------------------------------------ */
/* Avisos: lo que le pide algo al dueño                                 */
/* ------------------------------------------------------------------ */

export type Avisos = {
  /** Reservas nuevas esperando el sí o el no. */
  porAceptar: ReservaPanel[];
  /** Adelantos transferidos que el dueño todavía no dio por recibidos. */
  adelantosPorValidar: { conteo: number; monto: number };
  /** Eventos que ya pasaron y siguen debiendo el saldo. */
  saldosVencidos: { conteo: number; monto: number };
};

export function avisosDe(reservas: ReservaPanel[], hoy = new Date()): Avisos {
  const hoyISO = fechaISOLocal(hoy);

  let validarConteo = 0;
  let validarMonto = 0;
  let vencidoConteo = 0;
  let vencidoMonto = 0;

  for (const r of reservas) {
    const deposito = Number(r.deposito_monto ?? 0);
    if (r.estado === "confirmada" && !r.deposito_validado && deposito > 0) {
      validarConteo += 1;
      validarMonto += deposito;
    }
    // Vencido = el evento ya pasó y el saldo sigue abierto. Solo cuenta
    // en las que siguen vivas: una rechazada o cancelada no debe nada.
    const viva = r.estado === "confirmada" || r.estado === "cumplida";
    if (viva && r.fecha < hoyISO) {
      const saldo = saldoPendiente(r);
      if (saldo > 0) {
        vencidoConteo += 1;
        vencidoMonto += saldo;
      }
    }
  }

  return {
    porAceptar: porAceptar(reservas),
    adelantosPorValidar: { conteo: validarConteo, monto: validarMonto },
    saldosVencidos: { conteo: vencidoConteo, monto: vencidoMonto },
  };
}

/* ------------------------------------------------------------------ */
/* Agenda                                                               */
/* ------------------------------------------------------------------ */

export type DiaAgenda = {
  /** "2026-08-06" */
  iso: string;
  fecha: Date;
  esHoy: boolean;
  reservas: ReservaPanel[];
};

/** Los estados que de verdad ocupan el día (lo cancelado no estorba). */
const OCUPAN = new Set<EstadoReserva>([
  "pendiente",
  "confirmada",
  "bloqueada",
  "cumplida",
  "no_asistio",
]);

/** Cuántos días como mucho puede abarcar una reserva de varias fechas. */
const MAX_DIAS_RESERVA = 60;

/** Los días ISO que ocupa una reserva (una noche o un fin de semana entero). */
function diasQueOcupa(r: ReservaPanel): string[] {
  const inicio = r.fecha.slice(0, 10);
  const fin = r.fecha_fin?.slice(0, 10);
  if (!fin || fin <= inicio) return [inicio];

  const salida: string[] = [];
  const cursor = aFecha(inicio);
  const limite = aFecha(fin);
  while (cursor <= limite && salida.length < MAX_DIAS_RESERVA) {
    salida.push(fechaISOLocal(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return salida;
}

/** Primero por hora; lo que no tiene hora (un bloque de día) va arriba. */
function ordenDelDia(a: ReservaPanel, b: ReservaPanel): number {
  const ha = a.hora_inicio ?? "";
  const hb = b.hora_inicio ?? "";
  if (ha !== hb) return ha.localeCompare(hb);
  return (a.nombre ?? "").localeCompare(b.nombre ?? "");
}

/**
 * La agenda de los próximos días: una fila por día — incluso los
 * vacíos, que en una agenda valen tanto como los llenos.
 */
export function diasDeAgenda(reservas: ReservaPanel[], dias: number, hoy = new Date()): DiaAgenda[] {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const hoyISO = fechaISOLocal(base);

  const porDia = new Map<string, ReservaPanel[]>();
  const salida: DiaAgenda[] = [];
  for (let i = 0; i < dias; i += 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const iso = fechaISOLocal(d);
    porDia.set(iso, []);
    salida.push({ iso, fecha: d, esHoy: iso === hoyISO, reservas: [] });
  }

  for (const r of reservas) {
    if (!OCUPAN.has(r.estado)) continue;
    for (const iso of diasQueOcupa(r)) {
      porDia.get(iso)?.push(r);
    }
  }

  return salida.map((d) => ({
    ...d,
    reservas: (porDia.get(d.iso) ?? []).sort(ordenDelDia),
  }));
}

/* ------------------------------------------------------------------ */
/* Textos                                                              */
/* ------------------------------------------------------------------ */

/** "sáb 12 oct" — la fecha corta que se repite en todo el panel. */
export function fechaCorta(iso: string): string {
  const d = aFecha(iso);
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}

/** "12 oct 2026" — para fechas que no son de esta semana. */
export function fechaConAnio(iso: string): string {
  const d = aFecha(iso);
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * El día del evento tal como se anuncia: "sáb 12 oct" o
 * "sáb 12 oct → dom 13 oct" si son varias fechas.
 */
export function fechaDelEvento(r: ReservaPanel): string {
  const inicio = fechaCorta(r.fecha);
  const fin = r.fecha_fin?.slice(0, 10);
  if (!fin || fin <= r.fecha.slice(0, 10)) return inicio;
  return `${inicio} → ${fechaCorta(fin)}`;
}

/**
 * El horario del evento: la hora con su fin cuando se sabe cuánto dura
 * ("2:00 p. m. – 2:45 p. m."), o el bloque que vende el lugar
 * ("Día completo"). null cuando la reserva es del día entero.
 */
export function horarioDelEvento(r: ReservaPanel): string | null {
  if (r.hora_inicio) {
    const inicio = r.hora_inicio.slice(0, 5);
    if (!r.duracion_minutos) return horaBonita(inicio);
    return `${horaBonita(inicio)} – ${horaBonita(sumarMinutosHora(inicio, r.duracion_minutos))}`;
  }
  const bloque = r.horario_bloque?.trim();
  return bloque ? bloque : null;
}

/** Solo la hora de arranque, para la columna de la agenda. */
export function horaDelDia(r: ReservaPanel): string {
  if (r.hora_inicio) return horaBonita(r.hora_inicio.slice(0, 5));
  const bloque = r.horario_bloque?.trim();
  return bloque ? bloque : "Todo el día";
}

/**
 * El sello de auditoría de un instante guardado en la base:
 * "3 ago 2026, 2:14 p. m." — con hora, que es justo lo que se quiere
 * saber de "cuándo se hizo la reserva".
 */
export function selloDeTiempo(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]} ${d.getFullYear()}, ${horaBonita(hora)}`;
}
