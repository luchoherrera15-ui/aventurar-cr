/**
 * La vertical de Hospedajes en el app: espejo de src/app/booking/tipos.ts
 * de /web (misma base de Supabase). Si cambiás algo acá, cambialo
 * también allá.
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
