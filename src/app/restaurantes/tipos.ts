/**
 * La vertical de Restaurantes: sus categorías y la lectura de lo que
 * cada local ofrece (reserva de mesa, pickup, rango de precio). Puro y
 * sin Supabase, espejo del patrón de citas/tipos.ts.
 *
 * Las categorías son por TIPO DE COMIDA, no por tipo de local: la
 * gente busca "pastas" o "coreana", no "restaurante de mesa". El
 * orden es el de las filas del directorio — arriba lo que más se
 * busca en Costa Rica.
 */

import type { HorarioSemana } from "../citas/tipos";

export const CATEGORIAS_RESTAURANTES = [
  "tipica",
  "carnes",
  "mariscos",
  "pastas",
  "pizza",
  "hamburguesas",
  "china",
  "japonesa",
  "coreana",
  "mexicana",
  "peruana",
  "mediterranea",
  "vegetariana",
  "cafeteria",
  "postres",
  "bar",
  "fusion",
  "otros",
] as const;

export type CategoriaRestaurante = (typeof CATEGORIAS_RESTAURANTES)[number];

export const CATEGORIA_RESTAURANTE_LABEL: Record<CategoriaRestaurante, string> = {
  tipica: "Comida típica y sodas",
  carnes: "Carnes y parrilla",
  mariscos: "Mariscos",
  pastas: "Pastas e italiana",
  pizza: "Pizzas",
  hamburguesas: "Hamburguesas",
  china: "Comida china",
  japonesa: "Japonesa y sushi",
  coreana: "Comida coreana",
  mexicana: "Comida mexicana",
  peruana: "Comida peruana",
  mediterranea: "Mediterránea y árabe",
  vegetariana: "Vegetariana y saludable",
  cafeteria: "Cafeterías y brunch",
  postres: "Postres y heladerías",
  bar: "Bares y cervecerías",
  fusion: "Cocina de autor",
  otros: "Otros sabores",
};

export function normalizarCategoriaRestaurante(
  valor: string | null,
): CategoriaRestaurante {
  return (CATEGORIAS_RESTAURANTES as readonly string[]).includes(valor ?? "")
    ? (valor as CategoriaRestaurante)
    : "otros";
}

/** ₡ / ₡₡ / ₡₡₡ — lo que la gente espera gastar por persona. */
export const RANGO_PRECIO_LABEL: Record<number, string> = {
  1: "₡",
  2: "₡₡",
  3: "₡₡₡",
};

/**
 * CÓMO SE VE LA FICHA DEL LOCAL.
 *
 * Una soda de barrio y una cafetería de especialidad no se venden
 * igual: la primera necesita que su menú se lea rápido y en fila; la
 * segunda vive de que la carta se vea cara. En vez de resolverlo con
 * un `if (slug === "…")` en la página —que solo sirve para un negocio
 * y hay que tocar código para el siguiente—, el local DECLARA su tema
 * en `ranchos.detalles.tema_ficha` y la ficha se arma según eso.
 *
 *   estandar → filas compactas con foto, dos columnas. El de siempre.
 *   carta    → carta editorial: serif, una columna, mucho aire, foto
 *              de portada a sangre. Para cafeterías y cocina de autor.
 *
 * Cualquier local puede pedir "carta" desde su jsonb sin desplegar
 * nada. Lo que NO se hace es dejarlo abierto a texto libre: es una
 * lista cerrada, y lo que no esté en ella cae en `estandar`.
 */
export const TEMAS_FICHA = ["estandar", "carta"] as const;

export type TemaFicha = (typeof TEMAS_FICHA)[number];

/**
 * Lo que el local ofrece, leído de `ranchos.detalles` (jsonb). Todo es
 * opcional: un restaurante puede estar solo de vitrina, sin reservas
 * ni pedidos, y la ficha se adapta.
 */
export type OpcionesRestaurante = {
  aceptaReservaMesa: boolean;
  aceptaPickup: boolean;
  rangoPrecio: number | null;
  tema: TemaFicha;
};

export function opcionesDeDetalles(detalles: unknown): OpcionesRestaurante {
  const d =
    detalles && typeof detalles === "object"
      ? (detalles as Record<string, unknown>)
      : {};
  const rango = Number(d.rango_precio);
  const tema = d.tema_ficha;
  return {
    aceptaReservaMesa: d.acepta_reserva_mesa === true,
    aceptaPickup: d.acepta_pickup === true,
    rangoPrecio: rango >= 1 && rango <= 3 ? rango : null,
    tema: (TEMAS_FICHA as readonly unknown[]).includes(tema)
      ? (tema as TemaFicha)
      : "estandar",
  };
}

/**
 * El horario del local vive junto al de citas, con su propia llave y
 * el MISMO formato (así lo dejó dicho la 0076): claves "0".."6" con
 * `{ abre, cierra }`, o null si ese día cierra.
 */
export function horarioDeDetalles(detalles: unknown): HorarioSemana | null {
  if (!detalles || typeof detalles !== "object") return null;
  const h = (detalles as Record<string, unknown>).horario_restaurante;
  return h && typeof h === "object" ? (h as HorarioSemana) : null;
}

/**
 * Una línea del menú, tal como la ficha la lee de `rancho_items`. Vive
 * acá y no en cada página porque la leen la ficha y sus dos temas.
 */
export type ItemMenu = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  unidad: string | null;
  grupo: string | null;
  foto_url: string | null;
};

/**
 * El menú agrupado por sección, en el orden en que vienen los ítems.
 * Lo que no declara grupo cae en uno general al final.
 */
export function agruparMenu(items: ItemMenu[]): [string, ItemMenu[]][] {
  const secciones = new Map<string, ItemMenu[]>();
  for (const it of items) {
    const g = (it.grupo ?? "").trim() || "Menú";
    secciones.set(g, [...(secciones.get(g) ?? []), it]);
  }
  return [...secciones.entries()];
}

/**
 * El `id` de anclaje de una sección del menú, para que la barra de
 * secciones pueda saltar a ella sin JavaScript. Se le quitan tildes y
 * signos porque un `href="#Café y té"` sobrevive al navegador pero no
 * a copiar y pegar la URL.
 */
export function anclaDeSeccion(nombre: string): string {
  const limpio = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Siempre con prefijo y nunca vacío: un grupo llamado "☕" daría "".
  return `seccion-${limpio || "menu"}`;
}
