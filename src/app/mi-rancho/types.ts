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

export const CATEGORIAS = [
  "salon",
  "mobiliario",
  "dj",
  "animador",
  "revelacion_sexo",
  "otro",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  salon: "Salones y lugares",
  mobiliario: "Alquiler de mobiliario",
  dj: "DJs",
  animador: "Animadores",
  revelacion_sexo: "Revelaciones de sexo",
  otro: "Otros servicios",
};

export const CATEGORIA_ICONO: Record<Categoria, string> = {
  salon: "🏡",
  mobiliario: "🪑",
  dj: "🎧",
  animador: "🎉",
  revelacion_sexo: "🎈",
  otro: "✨",
};

export type Rancho = {
  id: string;
  owner_id: string;
  nombre: string;
  descripcion: string | null;
  categoria: Categoria;
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
