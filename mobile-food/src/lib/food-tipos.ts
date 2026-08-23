/**
 * Los tipos de fila de las tablas food_* (migración 0190 de /web) y
 * los formateadores compartidos. Espejo de src/lib/food/tipos.ts de
 * /web — dos proyectos npm independientes, en paridad a mano (mismo
 * criterio que mobile/src/lib/restaurantes.ts con /web).
 */

/**
 * El catálogo CERRADO de categorías gastronómicas (0202) — espejo
 * exacto de TIPOS_COCINA_ID en src/lib/food/tipos.ts (/web). Las dos
 * listas tienen que decir lo mismo que el CHECK de la 0202.
 */
export const TIPOS_COCINA_ID = [
  "tipica",
  "italiana",
  "asiatica",
  "mexicana",
  "mariscos",
  "carnes",
  "pizza",
  "cafe_postres",
  "saludable",
  "comida_rapida",
] as const;
export type TipoCocina = (typeof TIPOS_COCINA_ID)[number];

/** nombre + ícono de Ionicons para la fila de categorías del Inicio. */
export const TIPOS_COCINA: Record<TipoCocina, { nombre: string; icono: string }> = {
  tipica: { nombre: "Típica", icono: "restaurant-outline" },
  italiana: { nombre: "Italiana", icono: "pizza-outline" },
  asiatica: { nombre: "Asiática", icono: "fast-food-outline" },
  mexicana: { nombre: "Mexicana", icono: "flame-outline" },
  mariscos: { nombre: "Mariscos", icono: "fish-outline" },
  carnes: { nombre: "Carnes y asados", icono: "flame-outline" },
  pizza: { nombre: "Pizza", icono: "pizza-outline" },
  cafe_postres: { nombre: "Café y postres", icono: "cafe-outline" },
  saludable: { nombre: "Saludable", icono: "nutrition-outline" },
  comida_rapida: { nombre: "Comida rápida", icono: "fast-food-outline" },
};

export function esTipoCocina(valor: string | null | undefined): valor is TipoCocina {
  return !!valor && (TIPOS_COCINA_ID as readonly string[]).includes(valor);
}

/** Las 7 provincias de Costa Rica (0203) — espejo exacto de
 *  PROVINCIAS_ID en src/lib/food/tipos.ts (/web). */
export const PROVINCIAS_ID = [
  "san_jose",
  "alajuela",
  "cartago",
  "heredia",
  "guanacaste",
  "puntarenas",
  "limon",
] as const;
export type Provincia = (typeof PROVINCIAS_ID)[number];

export const PROVINCIAS: Record<Provincia, string> = {
  san_jose: "San José",
  alajuela: "Alajuela",
  cartago: "Cartago",
  heredia: "Heredia",
  guanacaste: "Guanacaste",
  puntarenas: "Puntarenas",
  limon: "Limón",
};

export function esProvincia(valor: string | null | undefined): valor is Provincia {
  return !!valor && (PROVINCIAS_ID as readonly string[]).includes(valor);
}

export type FoodBusiness = {
  id: string;
  owner_id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  foto_portada_url: string | null;
  telefono: string | null;
  activo: boolean;
  es_demo: boolean;
  created_at: string;
  /** 0202. null = el dueño todavía no eligió categoría. */
  tipo_cocina: TipoCocina | null;
  /** 0203. null = el dueño todavía no ubicó su negocio. */
  provincia: Provincia | null;
};

/** El perfil del CLIENTE de FOOD (0204) — dirección y género, aparte
 *  de `perfiles` (identidad de toda la plataforma) a propósito. */
export type FoodCustomerProfile = {
  id: string;
  direccion: string | null;
  genero: string | null;
  updated_at: string;
};

export type FoodLocation = {
  id: string;
  business_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
};

export type FoodMenuCategory = {
  id: string;
  business_id: string;
  nombre: string;
  orden: number;
};

export type FoodMenuItem = {
  id: string;
  business_id: string;
  category_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  foto_url: string | null;
  activo: boolean;
  orden: number;
};

export type FoodFranja = {
  id: string;
  business_id: string;
  location_id: string;
  fecha: string;
  hora: string;
  capacidad: number;
  reservado: number;
  descuento_porcentaje: number;
  activa: boolean;
};

export type FoodReservationEstado = "confirmada" | "check_in" | "no_show" | "cancelada";

export type FoodReservation = {
  id: string;
  franja_id: string;
  business_id: string;
  customer_id: string;
  party_size: number;
  descuento_porcentaje: number;
  codigo_confirmacion: string;
  estado: FoodReservationEstado;
  created_at: string;
};

export const CRC = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "dic",
];

/** "2026-08-20" → "20 ago" */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${d} ${MESES[m - 1]}`;
}

/** "20:00:00" → "8:00 p.m." */
export function horaCorta(hhmmss: string): string {
  const [hStr, m] = hhmmss.split(":");
  const h = Number(hStr);
  const periodo = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${periodo}`;
}

/** Para buscar sin pelear con tildes. */
export function normalizarBusquedaFood(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** "YYYY-MM-DD" de hoy en hora de Costa Rica. */
export function hoyISOCR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
