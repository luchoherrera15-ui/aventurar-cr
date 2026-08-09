/**
 * BOOKEA BUSINESS — qué clase de reserva es cada fila de `reservas`.
 *
 * `reservas` es UNA sola tabla que sirve a las cuatro verticales por
 * acumulación: nació para eventos y hoy también guarda citas, estadías
 * y mesas. Hasta la 0109 el "tipo" no existía como dato — se adivinaba
 * con `hora_inicio is not null`, un proxy que está grabado en más de
 * treinta lugares entre web y app.
 *
 * Esta función es la ÚNICA fuente de verdad del tipo. Es pura y no
 * toca Supabase, así que se prueba con datos de mentira.
 *
 * REGLA DE FONDO: `tipo_reserva` es un DATO, no un discriminador de
 * control. El disparador de cupo de la base sigue bifurcando por
 * `hora_inicio` y NO lee esta columna — si lo hiciera, las reservas de
 * servicios de eventos con hora (0067: el DJ de las 18:00) se irían de
 * la rama de solape a la de cupo diario y cambiaría su comportamiento
 * en producción.
 *
 * POR QUÉ SE DERIVA POR VERTICAL Y NO POR `hora_inicio`: justamente
 * por esas reservas de eventos con hora. Mirar la hora las tiparía
 * como citas, que es exactamente lo contrario de lo que son.
 */

export const TIPOS_RESERVA = ["cita", "clase", "evento", "estadia", "mesa"] as const;

export type TipoReserva = (typeof TIPOS_RESERVA)[number];

export function esTipoReserva(valor: string): valor is TipoReserva {
  return (TIPOS_RESERVA as readonly string[]).includes(valor);
}

/** Lo mínimo que hace falta para tipificar una fila. */
export type ReservaParaTipo = {
  tipo_reserva?: string | null;
  /** `ranchos.vertical` del negocio dueño de la reserva. */
  vertical?: string | null;
  estado?: string | null;
  origen?: string | null;
};

/**
 * El tipo de una reserva, o `null` cuando la fila NO es una reserva de
 * un cliente.
 *
 * Ese `null` es importante y no es un descuido: los compromisos que el
 * sync trae del calendario del dueño (0072) se guardan como filas de
 * `reservas` con `estado = 'bloqueada'` y `origen = 'sync'`, y tienen
 * hora igual que una cita. Tipificarlos como 'cita' haría que la cita
 * al dentista del dueño se contara junto a las de sus clientes en
 * cualquier reporte. Lo que son se sigue leyendo en `estado`; acá se
 * dice que no son tipificables.
 */
export function tipoReservaEfectivo(r: ReservaParaTipo): TipoReserva | null {
  if (r.estado === "bloqueada" || r.origen === "sync") return null;

  if (r.tipo_reserva && esTipoReserva(r.tipo_reserva)) return r.tipo_reserva;

  switch (r.vertical ?? "eventos") {
    case "citas":
      return "cita";
    case "hospedajes":
      return "estadia";
    case "restaurantes":
      return "mesa";
    case "eventos":
    default:
      return "evento";
  }
}

export const TIPO_RESERVA_LABEL: Record<TipoReserva, string> = {
  cita: "Cita",
  clase: "Clase",
  evento: "Evento",
  estadia: "Estadía",
  mesa: "Mesa",
};

/**
 * La concurrencia de un recurso, normalizada. `null` = 1 = exclusivo.
 *
 * Se normaliza ACÁ, en el borde, y nunca en la comparación: en
 * JavaScript `2 >= null` es `2 >= 0` (siempre cierto, o sea que el
 * recurso no tendría ningún espacio libre) y `2 >= undefined` es NaN
 * (siempre falso, o sea que dejaría de detectar choques). Las filas
 * llegan de Supabase con casts, así que TypeScript no atrapa ninguno
 * de los dos.
 *
 * El tope de 100 espeja el CHECK de la base (0109): un Infinity que se
 * cuele por acá dejaría la agenda sin tope.
 */
export function normalizarCupo(valor: unknown): number {
  return Math.min(100, Math.max(1, Math.trunc(Number(valor)) || 1));
}
