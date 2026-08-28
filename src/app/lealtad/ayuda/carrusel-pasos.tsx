"use client";

import { useRef, useState } from "react";

/**
 * LOS PASOS DEL TUTORIAL, EN DIAPOSITIVAS (pedido del dueño, 28 ago
 * 2026: «que sea slideable hacia la derecha, los puntos, tipo
 * diapositivas»).
 *
 * Es scroll-snap NATIVO y no una librería de carrusel: el riel es un
 * overflow-x con `snap-mandatory`, así que en el teléfono se desliza
 * con el dedo como cualquier lista, con la física del sistema. El
 * JavaScript solo hace dos cosas que el CSS no puede: saber en qué
 * diapositiva se está (para encender su punto) y desplazar suave al
 * tocar un punto o una flecha.
 *
 * El índice activo sale de `scrollLeft / clientWidth` REDONDEADO: cada
 * diapositiva mide exactamente el ancho del riel, así que a mitad de
 * arrastre el punto cambia justo al cruzar la mitad — que es lo que el
 * pulgar espera.
 */
export default function CarruselPasos({
  pasos,
}: {
  pasos: {
    titulo: string;
    contenido: React.ReactNode;
    mockup: React.ReactNode;
    /**
     * Composición ANCHA (el escaneo: teléfono + tarjeta lado a lado):
     * su columna gana espacio para no aplastar la tarjeta del
     * mostrador — la lección de la primera revisión del dueño.
     */
    ancho?: boolean;
  }[];
}) {
  const riel = useRef<HTMLDivElement | null>(null);
  const [activo, setActivo] = useState(0);

  function alDesplazar() {
    const r = riel.current;
    if (!r || r.clientWidth === 0) return;
    setActivo(
      Math.max(0, Math.min(pasos.length - 1, Math.round(r.scrollLeft / r.clientWidth))),
    );
  }

  function irA(i: number) {
    const r = riel.current;
    if (!r) return;
    r.scrollTo({ left: i * r.clientWidth, behavior: "smooth" });
  }

  const FLECHA =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-aventurea-line bg-white text-[18px] font-bold text-aventurea-navy transition-opacity disabled:opacity-30";

  return (
    <section aria-label="Los pasos, uno por uno" className="mx-auto w-full max-w-[1080px] px-5 py-12">
      <div
        ref={riel}
        onScroll={alDesplazar}
        className="flex snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {pasos.map((p, i) => (
          <article key={p.titulo} className="w-full shrink-0 snap-center px-1 sm:px-2">
            <div
              className={`grid items-center gap-8 lg:gap-12 ${
                p.ancho ? "lg:grid-cols-[0.9fr_1.1fr]" : "lg:grid-cols-2"
              }`}
            >
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-aventurea-navy px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
                  Paso {i + 1} de {pasos.length}
                </p>
                <h2 className="titulo mt-4 text-[clamp(22px,3vw,32px)] leading-[1.12] text-aventurea-navy">
                  {p.titulo}
                </h2>
                <div className="mt-3 flex max-w-[52ch] flex-col gap-3 text-[15px] leading-relaxed text-aventurea-ink-soft">
                  {p.contenido}
                </div>
              </div>
              <div className="min-w-0">{p.mockup}</div>
            </div>
          </article>
        ))}
      </div>

      {/* Las flechas y los puntos. El punto activo se ALARGA en vez de
          solo cambiar de color: se ve cuál es sin comparar tonos. */}
      <div className="mt-9 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => irA(activo - 1)}
          disabled={activo === 0}
          aria-label="Paso anterior"
          className={FLECHA}
        >
          ←
        </button>
        <div className="flex items-center gap-2.5">
          {pasos.map((p, i) => (
            <button
              key={p.titulo}
              type="button"
              onClick={() => irA(i)}
              aria-label={`Ir al paso ${i + 1}: ${p.titulo}`}
              aria-current={activo === i ? "true" : undefined}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                activo === i ? "w-9 bg-aventurea-navy" : "w-2.5 bg-aventurea-line hover:bg-aventurea-navy/40"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => irA(activo + 1)}
          disabled={activo === pasos.length - 1}
          aria-label="Paso siguiente"
          className={FLECHA}
        >
          →
        </button>
      </div>
    </section>
  );
}
