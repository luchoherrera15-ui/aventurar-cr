/**
 * La HORA de una reserva cargada a mano.
 *
 * 100% PURO: no toca Supabase ni el reloj. Contesta una sola pregunta —
 * qué columnas de horario le corresponden a esta reserva según cómo
 * agenda el negocio — y la contesta IGUAL que el importador de agenda,
 * a propósito.
 *
 * Por qué existe. `crearReservaManual` (el formulario del calendario del
 * panel) nunca escribía `hora_inicio`. La vista `disponibilidad_citas`
 * —de donde la agenda pública saca las franjas tomadas— filtra con
 * `hora_inicio is not null`, así que la reserva que el DJ apuntaba a
 * mano se veía en su panel y NO le tapaba una sola hora al cliente: la
 * agenda pública le seguía ofreciendo ese sábado a otra persona. Doble
 * reserva en silencio. El importador ya lo tenía resuelto
 * (`aFilaReserva`); esta es la MISMA regla, compartida en vez de
 * repetida, para que las dos puertas a `reservas` no supongan cosas
 * distintas.
 *
 * Quién trabaja por franjas lo decide `ocupaFranjaHoraria`, el
 * discriminador oficial (`usaAgendaPorHoras` + Restaurantes). Acá no se
 * escribe ninguna condición nueva sobre verticales ni categorías.
 */

import {
  duracionHoras,
  duracionPorDefecto,
  etiquetaHorario,
  ocupaFranjaHoraria,
} from "./importar-agenda";

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Cómo agenda el negocio — tal cual salen las dos columnas de `ranchos`. */
export type NegocioHorario = {
  vertical: string | null | undefined;
  categoria: string | null | undefined;
};

/** Lo que el dueño escribió en el formulario. "" y null son lo mismo. */
export type HorarioEscrito = {
  /** "HH:MM" */
  horaInicio: string | null | undefined;
  /** "HH:MM". Opcional: sin ella se asume el bloque por defecto. */
  horaFin: string | null | undefined;
};

export type ResultadoHorario =
  | { error: string; campos?: undefined }
  | { error: null; campos: Record<string, unknown> };

/** ¿A este negocio hay que pedirle la hora al cargar una reserva? */
export function pideHoraReserva(negocio: NegocioHorario): boolean {
  return ocupaFranjaHoraria(negocio.vertical, negocio.categoria);
}

/**
 * Las columnas de horario que le tocan a una reserva manual de este
 * negocio, o el error que hay que mostrarle al dueño.
 *
 * Un negocio que NO agenda por franjas (un lugar de alquiler: se alquila
 * la fecha entera, con depósito y calendario por día) sale de acá con el
 * objeto VACÍO — ni una columna de más. Su reserva se guarda hoy
 * exactamente igual que antes de que esto existiera; su horario sigue
 * siendo el texto libre de `horario_bloque`, que se escribe desde
 * "Modificar" y no desde un campo de hora que él nunca pidió.
 */
export function resolverHorarioReserva(
  negocio: NegocioHorario,
  escrito: HorarioEscrito,
): ResultadoHorario {
  if (!pideHoraReserva(negocio)) return { error: null, campos: {} };

  const vertical = negocio.vertical ?? "eventos";
  const inicio = escrito.horaInicio?.trim() || null;
  const fin = escrito.horaFin?.trim() || null;

  if (!inicio) {
    return {
      error:
        vertical === "citas"
          ? "Una cita necesita hora de inicio."
          : vertical === "restaurantes"
            ? "Una reserva de mesa necesita hora."
            : "Poné la hora de inicio: tu agenda se reserva por horas y sin ella esta fecha no le tapa ninguna hora a los clientes.",
    };
  }
  if (!HORA_RE.test(inicio)) {
    return { error: "La hora de inicio no es válida (HH:MM)." };
  }
  if (fin && !HORA_RE.test(fin)) {
    return { error: "La hora de cierre no es válida (HH:MM)." };
  }

  const horas = fin ? duracionHoras(inicio, fin) : null;

  // `hora_inicio` es lo único que hace que esta fila EXISTA para
  // `disponibilidad_citas`. Sin hora de cierre se asume el mismo bloque
  // que asume la agenda pública del negocio (120 min en eventos, 60 en
  // el resto) — si acá se pusiera otro número, el bloqueo taparía la
  // mitad de lo que de verdad ocupa.
  const campos: Record<string, unknown> = {
    hora_inicio: inicio,
    duracion_minutos: horas != null ? Math.round(horas * 60) : duracionPorDefecto(vertical),
  };

  // Un proveedor de eventos ADEMÁS conserva el texto del bloque: el
  // panel, los correos y el feed .ics vienen leyendo `horario_bloque`
  // desde siempre. Mismo trato que le da `aFilaReserva`.
  if (vertical === "eventos" && fin && horas != null) {
    campos.horario_bloque = etiquetaHorario(inicio, fin);
    campos.duracion_horas = horas;
  }

  return { error: null, campos };
}
