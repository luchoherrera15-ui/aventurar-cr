export interface InvitacionHistorial {
  id: string;
  titulo: string;
  created_at: string;
  estado_generacion: string | null;
  modelo_usado?: string | null;
  costo_usd?: number | null;
  costo_tokens_input?: number | null;
  costo_tokens_output?: number | null;
  slug?: string;
  fecha_evento?: string;
  estado?: string;
}

export interface InvitacionConfig {
  tematica: string;
  personajes: string[];
  animaciones: string[];
  efectos: string[];
  titulo?: string;
  mensaje?: string;
}
