export type PrecioTier = {
  min_invitados: number;
  max_invitados: number;
  precio: number;
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

export type HorarioBloque = "manana_tarde" | "tarde_noche";
