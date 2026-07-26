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

// Fondo para cuando el negocio todavía no subió su foto principal.
export const CATEGORIA_GRADIENTE: Record<Categoria, string> = {
  salon: "linear-gradient(160deg, #201512 0%, #2e1f14 45%, #1c1712 100%)",
  mobiliario: "linear-gradient(160deg, #101c22 0%, #16302d 45%, #2a2c22 100%)",
  dj: "linear-gradient(160deg, #17122a 0%, #241a3d 45%, #12101c 100%)",
  animador: "linear-gradient(160deg, #2a1420 0%, #3d1f2b 45%, #1c1216 100%)",
  revelacion_sexo: "linear-gradient(160deg, #1a1f2e 0%, #2d2440 45%, #16121c 100%)",
  otro: "linear-gradient(160deg, #1a1a1a 0%, #2a2a2a 45%, #141414 100%)",
};

// Recomendación de tamaño para la foto principal (relación 4:3, buena
// para que se vea bien tanto en la card como de fondo con texto encima).
export const FOTO_ANCHO_MIN = 1200;
export const FOTO_ALTO_MIN = 900;

export type Rancho = {
  id: string;
  owner_id: string;
  nombre: string;
  descripcion: string | null;
  categoria: Categoria;
  provincia: Provincia | null;
  canton: string | null;
  direccion_exacta: string | null;
  capacidad_min: number | null;
  capacidad_max: number | null;
  precio_desde: number | null;
  contacto_whatsapp: string | null;
  foto_url: string | null;
  deposito_reserva: number;
  tarifa_diciembre_por_persona: number | null;
  fotos: string[];
  estado: EstadoRancho;
  created_at: string;
};

export type PrecioTier = {
  id: string;
  rancho_id: string | null;
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

export type ServicioAdicional = {
  id: string;
  rancho_id: string | null;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
  activo: boolean;
};
