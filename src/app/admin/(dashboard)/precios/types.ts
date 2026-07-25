export type PrecioTier = {
  id: string;
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

export type ServicioAdicional = {
  id: string;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
  activo: boolean;
};
