/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL DIALECTO OSCURO DEL SISTEMA DE PANELES
 * ═══════════════════════════════════════════════════════════════════
 *
 * Todo lo que se pueda salir de `@/components/panel/sistema` SALE DE
 * AHÍ: radios, escala tipográfica, huecos, la anatomía de la tarjeta.
 * Este módulo es solo lo que cambia por vivir sobre navy, y son tres
 * cosas: el par de acción, las superficies translúcidas y el sentido
 * del hover (sobre oscuro, «encendido» es más CLARO, no más oscuro).
 *
 * El otro pedazo del puente es `./panel-oscuro.css`, que traduce las
 * clases del sistema que sobre navy no se leen. Los dos van juntos.
 *
 * ── POR QUÉ ESTÁ ACÁ Y NO REPETIDO EN CADA PANTALLA ────────────────
 * Estas cuatro constantes de acción estaban COPIADAS en cuatro
 * archivos (`panel/page.tsx`, `[id]/page.tsx`, `shell-lealtad.tsx`,
 * `inicio-lealtad.tsx`), cada una con su comentario explicando lo
 * mismo. Cuatro copias de un color es cómo un panel termina con
 * cuatro azules.
 *
 * ── MÓDULO NEUTRO ──────────────────────────────────────────────────
 * Sin `"use client"` y sin React: lo importan tanto las páginas del
 * servidor como el shell y los paneles interactivos. Un helper
 * exportado desde un módulo cliente da un 500 invisible al build.
 *
 * ═══════════════════════════════════════════════════════════════════
 *  CONTRASTE MEDIDO — las tres superficies del módulo
 *    lienzo   #0a1226
 *    tarjeta  rgba(255,255,255,.045) sobre el lienzo → #151d30
 *    rail     #070d1c
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ACCIÓN
 *    #0a1226 sobre #9db4ff (botón lleno) ............. 9,23:1 ✅ AA
 *    #9db4ff sobre tarjeta #151d30 (enlace, borde) ... 8,32:1 ✅ AA
 *    #9db4ff sobre el tinte #1f2944 (chip, disco) .... 7,06:1 ✅ AA
 *
 *  TEXTO
 *    #ffffff sobre lienzo #0a1226 ................... 18,77:1 ✅ AAA
 *    #ffffff sobre tarjeta #151d30 .................. 16,79:1 ✅ AAA
 *    rgba(255,255,255,.62) sobre lienzo ............... 7,61:1 ✅ AA
 *    rgba(255,255,255,.62) sobre tarjeta .............. 6,81:1 ✅ AA
 *      (es lo que ya vale `text-aventurea-ink-soft` dentro del scope
 *       `.lealtad-oscuro`; se anota acá para no volver a medirlo)
 *    #9fb0cf sobre el rail #070d1c .................... 8,86:1 ✅ AA
 *      El sólido que reemplaza al `text-white/55` del menú. Un alfa
 *      hace que el mismo estado se vea de dos colores según lo que
 *      haya detrás, y el rail tiene tres fondos distintos (la barra,
 *      el ítem en hover y el ítem activo).
 *
 *  LO QUE NO SE USA, Y POR QUÉ
 *    #a83f00 (el kicker del sistema) sobre navy ....... 3,02:1 ✗
 *      Lo corrige `panel-oscuro.css` apuntándolo a `--orange-claro`.
 *    #0f4c9e (el azul de acción para fondo claro) ..... 1,44:1 ✗
 *      Por eso el contrato tiene DOS pares de azul, uno por fondo.
 */

// ───────────────────────────────────────────────────────────────────
//  1 · EL PAR DE ACCIÓN
// ───────────────────────────────────────────────────────────────────

/** El relleno de toda acción del módulo sobre fondo oscuro. */
export const ACCION = "var(--accion-claro)";

/** Su letra. Va con el token y no a ojo: sobre este azul el blanco
 *  daría 2,03:1, y el par ya viene decidido por contrato. */
export const ACCION_TINTA = "var(--accion-claro-tinta)";

/** El tinte informativo: el fondo de un chip, de un disco de ícono o
 *  de un bloque de aviso. Encima va SIEMPRE `ACCION` o blanco. */
export const ACCION_TINTE = "rgba(157,180,255,.14)";

/** El borde del mismo bloque, para que un aviso tenue y su botón no
 *  parezcan dos colores distintos. */
export const ACCION_BORDE = "rgba(157,180,255,.45)";

// ───────────────────────────────────────────────────────────────────
//  2 · LOS BOTONES DEL MÓDULO
// ───────────────────────────────────────────────────────────────────
//
// Misma geometría que `BOTON_PANEL*` del sistema (alto 40, radio 12,
// 13px/bold): lo que cambia es de dónde sale el color. El primario NO
// puede usar `BOTON_PANEL_PRIMARIO`, que se rellena de navy — navy
// sobre navy deja de parecer un botón.

/** El botón lleno. El color va por `style`, no por clase, porque sale
 *  de una variable y no de una utilidad de Tailwind. */
export const BOTON_ACCION =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold transition-opacity hover:opacity-90 disabled:opacity-50";

/** El botón de contorno: superficie de tarjeta y letra blanca. Estas
 *  clases sí las traduce `.lealtad-oscuro`, así que se escriben en el
 *  vocabulario del sistema. */
export const BOTON_LEALTAD =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface px-4 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50";

/** El botón cuadrado de ícono (cerrar, flechas), 36px. */
export const BOTON_ICONO_LEALTAD =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-aventurea-line bg-aventurea-surface text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50";

// ───────────────────────────────────────────────────────────────────
//  3 · LAS SUPERFICIES
// ───────────────────────────────────────────────────────────────────

/**
 * EL TILE (`.module` de la maqueta) EN VERSIÓN OSCURA.
 *
 * `TILE_PANEL` del sistema va de gris hundido a blanco en el hover:
 * traducido al scope oscuro eso queda de 9 % a 4,5 % de blanco, o sea
 * que ENCENDER el tile lo apaga. Sobre fondo oscuro la jerarquía de
 * elevación está al revés: más luz = más cerca.
 */
export const TILE_LEALTAD =
  "flex min-h-[72px] items-center gap-2.5 rounded-xl border border-aventurea-line bg-aventurea-surface p-2.5 text-left transition-colors hover:border-aventurea-navy hover:bg-aventurea-cream-2";

/**
 * LA SUPERFICIE HUNDIDA de adentro de una tarjeta (una fila de detalle,
 * el cuerpo de un acordeón). Por lo mismo de arriba NO es
 * `SUPERFICIE_HUNDIDA` del sistema: sobre oscuro, «un escalón abajo»
 * es menos luz, no más.
 */
export const HUNDIDO_LEALTAD = "rounded-xl border border-aventurea-line bg-black/20";

/** El disco de ícono de un encabezado o de una métrica. El par sale de
 *  `--acento*`, que `panel-oscuro.css` apunta al azul de acción. */
export const DISCO_LEALTAD: Record<string, string> = {
  backgroundColor: "var(--acento-suave)",
  color: "var(--acento)",
};

// ───────────────────────────────────────────────────────────────────
//  4 · LOS ESTADOS DE UNA TARJETA, EN EL VOCABULARIO DEL SISTEMA
// ───────────────────────────────────────────────────────────────────

/**
 * De `TONO_ESTADO` (lib/lealtad/programas.ts) a los cinco estados de
 * `PildoraEstado`.
 *
 * OJO CON EL VERDE: el módulo decidió a propósito que «activa» NO se
 * pinta de verde —está escrito en el comentario de `TONO_ESTADO`: el
 * verde queda fuera de la marca de Lealtad y el azul es el color de lo
 * que está funcionando—. Esta tabla existe para que esa decisión valga
 * en TODAS las pantallas de una sola vez: la lista de Tarjetas, el
 * status del tablero y la ficha del negocio pintan el mismo estado con
 * el mismo color porque los tres pasan por acá.
 *
 * El tipo se escribe con las claves literales y no importando
 * `TONO_ESTADO` para que este módulo siga sin dependencias.
 */
export const ESTADO_DE_TONO = {
  azul: "info",
  naranja: "aviso",
  gris: "neutro",
} as const;

// ───────────────────────────────────────────────────────────────────
//  5 · LA COLUMNA DEL MENÚ
// ───────────────────────────────────────────────────────────────────

/**
 * El ítem del menú en reposo.
 *
 * ── MÁS GRANDE Y MÁS SIMPLE (dueño, 31 ago 2026) ──────────────────
 * Pedido textual: «que sean como más grandes, más simples de usar y
 * más fáciles», con una referencia visual de otro panel.
 *
 * Qué cambió y por qué:
 *  · 38 → 48 px de alto. El mínimo táctil del sistema es 44; el menú
 *    del panel es lo que más se toca en el teléfono y estaba 6 px por
 *    debajo.
 *  · 13 → 14,5 px de texto y el ícono de 17 → 20. Un menú se lee de
 *    reojo mientras se hace otra cosa, no se estudia.
 *  · SE FUE EL BORDE IZQUIERDO DE 3 px. El activo ahora es una
 *    píldora sólida (ver `RAIL_ITEM_ACTIVO`): una barrita fina obliga
 *    a buscar cuál está encendido, un bloque de color se ve de una.
 *    Al no reservar esos 3 px, el texto tampoco salta al cambiar de
 *    sección — que era el motivo por el que el borde estaba siempre
 *    presente en transparente.
 *
 * `text-aventurea-rail` es el sólido de 8,86:1 sobre el #070d1c del
 * rail — el reemplazo del `text-white/55` que tenía, que se veía de
 * tres colores distintos según el fondo.
 */
export const RAIL_ITEM_LEALTAD =
  "relative flex min-h-[48px] items-center gap-3 rounded-xl px-3.5 text-[14.5px] font-bold transition-colors";

/**
 * El ítem ENCENDIDO: píldora sólida con el azul de acción.
 *
 * ⚠️ El par es `--accion-claro` sobre el navy del rail, no `--accion`:
 * el azul de acción sobre fondo oscuro da 1,44:1 y el ítem activo se
 * tragaría el texto. Es el mismo par que ya usa el resto del módulo
 * sobre superficies oscuras.
 */
export const RAIL_ITEM_ACTIVO = "text-[color:var(--accion-claro-tinta)]";

/** El rótulo de un grupo del menú (`.nav-label` de la maqueta). */
export const RAIL_GRUPO_LEALTAD =
  "mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-rail";
