"use client";

import { useEffect } from "react";

/**
 * Revela las secciones marcadas con `data-reveal` a medida que entran
 * en pantalla — un fade + subida sutil, no algo llamativo. Un solo
 * observer para toda la página en vez de un hook por sección.
 *
 * No usa Framer Motion ni nada nuevo: alcanza con clases CSS
 * (definidas en globals.css) y un IntersectionObserver que agrega la
 * clase una sola vez y se desentiende del elemento.
 *
 * También vigila el DOM con un MutationObserver: en páginas con
 * paginación del lado del cliente (el directorio) las cards de la
 * página 2 en adelante no existen todavía cuando este componente se
 * monta. Sin esto quedarían con opacity:0 para siempre — nadie las
 * volvería a mirar para revelarlas.
 *
 * ---
 *
 * El sentido está invertido respecto de la versión anterior, y esa es
 * la parte que importa para la velocidad. Antes el CSS escondía TODO
 * lo marcado con `data-reveal` y este componente lo iba mostrando: el
 * contenido quedaba invisible hasta que React hidrataba (medido: 1979
 * ms en el home y 4323 ms en la ficha de un negocio, en móvil de gama
 * media con 4G lento), y como el elemento LCP de /eventos y del home
 * es la foto de una card, el LCP quedaba atado a la hidratación.
 *
 * Ahora nada nace escondido. Este componente esconde (`.por-revelar`)
 * solo lo que está debajo del pliegue —que nadie está mirando— y lo
 * anima cuando sube. Lo de arriba se pinta apenas llega el HTML.
 */

/** Cuánto abajo del pliegue tiene que estar algo para valer la pena esconderlo. */
const MARGEN_PLIEGUE = 1.15;

/**
 * Si la página tardó más que esto en hidratar, no se esconde nada: la
 * persona ya vio el contenido y hacerlo desaparecer para animarlo se
 * lee como un error, no como un efecto.
 */
const TARDE_MS = 2500;

export default function RevealOnScroll() {
  useEffect(() => {
    const marcarVisto = (el: HTMLElement) => el.classList.add("is-revealed");

    // Sin IntersectionObserver no se esconde nada: el estado por
    // defecto del CSS ya es "visible", así que no hay que hacer nada.
    if (!("IntersectionObserver" in window)) return;

    const tarde = performance.now() > TARDE_MS;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("por-revelar");
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    const preparar = () => {
      const alto = window.innerHeight;
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed):not(.por-revelar)")
        .forEach((el) => {
          // Lo que ya se ve (o casi) se da por revelado sin tocarlo:
          // esconderlo ahora sería un parpadeo, no una animación.
          if (tarde || el.getBoundingClientRect().top < alto * MARGEN_PLIEGUE) {
            marcarVisto(el);
            return;
          }
          el.classList.add("por-revelar");
          observer.observe(el);
        });
    };

    preparar();

    // Las mutaciones llegan de a ráfagas (cada render de React dispara
    // varias). `preparar` mide posiciones, o sea que fuerza layout: se
    // agrupa en un frame para no pagarlo una vez por mutación.
    let pendiente = 0;
    const mutationObserver = new MutationObserver(() => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = 0;
        preparar();
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
