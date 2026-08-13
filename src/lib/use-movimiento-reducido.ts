"use client";

import { useSyncExternalStore } from "react";

/**
 * Separado de invitacion-animada.tsx a propósito: ese archivo carga las
 * piezas animadas completas de la plantilla de /i/{slug} (670 líneas).
 * Cualquier otra pantalla que solo necesite saber si el visitante pidió
 * movimiento reducido —como el riel de ejemplos de /invitaciones— no
 * tiene por qué arrastrar ese chunk entero para usar un solo hook.
 */

const QUERY_REDUCIDO = "(prefers-reduced-motion: reduce)";

/** Puntero de verdad: mouse o trackpad, no un dedo. */
const QUERY_MOUSE = "(hover: hover) and (pointer: fine)";

/**
 * Cualquier media query, como estado de React.
 *
 * Con `useSyncExternalStore` y no con `useEffect` + `setState`: el
 * efecto renderiza una vez con el valor equivocado y corrige después,
 * lo que produce un parpadeo — y React 19 lo marca como error de lint,
 * con razón. Esta forma le da a React la fuente de verdad directamente
 * y el servidor recibe el valor por defecto sin fingir que sabe.
 */
function useMediaQuery(query: string, porDefecto: boolean) {
  return useSyncExternalStore(
    (alCambiar) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", alCambiar);
      return () => mq.removeEventListener("change", alCambiar);
    },
    () => window.matchMedia(query).matches,
    () => porDefecto,
  );
}

/** true cuando el visitante pidió movimiento reducido. */
export function useMovimientoReducido() {
  return useMediaQuery(QUERY_REDUCIDO, false);
}

/**
 * true cuando hay mouse o trackpad.
 *
 * Lo piden las interacciones que se abren al pasar por encima: en una
 * laptop táctil `mouseenter` también dispara al tocar, y sin esta
 * comprobación el primer toque abriría algo distinto de lo que la
 * persona tocó. El valor por defecto en el servidor es `false` —
 * asumir que NO hay mouse deja la versión que funciona en todos lados.
 */
export function useTieneMouse() {
  return useMediaQuery(QUERY_MOUSE, false);
}
