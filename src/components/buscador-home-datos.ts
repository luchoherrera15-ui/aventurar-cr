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
 * el destino YA sabe leer. Y el destino cambió (ago 2026): los
 * directorios /citas y /eventos se borraron —sus redirects traen todo
 * a la portada—, así que la URL que se arma es
 *
 *   /?q=…&lugar=…
 *
 * y quien filtra es la portada (`filtrarPorBusqueda` en
 * carriles-home.ts). Si acá se agregara un parámetro que nadie lee, el
 * buscador mentiría: se vería filtrar sin filtrar nada.
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
  SUBCATEGORIAS_TODAS,
} from "@/app/mi-negocio/types";
import { CATEGORIAS_CITAS, CATEGORIA_CITA_LABEL } from "@/app/citas/tipos";
import {
  PAISES,
  PAIS_POR_DEFECTO,
  codigoPaisDe,
  esRegionDe,
  type CodigoPais,
} from "@/lib/paises";

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
 *  · `pais`        — /citas, /restaurantes (page.tsx) y /eventos
 *                    (directorio.tsx). Se agregó en la misma tanda que
 *                    este campo: antes de eso NO se emitía, justamente
 *                    porque no lo leía nadie.
 */
export type ParametrosBusqueda = {
  q?: string;
  /**
   * El país, en ISO alfa-2 minúscula. Ausente = Costa Rica, que es lo
   * que fue siempre y lo que sigue siendo el caso por defecto.
   */
  pais?: string;
  /**
   * La región de primer nivel DENTRO de ese país: una provincia en
   * Costa Rica o Panamá, un estado en México, un departamento en
   * Colombia. El parámetro se sigue llamando `provincia` porque es el
   * que los directorios ya leen y el que está en los enlaces que la
   * gente compartió — renombrarlo no arregla nada y rompe URLs vivas.
   */
  provincia?: string;
  /**
   * El «dónde» escrito a mano libre (pedido del dueño, 27 ago 2026:
   * «que sea una barra de búsqueda, para poder ser universal»). No se
   * valida contra ninguna lista de regiones — validar era el `<select>`
   * del que este campo acaba de salirse. `provincia` (arriba) queda
   * para los enlaces viejos que ya andan compartidos.
   */
  lugar?: string;
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
 * LOS PAÍSES QUE OFRECE EL BUSCADOR.
 *
 * Es el catálogo entero, sin filtrar: la ubicación vive DENTRO del
 * buscador —como en Fresha— y no en un menú de banderitas del header.
 * Un selector de país en el header es una preferencia global escondida
 * en una esquina; acá es parte de la pregunta "¿qué buscás y dónde?",
 * que es lo que la persona vino a hacer.
 *
 * Se re-exporta —y no se copia— por la misma razón que antes se
 * re-exportaban las 7 provincias: el `<select>` tiene que ofrecer
 * EXACTAMENTE los códigos que `urlBusqueda` valida y que el directorio
 * compara. Una lista propia acá sería una segunda verdad.
 */
export const PAISES_BUSCADOR = PAISES;

/**
 * ¿Esta región existe DENTRO de ese país?
 *
 * Antes esto era `esProvinciaValida(valor)` y solo conocía las 7 de
 * Costa Rica. Ahora la pregunta necesita las dos mitades: "Chiriquí" es
 * una región válida en Panamá y basura en México, y emitir
 * `?pais=mx&provincia=Chiriquí` produciría un directorio vacío que
 * parece un error del sitio.
 *
 * La comparación es EXACTA (tildes incluidas) porque así se guarda en
 * la columna `provincia` y así la compara el directorio.
 */
export function esRegionValida(pais: string, valor: string): boolean {
  return esRegionDe(pais, valor);
}

/**
 * El destino del buscador. Era `TEXTOS[pestana].ruta` (/citas o
 * /eventos), pero esos DIRECTORIOS se borraron (ago 2026): sus
 * redirects de next.config traen todo a la portada con el query
 * intacto, y hoy es la portada quien filtra (`?q=` y `?lugar=`).
 * Apuntar directo ahorra el 308 y conserva el `#catalogo`, que un
 * redirect perdería. La pestaña se queda en la firma: sigue decidiendo
 * los textos del buscador, y si los directorios vuelven, su ruta
 * vuelve acá.
 */
export function rutaDirectorio(_pestana: PestanaBuscador): string {
  return "/";
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
 * ── EL PAÍS: POR QUÉ COSTA RICA NO VIAJA ───────────────────────────
 * `?pais=` se emite SOLO cuando NO es Costa Rica. Es la regla 1 otra
 * vez, y acá tiene dientes: Costa Rica es el caso por defecto de todo
 * el sitio, así que emitir `?pais=cr` en cada búsqueda cambiaría la
 * forma de TODAS las URLs que la gente ya compartió y guardó, sin que
 * ninguna filtre distinto — el directorio sin `?pais=` ya se comporta
 * como Costa Rica. Un país que no cambia nada no tiene por qué ensuciar
 * la barra de direcciones.
 *
 * La región se valida CONTRA EL PAÍS elegido, no contra las 7 de Costa
 * Rica: al cambiar de país, la región que había quedado seleccionada
 * simplemente no se emite, en vez de irse a un directorio vacío.
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

  // El «dónde» libre viaja tal cual (recortado): la portada lo compara
  // contra provincia y cantón sin tildes, y lo que no case da su vacío
  // honesto con la salida puesta. Validarlo acá contra una lista sería
  // resucitar el selector.
  const lugar = (parametros.lugar ?? "").trim();
  if (lugar) p.set("lugar", lugar);

  const categoria = parametros.categoria ?? "";
  if (RUBROS[pestana].some((r) => r.id === categoria)) p.set("categoria", categoria);

  const subcategoria = parametros.subcategoria ?? "";
  if (
    pestana === "eventos" &&
    (SUBCATEGORIAS_TODAS as readonly string[]).includes(subcategoria)
  ) {
    p.set("subcategoria", subcategoria);
  }

  // Un país desconocido cae en Costa Rica (`codigoPaisDe`), y Costa
  // Rica no se emite: la URL queda igual que siempre.
  const pais = codigoPaisDe(parametros.pais);
  if (pais !== PAIS_POR_DEFECTO) p.set("pais", pais);

  const provincia = parametros.provincia ?? "";
  if (esRegionValida(pais, provincia)) p.set("provincia", provincia);

  const query = p.toString();
  return query ? `${ruta}?${query}` : ruta;
}

/**
 * El país que el buscador muestra seleccionado, sacado de un valor
 * suelto (una prop, la URL). Nunca devuelve nada raro: lo desconocido
 * cae en Costa Rica, así que el `<select>` siempre tiene una opción
 * marcada y nunca aparece en blanco.
 */
export function paisDelBuscador(valor: string | null | undefined): CodigoPais {
  return codigoPaisDe(valor);
}
