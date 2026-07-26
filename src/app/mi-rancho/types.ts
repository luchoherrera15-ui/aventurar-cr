export const PROVINCIAS = [
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limón",
] as const;

export type Provincia = (typeof PROVINCIAS)[number];

export type EstadoRancho = "pendiente" | "aprobado" | "rechazado";

export type Rancho = {
  id: string;
  owner_id: string;
  nombre: string;
  descripcion: string | null;
  provincia: Provincia | null;
  canton: string | null;
  capacidad_min: number | null;
  capacidad_max: number | null;
  precio_desde: number | null;
  contacto_whatsapp: string | null;
  fotos: string[];
  estado: EstadoRancho;
  created_at: string;
};
