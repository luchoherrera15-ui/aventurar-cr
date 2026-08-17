/**
 * ⚠️ ESTO YA NO ES EL SISTEMA DEL PANEL. Para cualquier pantalla nueva
 * de `/mi-negocio`, `/lealtad/panel` o `/cuenta`, la referencia es
 * `src/components/panel/sistema.ts` (tokens + contraste medido) y
 * `src/components/panel/piezas.tsx` (Card, Metrica, FilaPanel…). Este
 * archivo es el ancestro de `Metrica` y sobrevive por UNA razón
 * concreta:
 *
 *   El panel del dueño pasó a lienzo GRIS (`--grey`), y sobre gris la
 *   métrica correcta es la de la maqueta: tarjeta BLANCA con borde y
 *   sombra. `/cuenta` todavía tiene lienzo BLANCO, y ahí una tarjeta
 *   blanca sobre blanco no existe — por eso sigue necesitando este
 *   relleno sólido. Cambiarle el valor a estas dos constantes
 *   restyleaba `/cuenta` de rebote y la dejaba invisible.
 *
 * O sea: se migra cuando `/cuenta` migre de lienzo, en la pasada de esa
 * pantalla, y ahí este archivo se borra. Mientras tanto, nadie lo
 * importa desde una pantalla nueva.
 *
 * LA PIEL DE UNA TARJETA DE DATO — una sola decisión, dos pantallas.
 *
 * La usan el tablero del dueño (`/mi-negocio/[id]?tab=inicio`, "Tu
 * negocio en números") y el tablero de la cuenta (`/cuenta`, "Tu
 * actividad" y "Tu negocio"). Son dos pantallas con contenidos
 * distintos —una apila rótulo y número, la otra pone el número arriba a
 * la derecha— y NO se fuerzan a verse iguales: lo que comparten es el
 * lenguaje (fondo sólido, disco de ícono, misma elevación), no el
 * calco. Por eso esto son clases y no un componente con seis props:
 * cada pantalla arma su layout y toma de acá el color.
 *
 * ── POR QUÉ SÓLIDO ─────────────────────────────────────────────────
 * Antes cada tarjeta era blanca con un círculo decorativo azul sangrando
 * por la esquina inferior derecha (en /cuenta ese círculo era además un
 * alfa, `bg-aventurea-sky/10`). Dos problemas: el círculo se metía
 * detrás del número —el dato más importante de la tarjeta compitiendo
 * con un adorno— y un alfa hace que el MISMO elemento se vea de dos
 * colores según lo que tenga detrás, así que su contraste no se puede
 * medir una vez y darlo por bueno. Fuera el círculo, y el color pasa al
 * relleno: sólido, medible, uno solo.
 *
 * ── POR QUÉ ESTE COLOR ─────────────────────────────────────────────
 * `sky-light` (#e8f2fb) ya es la superficie de información de este
 * producto: es el fondo del aviso "Bookea está revisando tu
 * publicación" y el de los discos de ícono. No es un hexadecimal nuevo
 * ni un color inventado — es el escalón claro de la MISMA familia del
 * navy de marca (#16295e), que es lo que hace que combine con la
 * columna del menú en vez de pelearse con ella.
 *
 * ── CONTRASTE MEDIDO (WCAG 2.x, todo sobre #e8f2fb) ────────────────
 *   número en tinta fuerte  #161616 → 15,96:1   (AA y AAA)
 *   rótulo/detalle en gris  #585858 →  6,28:1   (AA para texto normal)
 *   número en navy /cuenta  #16295e → 12,24:1   (AA y AAA)
 *   disco navy contra la tarjeta    → 12,24:1   (elemento gráfico, ≥3:1)
 *   ícono blanco sobre el disco     → 13,88:1   (elemento gráfico, ≥3:1)
 * Ninguno de esos pares depende de lo que haya detrás de la tarjeta:
 * los cinco colores son sólidos.
 *
 * El disco va en NAVY y no en `sky-light` como antes: sobre una tarjeta
 * que ahora ES `sky-light`, un disco del mismo color desaparecía. Navy
 * con el ícono en blanco lo despega, y es el mismo par que usa el menú
 * lateral — el panel se lee como un solo sistema.
 */

/** Fondo, radio y elevación de una tarjeta de dato. El padding lo pone
 *  cada pantalla: en el tablero del dueño entran cuatro por fila y en
 *  /cuenta tres, y no respiran igual. */
export const SUPERFICIE_DATO =
  "rounded-2xl bg-aventurea-sky-light shadow-[0_10px_28px_-20px_rgba(22,41,94,0.5)]";

/** El disco del ícono. El tamaño lo pone cada pantalla (32/36px en el
 *  tablero del dueño, 40px en /cuenta). */
export const DISCO_DATO = "rounded-full bg-aventurea-navy text-white";
