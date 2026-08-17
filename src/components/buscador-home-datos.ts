/**
 * Los datos del buscador de la portada, y —sobre todo— la función que
 * arma la URL de destino.
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE APARTE ─────────────────────────────
 * `buscador-home.tsx` es `"use client"`. Exportar helpers desde un
 * módulo cliente ya rompió el build DOS VECES en este repo (Finanzas e
 * IA): cualquier archivo de servidor que importe uno de esos helpers
 * arrastra la frontera entera y el error sale como un 500 en runtime,
 * no como un fallo de compilación. Este módulo es NEUTRO —sin
 * `"use client"`, sin `next/headers`, sin JSX— así que lo puede
 * importar tanto el componente como una página de servidor (por
 * ejemplo, para pre-armar un enlace o para probar `urlBusqueda` en un
 * test de nodo).
 *
 * ── EL BUSCADOR COMPONE, NO REIMPLEMENTA ───────────────────────────
 * Acá no hay ni un filtro. Lo único que se hace es armar una URL que
 * los directorios YA saben leer:
 *
 *   /citas?q=…&categoria=…&provincia=…
 *   /eventos?q=…&categoria=…&subcategoria=…&provincia=…
 *
 * Quien interpreta el texto ("3 de agosto", "este viernes") es
 * `interpretarBusqueda` DENTRO del directorio de destino, que ya lo
 * hace. Si acá se agregara un parámetro que nadie lee, el buscador
 * mentiría: se vería filtrar sin filtrar nada.
 *
 * ── LO QUE NO ESTÁ, Y POR QUÉ ──────────────────────────────────────
 * No hay campo de FECHA. En Citas no existe ninguna consulta que
 * responda "quién tiene campo el martes" para todo el directorio (la
 * disponibilidad se calcula negocio por negocio), y en Eventos solo
 * aplicaría a la categoría "lugares". Un control que no filtra nada es
 * un control que miente, así que el campo directamente no está.
 */

import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  PROVINCIAS,
  SUBCATEGORIAS_TODAS,
} from "@/app/mi-negocio/types";
import { CATEGORIAS_CITAS, CATEGORIA_CITA_LABEL } from "@/app/citas/tipos";

/**
 * Las dos verticales que el buscador ofrece. Restaurantes y Hospedajes
 * quedan fuera a propósito: el home los enlaza aparte (§1.5 del plan),
 * y tres pestañas no caben en 390 px sin volverse ilegibles.
 */
export const PESTANAS = ["citas", "eventos"] as const;

export type PestanaBuscador = (typeof PESTANAS)[number];

export function esPestana(valor: string | null | undefined): valor is PestanaBuscador {
  return (PESTANAS as readonly string[]).includes(valor ?? "");
}

/** Un rubro o una sugerencia: lo mínimo para pintar un chip. */
export type OpcionBuscador = { id: string; label: string };

/**
 * Los parámetros que el buscador sabe poner en la URL. Son exactamente
 * los que leen los directorios, ni uno más:
 *  · `q`           — /citas (page.tsx) y /eventos (directorio.tsx)
 *  · `provincia`   — las dos
 *  · `categoria`   — las dos, validado contra la taxonomía de cada una
 *  · `subcategoria`— SOLO /eventos (es el segundo nivel de esa vertical)
 */
export type ParametrosBusqueda = {
  q?: string;
  provincia?: string;
  categoria?: string;
  subcategoria?: string;
};

export type TextosPestana = {
  /** Lo que dice la pestaña. */
  label: string;
  /** El directorio al que va el `action` del form. */
  ruta: string;
  /** La etiqueta VISIBLE del campo de texto (nunca solo el placeholder). */
  etiquetaQue: string;
  placeholderQue: string;
  /** Encabezado de la fila de rubros dentro del panel. */
  tituloRubros: string;
  /** El texto del enlace de escape al directorio completo. */
  verTodo: string;
};

export const TEXTOS: Record<PestanaBuscador, TextosPestana> = {
  citas: {
    label: "Citas y servicios",
    ruta: "/citas",
    etiquetaQue: "¿Qué necesitás?",
    placeholderQue: "Uñas, masajes, barbería…",
    tituloRubros: "Rubros de citas y servicios",
    verTodo: "Ver todos los servicios",
  },
  eventos: {
    label: "Eventos",
    ruta: "/eventos",
    etiquetaQue: "¿Qué buscás para tu evento?",
    placeholderQue: "Rancho, catering, DJ…",
    tituloRubros: "Rubros para eventos",
    verTodo: "Ver todos los proveedores",
  },
};

/**
 * Los rubros de cada vertical, en su orden oficial y con sus ids
 * reales. Salen de la taxonomía compartida —nunca de una lista escrita
 * a mano acá— porque `CLAUDE.md` prohíbe inventar categorías y porque
 * un id inventado produciría un enlace que el directorio ignora.
 */
export const RUBROS: Record<PestanaBuscador, OpcionBuscador[]> = {
  citas: CATEGORIAS_CITAS.map((c) => ({ id: c, label: CATEGORIA_CITA_LABEL[c] })),
  eventos: CATEGORIAS.map((c) => ({ id: c, label: CATEGORIA_LABEL[c] })),
};

/** Una búsqueda sugerida: el texto del chip y a dónde lleva. */
export type Sugerencia = { label: string; parametros: ParametrosBusqueda };

/**
 * La fila "Popular:".
 *
 * Son ENLACES REALES a filtros que existen, no adornos. En Citas los
 * cuatro rubros elegidos son los que hoy tienen negocios publicados. En
 * Eventos van las cuatro subcategorías que el dueño pedía en la maqueta
 * ("Salones", "Catering", "DJ y música", "Foto y video") con su id
 * verdadero de la taxonomía: son el segundo nivel de la vertical, no
 * categorías, y así el chip lleva al filtro correcto en vez de a uno
 * inventado. Si alguna todavía no tiene proveedores, el directorio
 * muestra su vacío honesto con la salida puesta — que es mejor que
 * esconder el rubro.
 */
export const SUGERENCIAS: Record<PestanaBuscador, Sugerencia[]> = {
  citas: [
    { label: "Uñas", parametros: { categoria: "unas" } },
    { label: "Barbería", parametros: { categoria: "barberia" } },
    { label: "Spa y masajes", parametros: { categoria: "spa" } },
    { label: "Belleza", parametros: { categoria: "belleza" } },
  ],
  eventos: [
    { label: "Ranchos para fiestas", parametros: { subcategoria: "rancho_fiestas" } },
    { label: "Salas de eventos", parametros: { subcategoria: "sala_eventos" } },
    { label: "Catering", parametros: { subcategoria: "catering" } },
    { label: "Fotógrafos", parametros: { subcategoria: "fotografos" } },
  ],
};

/**
 * Las 7 provincias, tal cual las guarda la base.
 *
 * Se re-exportan desde acá —y no se copian— porque el directorio
 * compara el valor EXACTO contra esta misma lista (con tilde y
 * mayúscula) y descarta en silencio cualquier otra cosa. Una copia con
 * "San Jose" sin tilde produciría un filtro que no filtra.
 */
export const PROVINCIAS_BUSCADOR = PROVINCIAS;

export function esProvinciaValida(valor: string): boolean {
  return (PROVINCIAS as readonly string[]).includes(valor);
}

/** El directorio de destino de cada pestaña. */
export function rutaDirectorio(pestana: PestanaBuscador): string {
  return TEXTOS[pestana].ruta;
}

/**
 * La URL final del buscador.
 *
 * Tres reglas, y las tres existen para que el buscador no prometa un
 * filtro que el directorio no va a aplicar:
 *
 * 1. Lo vacío no viaja. Un `?q=&provincia=` es ruido en la barra de
 *    direcciones, ensucia el historial y arruina el compartir.
 * 2. Lo inválido se descarta acá, no allá. `provincia=Miami` o
 *    `categoria=peluqueria` los ignora el directorio en silencio y la
 *    persona ve la lista completa sin entender por qué; mejor no
 *    emitirlos nunca.
 * 3. `subcategoria` solo existe en Eventos: es el único vertical con
 *    taxonomía de dos niveles (`usaSubcategoria` en
 *    categorias-vertical.ts). En Citas se descarta.
 *
 * `URLSearchParams` codifica el espacio como `+`. Está verificado
 * contra el directorio real —`/citas?provincia=San+Jos%C3%A9` filtra
 * igual que `%20`— y es lo mismo que ya emite
 * `barra-filtros-directorio.tsx`, así que las dos barras del sitio
 * producen URLs con la misma forma.
 */
export function urlBusqueda(
  pestana: PestanaBuscador,
  parametros: ParametrosBusqueda,
): string {
  const ruta = rutaDirectorio(pestana);
  const p = new URLSearchParams();

  const q = (parametros.q ?? "").trim();
  if (q) p.set("q", q);

  const categoria = parametros.categoria ?? "";
  if (RUBROS[pestana].some((r) => r.id === categoria)) p.set("categoria", categoria);

  const subcategoria = parametros.subcategoria ?? "";
  if (
    pestana === "eventos" &&
    (SUBCATEGORIAS_TODAS as readonly string[]).includes(subcategoria)
  ) {
    p.set("subcategoria", subcategoria);
  }

  const provincia = parametros.provincia ?? "";
  if (esProvinciaValida(provincia)) p.set("provincia", provincia);

  const query = p.toString();
  return query ? `${ruta}?${query}` : ruta;
}
