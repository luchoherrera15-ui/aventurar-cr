/** Los tipos de fila de las tablas food_* (0190), leídos tal cual salen de Supabase. */

/**
 * El catálogo CERRADO de categorías gastronómicas (0202) — reemplaza
 * al "tipo de cocina inventado" que este archivo se negaba a mostrar.
 * Es finito y no texto libre para que el filtro de categorías del
 * cliente (un ícono fijo por categoría) tenga un conjunto conocido que
 * pintar, mismo criterio que `programa_lealtad.modo`. Espejo exacto en
 * mobile-food/src/lib/food-tipos.ts — las dos listas tienen que decir
 * lo mismo que el CHECK de la 0202.
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

export const TIPOS_COCINA: Record<TipoCocina, string> = {
  tipica: "Comida típica",
  italiana: "Italiana",
  asiatica: "Asiática",
  mexicana: "Mexicana",
  mariscos: "Mariscos",
  carnes: "Carnes y asados",
  pizza: "Pizza",
  cafe_postres: "Café y postres",
  saludable: "Saludable",
  comida_rapida: "Comida rápida",
};

export function esTipoCocina(
  valor: string | null | undefined,
): valor is TipoCocina {
  return !!valor && (TIPOS_COCINA_ID as readonly string[]).includes(valor);
}

/**
 * Las 7 provincias de Costa Rica (0203) — catálogo cerrado, mismo
 * criterio que TIPOS_COCINA_ID. El día que exista un negocio fuera de
 * Costa Rica, el selector de ubicación crece con una columna `pais`;
 * hoy el 100% de los negocios reales son de Costa Rica, así que esa
 * columna no agregaría ningún dato que no se sepa ya.
 */
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

export function esProvincia(
  valor: string | null | undefined,
): valor is Provincia {
  return !!valor && (PROVINCIAS_ID as readonly string[]).includes(valor);
}

export type FoodBusiness = {
  id: string;
  owner_id: string;
  bookea_business_id: string | null;
  nombre: string;
  slug: string;
  descripcion: string | null;
  foto_portada_url: string | null;
  telefono: string | null;
  zona_horaria: string;
  activo: boolean;
  /** true = negocio de muestra sembrado para /food/demo (0193). Nunca
   *  sale en el directorio real ni acepta reservas reales. */
  es_demo: boolean;
  /** 0202. null = el dueño todavía no eligió categoría — no sale en
   *  ningún filtro de categoría hasta que la elija. */
  tipo_cocina: TipoCocina | null;
  /** 0203. null = el dueño todavía no ubicó su negocio — no sale en
   *  el selector de ubicación hasta que lo haga. */
  provincia: Provincia | null;
  /** 0207. false = el dueño apagó "To Go" aunque tenga menú cargado. */
  acepta_para_llevar: boolean;
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

export type FoodReservationEstado =
  "confirmada" | "check_in" | "no_show" | "cancelada";

export type FoodReservation = {
  id: string;
  franja_id: string;
  business_id: string;
  customer_id: string;
  party_size: number;
  descuento_porcentaje: number;
  codigo_confirmacion: string;
  estado: FoodReservationEstado;
  notas: string | null;
  created_at: string;
  checked_in_at: string | null;
  cancelled_at: string | null;
};

/** "To Go" (0207) — se paga al retirar, sin franja ni cupo. */
export type FoodPedidoEstado = "pendiente" | "confirmado" | "listo" | "entregado" | "cancelado";

export type FoodPedido = {
  id: string;
  business_id: string;
  customer_id: string;
  codigo_confirmacion: string;
  estado: FoodPedidoEstado;
  hora_retiro: string | null;
  notas: string | null;
  total: number;
  created_at: string;
  confirmado_at: string | null;
  listo_at: string | null;
  entregado_at: string | null;
  cancelado_at: string | null;
};

export type FoodPedidoItem = {
  id: string;
  pedido_id: string;
  menu_item_id: string | null;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};

export const CRC = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "set",
  "oct",
  "nov",
  "dic",
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
