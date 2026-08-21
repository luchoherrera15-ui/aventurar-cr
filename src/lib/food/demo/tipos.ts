/**
 * LOS TIPOS DE LA DEMO COMERCIAL DE FOOD.BOOKEA (/food/demo, que el
 * dominio sirve como food.bookea.lat/demo).
 *
 * La demo NO toca la base de datos: los 45 restaurantes viven como
 * datos estáticos en src/lib/food/demo/datos/ y las reservas/favoritos
 * de una sesión de venta viven en el localStorage del navegador (ver
 * ./estado.ts). Ese es el aislamiento: producción no puede
 * contaminarse porque la demo ni siquiera tiene un cliente de Supabase.
 * También hace el "seed" idempotente por definición — los datos son
 * código versionado, no filas.
 *
 * Por lo mismo, acá SÍ hay rating, reseñas, tipo de cocina y rango de
 * precios: son datos abiertamente ficticios de una vitrina comercial,
 * no datos inventados sobre negocios reales (la regla de "no inventar"
 * del directorio real — src/lib/food/tarjetas.ts — sigue intacta).
 */

export const CATEGORIAS_DEMO = [
  "Italiana",
  "Sushi",
  "Hamburguesas",
  "Carnes",
  "Mexicana",
  "Asiática",
  "Mediterránea",
  "Café",
  "Internacional",
  "Pizza",
] as const;
export type CategoriaDemo = (typeof CATEGORIAS_DEMO)[number];

export const ZONAS_DEMO = [
  "San José centro",
  "Escazú",
  "Santa Ana",
  "Rohrmoser",
  "Sabana",
  "Curridabat",
  "San Pedro",
  "Heredia",
  "Belén",
  "Alajuela",
  "Lindora",
  "Cartago",
] as const;
export type ZonaDemo = (typeof ZONAS_DEMO)[number];

/** Una franja del día con su descuento — "17:30" en 24h + %. */
export type PromocionDemo = { hora: string; descuento: number };

/** Un plato del menú demo. La foto viene del pool de su cocina
 *  (public/food-demo/m/) — compartido entre restaurantes de la misma
 *  categoría para no bajar 300 fotos. */
export type PlatoDemo = {
  nombre: string;
  descripcion?: string;
  precio: number;
  foto: string;
};

export type RestauranteDemo = {
  /** Único en TODO el set de 45 — es la URL de la ficha. */
  slug: string;
  nombre: string;
  /** 1–2 frases, tono comercial, en español de Costa Rica. */
  descripcion: string;
  categoria: CategoriaDemo;
  /** Lo que se pinta como tipo de cocina, ej. "Parrilla contemporánea". */
  cocina: string;
  zona: ZonaDemo;
  /** Dirección claramente ficticia, ej. "Plaza Aurora, local 8". */
  direccion: string;
  /** Teléfono ficticio con formato local: "+506 2555-01XX". */
  telefono: string;
  /** 1 = ₡ … 4 = ₡₡₡₡. */
  precioNivel: 1 | 2 | 3 | 4;
  /** Precio promedio por persona en colones — la base del "precio
   *  estimado" de una reserva. Debe ser coherente con el menú: ≈ el
   *  promedio de los precios de `menu` (la UI lo presenta como
   *  "consumo promedio por persona según el menú"). */
  precioPromedio: number;
  /** El menú del restaurante: 5–7 platos con foto chica y precio. */
  menu: PlatoDemo[];
  /** 4.4–4.9, variado entre restaurantes. */
  rating: number;
  /** Cantidad de reseñas, variada (30–600). */
  resenas: number;
  /** "/food-demo/r/<slug>-1.jpg" — foto principal, local al repo. */
  fotoPrincipal: string;
  /** 2–3 fotos más para la galería de la ficha. */
  galeria: string[];
  /** Horario descriptivo, ej. "Lun–Dom · 12:00 – 22:00". */
  horario: string;
  /** Las franjas del día con su % — el corazón del producto. 4 a 8
   *  slots, con curvas DISTINTAS por restaurante. */
  promociones: PromocionDemo[];
  /** true solo en un puñado — pinta el badge "Nuevo". */
  esNuevo?: boolean;
};

/** ₡ … ₡₡₡₡ */
export function precioSimbolo(nivel: 1 | 2 | 3 | 4): string {
  return "₡".repeat(nivel);
}

export type MomentoDia = "almuerzo" | "tarde" | "cena";

/** A qué momento del día pertenece una franja "HH:MM" — para el filtro
 *  de horario (Almuerzo / Tarde / Cena). */
export function momentoDeHora(hora: string): MomentoDia {
  if (hora < "15:00") return "almuerzo";
  if (hora < "18:00") return "tarde";
  return "cena";
}

/** El mejor % del restaurante — para el badge y el filtro de descuento. */
export function mejorDescuento(r: RestauranteDemo): number {
  return r.promociones.reduce((max, p) => Math.max(max, p.descuento), 0);
}

/** "17:30" → "5:30 p.m." (mismo formato que el resto de FOOD). */
export function horaBonita(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const sufijo = h >= 12 ? "p.m." : "a.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

export const CRC_DEMO = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});
