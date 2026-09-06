"use client";

import { useEffect, useRef } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

/**
 * EL CARRUSEL DE CARDS DEL HÉROE — avanza solo, hacia la derecha.
 *
 * Pedido del dueño (6 sep 2026, tras ver linktr.ee): «los cards a la
 * derecha del texto, y que se deslicen hacia la derecha automáticamente
 * — no arriba y abajo como ellos».
 *
 * Los cards los arma el servidor (landing-linksy.tsx) y llegan como
 * children. Esto es cliente por dos cosas: el reloj que avanza y las
 * flechas. El deslizar en sí es scroll NATIVO con snap
 * (`.linksy-carrusel`, globals.css): funciona con el dedo, la rueda y
 * arrastrando, sin JS que lo reinvente — la misma decisión que el
 * desfile de rubros de /lealtad.
 *
 * ── EL RELOJ ────────────────────────────────────────────────────────
 * Cada 3,5 s pasa al card siguiente; al llegar al último vuelve al
 * primero. Se frena mientras el mouse está encima, mientras un dedo lo
 * toca o mientras algo adentro tiene el foco — quien está mirando un
 * card no tiene que perseguirlo. Con `prefers-reduced-motion` NO
 * avanza solo: quien pidió menos movimiento pasa los cards a mano.
 *
 * `scrollTo` con `smooth` ya respeta reduced-motion por su cuenta (el
 * navegador lo vuelve instantáneo), así que las flechas no necesitan
 * un caso aparte.
 */

const INTERVALO_MS = 3500;
const HUECO_PX = 20;

export default function CarruselRubros({ children, auto = true }: { children: React.ReactNode; auto?: boolean }) {
  const pista = useRef<HTMLDivElement>(null);
  const pausado = useRef(false);

  const mover = (direccion: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const paso = card ? card.offsetWidth + HUECO_PX : el.clientWidth * 0.8;
    const maximo = el.scrollWidth - el.clientWidth;
    // En los extremos da la vuelta: el reloj no se queda clavado al final.
    if (direccion === 1 && el.scrollLeft >= maximo - 4) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (direccion === -1 && el.scrollLeft <= 4) {
      el.scrollTo({ left: maximo, behavior: "smooth" });
      return;
    }
    el.scrollBy({ left: direccion * paso, behavior: "smooth" });
  };

  useEffect(() => {
    if (!auto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reloj = window.setInterval(() => {
      if (!pausado.current) mover(1);
    }, INTERVALO_MS);
    return () => window.clearInterval(reloj);
  }, [auto]);

  const pausar = () => {
    pausado.current = true;
  };
  const seguir = () => {
    pausado.current = false;
  };

  return (
    <div
      className="relative"
      onPointerEnter={pausar}
      onPointerLeave={seguir}
      onTouchStart={pausar}
      onTouchEnd={seguir}
      onFocus={pausar}
      onBlur={seguir}
    >
      <div
        ref={pista}
        className="linksy-carrusel flex gap-5 overflow-x-auto pb-2 pt-2"
        role="region"
        aria-label="Ejemplos de páginas por tipo de negocio"
      >
        {children}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => mover(-1)}
          aria-label="Anterior"
          className="presionable grid h-12 w-12 place-items-center rounded-full border-2 bg-transparent"
          style={{ borderColor: "currentColor" }}
        >
          <IconChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => mover(1)}
          aria-label="Siguiente"
          className="presionable grid h-12 w-12 place-items-center rounded-full border-2 bg-transparent"
          style={{ borderColor: "currentColor" }}
        >
          <IconChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
