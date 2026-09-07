"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

/**
 * LA VITRINA DEL HÉROE — tres escenas que se funden una en otra.
 *
 * Pedido del dueño (7 sep 2026): «sustituí los cards por estas
 * imágenes, que queden profesionales y con una buena animación de
 * transición». Las imágenes (referencia/imagenes → public/linksy) ya
 * traen el teléfono con la página adentro: la escena ES el producto,
 * así que acá no se dibuja nada encima salvo el rótulo del rubro.
 *
 * ── LA TRANSICIÓN ──────────────────────────────────────────────────
 * Fundido cruzado con la duración y la curva del sistema
 * (`--duracion-revelado`, `--ease-bookea`) y un zoom lento de 9 s sobre
 * la escena activa (Ken Burns). Solo `opacity` y `transform`: nada que
 * dispare layout. Las clases y los keyframes viven en globals.css
 * (`.linksy-escena`, `linksy-kenburns`), con su bloque de
 * `prefers-reduced-motion` — ahí no hay zoom, el cambio es instantáneo
 * y el reloj no avanza solo.
 *
 * ── EL RELOJ ────────────────────────────────────────────────────────
 * Cada 4,5 s pasa a la siguiente y da la vuelta. Se frena con el mouse
 * encima, con un dedo apoyado o con el foco adentro. Los puntos y las
 * flechas cambian a mano; cambiar a mano no apaga el reloj, solo lo
 * reinicia — el efecto de las dependencias del `useEffect`.
 */

export type Bloque = "lima" | "azul" | "coral" | "lila" | "amarillo" | "menta" | "carbon";

export type Escena = {
  /** Ruta bajo /public. `next/image` la sirve optimizada por ancho. */
  src: string;
  alt: string;
  rubro: string;
  /** El nombre del negocio de muestra que aparece en la imagen. */
  marca: string;
  bloque: Bloque;
};

const INTERVALO_MS = 4500;

const bloque = (b: Bloque) => ({ background: `var(--linksy-${b})`, color: `var(--linksy-${b}-tinta)` });

export default function VitrinaEscenas({ escenas }: { escenas: Escena[] }) {
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado || escenas.length < 2) return;
    // Quien pidió menos movimiento pasa las escenas a mano.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reloj = window.setInterval(() => setActivo((a) => (a + 1) % escenas.length), INTERVALO_MS);
    return () => window.clearInterval(reloj);
    // `activo` va en las dependencias a propósito: un cambio a mano
    // reinicia el reloj, así la siguiente no llega a medio segundo del clic.
  }, [pausado, escenas.length, activo]);

  const ir = (d: 1 | -1) => setActivo((a) => (a + d + escenas.length) % escenas.length);

  return (
    <div
      className="flex flex-col gap-4"
      onPointerEnter={() => setPausado(true)}
      onPointerLeave={() => setPausado(false)}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div
        className="relative aspect-[3/2] w-full overflow-hidden shadow-flotante"
        style={{ borderRadius: "var(--linksy-radio)", background: "var(--linksy-carbon)" }}
        role="region"
        aria-roledescription="carrusel"
        aria-label="Ejemplos de páginas hechas con Linksy"
      >
        {escenas.map((e, i) => (
          <figure
            key={e.src}
            className="linksy-escena absolute inset-0 m-0"
            data-activo={i === activo ? "" : undefined}
            aria-hidden={i !== activo}
          >
            <Image
              src={e.src}
              alt={e.alt}
              fill
              sizes="(min-width: 1024px) 620px, 92vw"
              priority={i === 0}
              className="linksy-escena-foto object-cover"
            />
            <figcaption className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
              <span className="titulo rounded-full px-4 py-2 text-[14px] font-extrabold shadow-elevado" style={bloque(e.bloque)}>
                {e.rubro}
              </span>
              <span
                className="rounded-full px-3.5 py-2 text-[13px] font-bold shadow-elevado"
                style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}
              >
                {e.marca}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" role="tablist" aria-label="Escenas">
          {escenas.map((e, i) => (
            <button
              key={e.src}
              type="button"
              role="tab"
              aria-selected={i === activo}
              aria-label={e.rubro}
              onClick={() => setActivo(i)}
              className="presionable h-3 rounded-full"
              style={{
                width: i === activo ? 28 : 12,
                background: "currentColor",
                opacity: i === activo ? 1 : 0.35,
                transition: "width var(--duracion-card, 300ms) var(--ease-bookea, ease), opacity var(--duracion-micro, 200ms) var(--ease-bookea, ease)",
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => ir(-1)}
            aria-label="Anterior"
            className="presionable grid h-11 w-11 place-items-center rounded-full border-2 bg-transparent"
            style={{ borderColor: "currentColor" }}
          >
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => ir(1)}
            aria-label="Siguiente"
            className="presionable grid h-11 w-11 place-items-center rounded-full border-2 bg-transparent"
            style={{ borderColor: "currentColor" }}
          >
            <IconChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
