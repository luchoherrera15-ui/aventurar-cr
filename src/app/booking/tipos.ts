/**
 * La vertical de Hospedajes: sus categorías, espejo del patrón de
 * citas/tipos.ts. Puro y sin Supabase.
 */

export const CATEGORIAS_HOSPEDAJES = [
  "casa",
  "villa",
  "hotel",
  "cabana",
  "apartamento",
  "experiencia",
] as const;

export type CategoriaHospedaje = (typeof CATEGORIAS_HOSPEDAJES)[number];

export const CATEGORIA_HOSPEDAJE_LABEL: Record<CategoriaHospedaje, string> = {
  casa: "Casa vacacional",
  villa: "Villa",
  hotel: "Hotel o bed & breakfast",
  cabana: "Cabaña",
  apartamento: "Apartamento",
  experiencia: "Experiencia",
};

export function normalizarCategoriaHospedaje(
  valor: string | null,
): CategoriaHospedaje | null {
  return (CATEGORIAS_HOSPEDAJES as readonly string[]).includes(valor ?? "")
    ? (valor as CategoriaHospedaje)
    : null;
}
