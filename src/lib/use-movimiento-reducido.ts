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

function suscribirReducido(alCambiar: () => void) {
  const mq = window.matchMedia(QUERY_REDUCIDO);
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

/** true cuando el visitante pidió movimiento reducido. */
export function useMovimientoReducido() {
  return useSyncExternalStore(
    suscribirReducido,
    () => window.matchMedia(QUERY_REDUCIDO).matches,
    () => false,
  );
}
