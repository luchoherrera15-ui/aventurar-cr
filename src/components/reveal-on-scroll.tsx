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
 */
export default function RevealOnScroll() {
  useEffect(() => {
    const elementos = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (elementos.length === 0) return;

    // Sin JS o con el observer ya disparado no hay nada que animar —
    // mejor mostrar todo de una vez que dejarlo invisible por error.
    if (!("IntersectionObserver" in window)) {
      elementos.forEach((el) => el.classList.add("is-revealed"));
      return;
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

    elementos.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
