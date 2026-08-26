/**
 * ════════════════════════════════════════════════════════════════════
 *  LA FICHA DE LA TARJETA — la escala tipográfica de esta pantalla
 * ════════════════════════════════════════════════════════════════════
 *
 * Módulo NEUTRO a propósito: sin `"use client"` y sin React, solo
 * strings. Lo importan seis componentes de cliente y podría importarlo
 * un `page.tsx` de servidor. Es la misma regla que documenta
 * `src/components/panel/sistema.ts`, y no es teórica: un helper
 * exportado desde un módulo cliente da un 500 invisible al build, y en
 * este repo ya rompió Finanzas y el panel de IA.
 *
 * ── QUÉ VINO A REEMPLAZAR ───────────────────────────────────────────
 *
 * `const etiqueta = "mb-1.5 block text-[9.5px] font-bold uppercase
 * tracking-wide text-bookea-gris"` — nueve usos en la pantalla del
 * diseño, más cuatro clones en los componentes hijos.
 *
 * 9,5 px es el texto más chico de todo el producto (el sistema de
 * paneles tiene su piso en 11) y encima va en gris, en mayúsculas y con
 * tracking. Trece rótulos así, todos del mismo tamaño y del mismo color,
 * son lo que hacía que esta pantalla se leyera como un formulario viejo
 * por más que se le movieran las cajas de lugar. El dueño lo dijo dos
 * veces: «sigue viéndose exactamente igual».
 *
 * ── EL TRUCO, QUE ES UNO SOLO ───────────────────────────────────────
 *
 * El rótulo gana TINTA, no tamaño: pasa de gris a `--text`, que contra
 * el blanco da 16,9:1. Ése es el escalón contra el gris de la nota, y
 * por eso la nota puede quedarse en `--muted` sin que las dos se
 * confundan. Jerarquía por peso y color, no por catorce tamaños.
 */

/**
 * N2 · La versalita.
 *
 * Sobrevive en DOS lugares: el nombre del capítulo y las etiquetas de la
 * placa de datos. En ningún otro — si vuelve a aparecer en cada campo,
 * volvimos al formulario.
 */
export const EYEBROW_FICHA =
  "text-[11px] font-extrabold uppercase leading-none tracking-[0.16em] text-bookea-gris";

/** El título de un capítulo de la ficha. */
export const TITULO_CAPITULO = "titulo text-[21px] text-bookea-azul sm:text-[23px]";

/** N3 · El rótulo de un campo. El reemplazo directo de `etiqueta`. */
export const ROTULO = "mb-2 block text-[13.5px] font-bold leading-tight text-bookea-tinta";

/** N4 · La nota al margen y la ayuda debajo de un campo. */
export const NOTA = "text-[12.5px] leading-relaxed text-bookea-gris lg:text-[12px]";

/**
 * EL CAMPO DE TEXTO.
 *
 * CAJA en teléfono, SUBRAYADO de `sm:` para arriba. No es indecisión: un
 * campo vacío con solo una línea abajo se lee como texto suelto en una
 * pantalla angosta, y el alta pública es justo por donde entra gente que
 * nunca vio el producto. El gesto editorial es de pantalla ancha.
 *
 * El apagado del borde va con `border-x-0 border-t-0` y NO con
 * `border-0 border-b`: esas dos compiten por la misma cascada y gana la
 * que Tailwind emita última en la hoja, no la que esté después en el
 * atributo. Poner los tres lados en cero explícitamente es determinista.
 *
 * ⚠️ NO LLEVA `outline-none`, Y ESO ES EL ARREGLO DE UN BUG REAL.
 *
 * El `CAMPO_BASE` anterior la traía. El anillo de foco global vive en
 * `globals.css` dentro de un `:where(...)`, o sea con especificidad
 * CERO: cualquier `outline-none` lo apaga. O sea que hasta hoy NINGÚN
 * campo de esta pantalla tenía anillo al navegar con teclado — y el
 * propio `globals.css` escribe tres líneas antes «⚠️ Y prohibido
 * `outline-none` sin un reemplazo medido».
 */
export const CAMPO_FICHA =
  "w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[15px] " +
  "font-medium text-bookea-tinta transition-colors placeholder:font-normal " +
  "placeholder:text-bookea-gris/70 hover:border-bookea-gris focus:border-bookea-azul " +
  "disabled:text-bookea-gris " +
  "sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:py-2";

/**
 * El segmentado que reemplaza a las grillas de tres botones sueltos.
 *
 * Un control de tres opciones excluyentes es un segmentado, no tres
 * botones: la caja compartida es la que dice «acá se elige UNA».
 */
export const SEGMENTADO = "flex w-full rounded-xl border border-bookea-linea bg-bookea-fondo p-0.5";
export const SEGMENTO =
  "presionable min-w-0 flex-1 truncate rounded-[10px] px-2 py-1.5 text-[11.5px] font-bold transition-colors";
export const SEGMENTO_ON = "bg-white text-bookea-azul shadow-plano";
export const SEGMENTO_OFF = "text-bookea-gris hover:text-bookea-tinta";
