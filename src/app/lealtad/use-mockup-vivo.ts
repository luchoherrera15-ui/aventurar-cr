"use client";

import { useEffect, useRef, useState } from "react";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";

/**
 * ¿ESTE MOCKUP MERECE SU RELOJ? (auditoría de rendimiento, ago 2026)
 *
 * La landing de Lealtad monta NUEVE composiciones animadas por JS
 * —typewriters de 26–90 ms por letra, fases encadenadas con setTimeout,
 * algún setInterval— y todas corrían desde el montaje, estuvieran o no
 * en pantalla: decenas de re-renders por segundo acumulados en el hilo
 * principal mientras el visitante leía otra parte de la página.
 *
 * Este hook contesta la única pregunta que esos relojes necesitan
 * hacerse: `vivo` es true SOLO cuando (a) el visitante NO pidió
 * movimiento reducido y (b) el contenedor del mockup está en pantalla
 * o por entrar (300 px de margen: el reloj arranca un scroll antes de
 * asomar, así nadie lo encuentra congelado). Cuando el mockup sale del
 * todo, `vivo` vuelve a false y el reloj se PAUSA: los mockups arrancan
 * en un estado final coherente y limpian sus timers en el cleanup, así
 * que quedarse quietos a mitad de fase no rompe nada — al volver,
 * siguen donde iban.
 *
 * Reemplaza el patrón viejo de cada mockup (un `animar` que miraba
 * `prefers-reduced-motion` una sola vez, en el montaje): la preferencia
 * entra por `useMovimientoReducido()` —la fuente de verdad del repo,
 * que además reacciona si la cambian con la página abierta— y la
 * visibilidad por un IntersectionObserver propio.
 */
export function useMockupVivo<T extends HTMLElement>() {
  const reducido = useMovimientoReducido();
  const ref = useRef<T | null>(null);

  // `cerca` arranca en false A PROPÓSITO: el servidor no sabe dónde va
  // a estar el viewport, y varios mockups renderizan distinto según
  // `vivo` (el cursor del typewriter, el «✓ Enviado»…). Si el cliente
  // hidratara con true, el HTML no coincidiría — el desajuste de
  // hidratación que React 19 ya no perdona. Con false, los dos lados
  // pintan el mismo estado final quieto y el observador lo enciende
  // recién en el navegador.
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      // Sin observador no hay forma de saber dónde está el mockup.
      // Entre un reloj que corre de más y un mockup muerto para
      // siempre, correr de más es el fallo bueno: es exactamente lo
      // que hacía la página antes de este hook.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- una sola escritura, en el navegador raro sin IntersectionObserver: enciende el fallback y no vuelve a tocar el estado
      setCerca(true);
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        // El callback puede traer varias entradas acumuladas (entró y
        // salió entre dos avisos): manda la última, que es el presente.
        const ultima = entradas[entradas.length - 1];
        if (ultima) setCerca(ultima.isIntersecting);
      },
      // 300 px en las cuatro direcciones: suficiente para que el primer
      // fotograma animado ya esté corriendo cuando el mockup asoma, y
      // lo bastante poco para que dos pantallas más abajo no cuente.
      { rootMargin: "300px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return { ref, vivo: !reducido && cerca };
}
