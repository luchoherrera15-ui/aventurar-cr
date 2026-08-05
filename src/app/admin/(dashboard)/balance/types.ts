export type ReservaBalance = {
  id: string;
  fecha: string;
  invitados: number | null;
  rancho_id: string | null;
  /** Opcionales: el select viejo no los traía; hacen falta para la
   *  tarifa por % del evento (0098). */
  estado?: string;
  monto_total?: number | null;
  monto_cobrado_final?: number | null;
};

export type RanchoBalance = {
  id: string;
  nombre: string;
};

export type Gasto = {
  id: string;
  concepto: string;
  categoria: string;
  monto: number;
  recurrencia: string;
  fecha: string;
  notas: string | null;
  /** Sección a la que pertenece el gasto; null = general de la plataforma. */
  vertical?: string | null;
};

export const CATEGORIAS = [
  "hosting",
  "dominio",
  "software",
  "publicidad",
  "otro",
] as const;

export const CATEGORIA_LABEL: Record<string, string> = {
  hosting: "Hosting",
  dominio: "Dominio",
  software: "Software",
  publicidad: "Publicidad",
  otro: "Otro",
};

export const RECURRENCIAS = ["mensual", "anual", "unico"] as const;

export const RECURRENCIA_LABEL: Record<string, string> = {
  mensual: "Mensual",
  anual: "Anual",
  unico: "Único",
};
