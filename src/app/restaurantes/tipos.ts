/**
 * La vertical de Restaurantes: sus categorías y la lectura de lo que
 * cada local ofrece (reserva de mesa, pickup, rango de precio). Puro y
 * sin Supabase, espejo del patrón de citas/tipos.ts.
 */

export const CATEGORIAS_RESTAURANTES = [
  "soda",
  "restaurante",
  "cafeteria",
  "marisqueria",
  "pizzeria",
  "bar",
  "panaderia",
  "heladeria",
] as const;

export type CategoriaRestaurante = (typeof CATEGORIAS_RESTAURANTES)[number];

export const CATEGORIA_RESTAURANTE_LABEL: Record<CategoriaRestaurante, string> = {
  soda: "Sodas y comida típica",
  restaurante: "Restaurantes",
  cafeteria: "Cafeterías",
  marisqueria: "Mariscos",
  pizzeria: "Pizzerías",
  bar: "Bares y cervecerías",
  panaderia: "Panaderías",
  heladeria: "Heladerías y postres",
};

export function normalizarCategoriaRestaurante(
  valor: string | null,
): CategoriaRestaurante {
  return (CATEGORIAS_RESTAURANTES as readonly string[]).includes(valor ?? "")
    ? (valor as CategoriaRestaurante)
    : "restaurante";
}

/** ₡ / ₡₡ / ₡₡₡ — lo que la gente espera gastar por persona. */
export const RANGO_PRECIO_LABEL: Record<number, string> = {
  1: "₡",
  2: "₡₡",
  3: "₡₡₡",
};

/**
 * Lo que el local ofrece, leído de `ranchos.detalles` (jsonb). Todo es
 * opcional: un restaurante puede estar solo de vitrina, sin reservas
 * ni pedidos, y la ficha se adapta.
 */
export type OpcionesRestaurante = {
  aceptaReservaMesa: boolean;
  aceptaPickup: boolean;
  rangoPrecio: number | null;
};

export function opcionesDeDetalles(detalles: unknown): OpcionesRestaurante {
  const d =
    detalles && typeof detalles === "object"
      ? (detalles as Record<string, unknown>)
      : {};
  const rango = Number(d.rango_precio);
  return {
    aceptaReservaMesa: d.acepta_reserva_mesa === true,
    aceptaPickup: d.acepta_pickup === true,
    rangoPrecio: rango >= 1 && rango <= 3 ? rango : null,
  };
}

/** El horario del local vive junto al de citas, con su propia llave. */
export function horarioDeDetalles(detalles: unknown): Record<string, unknown> | null {
  if (!detalles || typeof detalles !== "object") return null;
  const h = (detalles as Record<string, unknown>).horario_restaurante;
  return h && typeof h === "object" ? (h as Record<string, unknown>) : null;
}
