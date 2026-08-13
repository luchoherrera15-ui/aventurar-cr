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

    const revelar = (el: Element) => {
      el.classList.remove("por-revelar");
      el.classList.add("is-revealed");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            revelar(entry.target);
            observer.unobserve(entry.target);
          }
        }
      },
      // `threshold: 0` — basta con que asome UN PÍXEL.
      //
      // Estaba en 0.1, y ahí está el bug de las secciones en blanco:
      // el umbral es el 10% DEL ELEMENTO, no de la pantalla. Con el
      // recorte de abajo, el área visible de la raíz es 0.9 de la
      // altura del viewport, así que un elemento más alto que ~9
      // pantallas NUNCA llega al 10% — y se queda invisible para
      // siempre, por mucho que uno scrollee.
      //
      // Con 0 no hay altura que se salve: cualquier cosa que asome, se
      // revela. Y el margen POSITIVO de abajo la revela un poco antes
      // de entrar, así nadie ve el fundido empezar.
      { rootMargin: "0px 0px 120px 0px", threshold: 0 },
    );

    const preparar = () => {
      const candidatos = document.querySelectorAll<HTMLElement>(
        "[data-reveal]:not(.is-revealed):not(.por-revelar)",
      );
      // Salida temprana ANTES de medir nada: sin candidatos no hay
      // layout que forzar. Importa porque esto corre en cada mutación
      // del DOM — y en una página con un campo de texto, eso es una
      // vez por tecla.
      if (candidatos.length === 0) return;

      const alto = window.innerHeight;
      candidatos.forEach((el) => {
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

    /**
     * LA RED DE SEGURIDAD.
     *
     * Esto esconde contenido y confía en que el observer lo devuelva.
     * Si por lo que sea no lo devuelve —un umbral mal calculado, un
     * elemento con `display` raro, un navegador con su propia idea del
     * `rootMargin`— la persona se queda mirando secciones en blanco y
     * no tiene forma de arreglarlo.
     *
     * Pasados 2 segundos, lo que siga escondido se muestra sin más. Se
     * pierde la animación de esos elementos; no se pierde la página.
     */
    const red = window.setTimeout(() => {
      document.querySelectorAll(".por-revelar").forEach(revelar);
    }, 2000);

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
      window.clearTimeout(red);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
