export type PrecioTier = {
  min_invitados: number;
  max_invitados: number;
  precio: number;
  /** 'normal' = todo el año; 'diciembre' = solo ese mes (0099).
   *  Opcional para tolerar bases sin esa migración. */
  temporada?: "normal" | "diciembre" | null;
};

export type ServicioAdicional = {
  id: string;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
};

export type DiaDisponibilidad = {
  confirmada: boolean;
  pendientes: number;
  temporales: number;
};

/**
 * El horario de la reserva se guarda como el texto del bloque que el
 * dueño configuró ("Mañana (7:00 a.m. – 1:00 p.m.)"), no como un
 * código fijo: los bloques ya no los define la plataforma.
 */
export type HorarioBloque = string;
