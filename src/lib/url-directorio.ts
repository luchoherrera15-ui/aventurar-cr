/**
 * CÓMO SE ARMA UNA URL DE DIRECTORIO. Un solo lugar.
 *
 * Los directorios (/citas, /restaurantes, /eventos) llevan sus filtros
 * en la query: `?categoria=&q=&pais=&provincia=`. Hasta ahora cada
 * pantalla se la armaba a mano —con `encodeURIComponent` en unas y
 * `URLSearchParams` en otras— y cada enlace nuevo era una oportunidad
 * de olvidarse de arrastrar un filtro. El síntoma clásico: el visitante
 * llega filtrado por zona, toca "Ver todos" de una categoría y el
 * filtro desaparece sin decir nada.
 *
 * Con el país eso deja de ser una molestia y pasa a ser un problema:
 * perder `?pais=` no afloja un filtro, MUEVE AL VISITANTE DE PAÍS.
 *
 * ── LA REGLA DE COSTA RICA ─────────────────────────────────────────
 * `?pais=cr` NUNCA se emite. Costa Rica es el caso por defecto de toda
 * la plataforma: un directorio sin `?pais=` ya se comporta como Costa
 * Rica, así que agregarlo no cambiaría un solo resultado y sí cambiaría
 * la forma de TODAS las URLs que la gente compartió y que Google tiene
 * indexadas. El parámetro aparece solo cuando dice algo.
 *
 * Módulo neutro a propósito —sin `"use client"`, sin `next/headers`,
 * sin JSX—: lo importan tanto páginas de servidor como componentes de
 * cliente. Ver la nota de la frontera "use client" ↔ servidor.
 */

import { PAIS_POR_DEFECTO, codigoPaisDe } from "@/lib/paises";

/** Los filtros que puede llevar un directorio en la query. */
export type FiltrosDirectorio = {
  categoria?: string | null;
  /** El texto de la lupa. */
  q?: string | null;
  /** ISO alfa-2. Ausente, desconocido o "cr" = no viaja. */
  pais?: string | null;
  /** La región de primer nivel, con su nombre exacto. */
  provincia?: string | null;
};

/**
 * La URL de un directorio con los filtros que se le pasen. Lo vacío no
 * viaja: un `?q=&provincia=` ensucia la barra de direcciones, arruina
 * el historial y hace que dos URLs distintas muestren lo mismo.
 *
 * El orden de los parámetros es fijo (categoria, q, pais, provincia)
 * para que la misma búsqueda produzca siempre la misma cadena — si no,
 * el caché y el historial la ven como dos páginas distintas.
 */
export function urlDirectorio(ruta: string, filtros: FiltrosDirectorio): string {
  const p = new URLSearchParams();
  if (filtros.categoria) p.set("categoria", filtros.categoria);
  if (filtros.q) p.set("q", filtros.q);

  // Un país desconocido cae en Costa Rica, y Costa Rica no se emite.
  const pais = codigoPaisDe(filtros.pais);
  if (pais !== PAIS_POR_DEFECTO) p.set("pais", pais);

  if (filtros.provincia) p.set("provincia", filtros.provincia);

  const query = p.toString();
  return query ? `${ruta}?${query}` : ruta;
}

/**
 * El enlace "Ver todos" de una categoría, conservando el país y la
 * zona en los que el visitante ya estaba parado.
 */
export function urlCategoria(
  ruta: string,
  categoria: string,
  pais?: string | null,
  provincia?: string | null,
): string {
  return urlDirectorio(ruta, { categoria, pais, provincia });
}
