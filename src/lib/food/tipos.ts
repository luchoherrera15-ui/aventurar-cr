/** Los tipos de fila de las tablas food_* (0190), leídos tal cual salen de Supabase. */

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
  notas: string | null;
  created_at: string;
  checked_in_at: string | null;
  cancelled_at: string | null;
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
