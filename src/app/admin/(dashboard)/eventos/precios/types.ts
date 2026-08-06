export type PrecioTier = {
  id: string;
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
  activo: boolean;
};
