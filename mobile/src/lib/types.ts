/**
 * Mismo esquema que /web (src/app/mi-rancho/types.tsx y
 * src/app/eventos-salon/types.ts) — se repiten acá los tipos y
 * constantes que la app necesita en vez de importarlos cruzando de
 * /web a /mobile porque son dos proyectos npm independientes (Next.js
 * vs Expo, cada uno con su propio bundler y árbol de node_modules).
 */

export type Provincia =
  | "San José"
  | "Alajuela"
  | "Cartago"
  | "Heredia"
  | "Guanacaste"
  | "Puntarenas"
  | "Limón";

export type EstadoRancho = "pendiente" | "aprobado" | "rechazado";

export const CATEGORIAS = [
  "lugares",
  "alimentacion",
  "animacion",
  "organizacion",
  "decoracion",
  "otros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  lugares: "Lugares",
  alimentacion: "Alimentación",
  animacion: "Animación",
  organizacion: "Organización",
  decoracion: "Decoración",
  otros: "Otros servicios",
};

export type HorarioBloqueConfig = {
  id: string;
  etiqueta: string;
  desde: string;
  hasta: string;
};

/** Pasa "19:30" a "7:30 p.m." para mostrarlo en la app. */
export function formatearHora(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const sufijo = h < 12 ? "a.m." : "p.m.";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

export function etiquetaHorario(bloque: HorarioBloqueConfig) {
  const rango = `${formatearHora(bloque.desde)} – ${formatearHora(bloque.hasta)}`;
  return bloque.etiqueta ? `${bloque.etiqueta} (${rango})` : rango;
}

export type Rancho = {
  id: string;
  nombre: string;
  descripcion: string | null;
  descripcion_larga: string | null;
  categoria: Categoria;
  subcategoria: string | null;
  terminos: string[];
  monto_minimo: number | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  sitio_web: string | null;
  latitud: number | null;
  longitud: number | null;
  amenidades: string[];
  detalles: Record<string, unknown>;
  provincia: Provincia | null;
  canton: string | null;
  direccion_exacta: string | null;
  capacidad_min: number | null;
  capacidad_max: number | null;
  precio_desde: number | null;
  contacto_whatsapp: string | null;
  foto_url: string | null;
  foto_presentacion: string | null;
  deposito_reserva: number;
  sinpe_numero: string | null;
  sinpe_titular: string | null;
  cuenta_banco: string | null;
  cuenta_numero: string | null;
  cuenta_titular: string | null;
  cuenta_tipo: string | null;
  horarios_bloques: HorarioBloqueConfig[];
  tarifa_diciembre_por_persona: number | null;
  fotos: string[];
  estado: EstadoRancho;
  created_at: string;
  slug: string | null;
};

export type PrecioTier = {
  min_invitados: number;
  max_invitados: number;
  precio: number;
};

export type ServicioAdicional = {
  id: string;
  nombre: string;
  precio: number;
  requisito_max_invitados: number | null;
};

export type DiaDisponibilidad = {
  confirmada: boolean;
  pendientes: number;
  temporales: number;
};

export type PromocionDia = {
  dias_semana: number[];
  porcentaje_descuento: number;
  etiqueta: string;
  activo: boolean;
};

export function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}
