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
 */
export default function RevealOnScroll() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      // Sin soporte, mejor mostrar todo de una vez que dejarlo
      // invisible por error — y seguir mostrando lo que se agregue.
      const mostrarTodo = () => {
        document
          .querySelectorAll<HTMLElement>("[data-reveal]")
          .forEach((el) => el.classList.add("is-revealed"));
      };
      mostrarTodo();
      const mo = new MutationObserver(mostrarTodo);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    const observarNuevos = () => {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)")
        .forEach((el) => observer.observe(el));
    };

    observarNuevos();
    const mutationObserver = new MutationObserver(observarNuevos);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
