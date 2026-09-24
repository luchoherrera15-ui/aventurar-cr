"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";
import type { TipoCelebracionId } from "@/lib/celebrar/marca";
import { ICONO_TIPO } from "./iconos-tipos";
import { EnlaceCelebrar } from "./rutas-cliente";

export type TarjetaTipo = {
  id: TipoCelebracionId;
  plural: string;
  href: string;
  foto: { url: string; alt: string };
};

/** Cada cuánto pasa sola a la siguiente tarjeta. */
const CADA_MS = 3600;

/**
 * El carrusel de ocasiones de la portada: tarjetas con foto a color
 * que van pasando solas hacia la derecha y que también se pueden
 * arrastrar con el dedo o el mouse, o pasar con las flechas.
 *
 * Es scroll NATIVO con scroll-snap (no una animación CSS): así el
 * arrastre, el momentum del teléfono y el snap los da el navegador, y
 * el avance automático es solo un `scrollTo` cada tantos segundos. Se
 * detiene mientras la persona lo toca, lo tiene bajo el cursor o el
 * foco, cuando no está en pantalla, y siempre con
 * `prefers-reduced-motion`.
 */
export default function CarruselTipos({ tarjetas }: { tarjetas: TarjetaTipo[] }) {
  const riel = useRef<HTMLUListElement>(null);
  const [pausado, setPausado] = useState(false);
  const [visible, setVisible] = useState(true);
  const [activo, setActivo] = useState(0);
  const reducido = useMovimientoReducido();
  const arrastre = useRef<{ x: number; scroll: number; movio: boolean } | null>(null);
  // Si el último gesto fue un arrastre, el clic que lo cierra no abre el link.
  const ultimoFueArrastre = useRef(false);

  /** El ancho de un paso: una tarjeta más su separación. */
  const paso = useCallback(() => {
    const el = riel.current;
    const primera = el?.firstElementChild as HTMLElement | null;
    if (!el || !primera) return 0;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return primera.offsetWidth + gap;
  }, []);

  const irA = useCallback(
    (indice: number, suave = true) => {
      const el = riel.current;
      const p = paso();
      if (!el || !p) return;
      const n = tarjetas.length;
      const destino = ((indice % n) + n) % n;
      el.scrollTo({ left: destino * p, behavior: suave ? "smooth" : "auto" });
    },
    [paso, tarjetas.length],
  );

  // Cuál tarjeta está más cerca del borde izquierdo: para las flechas y el avance.
  useEffect(() => {
    const el = riel.current;
    if (!el) return;
    const alScroll = () => {
      const p = paso();
      if (p) setActivo(Math.round(el.scrollLeft / p));
    };
    el.addEventListener("scroll", alScroll, { passive: true });
    return () => el.removeEventListener("scroll", alScroll);
  }, [paso]);

  // Solo avanza cuando está en pantalla.
  useEffect(() => {
    const el = riel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => setVisible(es.some((e) => e.isIntersecting)), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // El avance automático.
  useEffect(() => {
    if (pausado || !visible || reducido) return;
    const id = setInterval(() => {
      const el = riel.current;
      const p = paso();
      if (!el || !p) return;
      const ultimo = Math.round(el.scrollLeft / p) >= tarjetas.length - Math.max(1, Math.floor(el.clientWidth / p));
      irA(ultimo ? 0 : Math.round(el.scrollLeft / p) + 1);
    }, CADA_MS);
    return () => clearInterval(id);
  }, [pausado, visible, reducido, paso, irA, tarjetas.length]);

  // Arrastre con el mouse (en el teléfono el scroll nativo ya lo hace).
  function alBajar(e: React.PointerEvent<HTMLUListElement>) {
    if (e.pointerType !== "mouse") return;
    const el = riel.current;
    if (!el) return;
    arrastre.current = { x: e.clientX, scroll: el.scrollLeft, movio: false };
    ultimoFueArrastre.current = false;
    el.classList.add("arrastrando");
    setPausado(true);
  }
  function alMover(e: React.PointerEvent<HTMLUListElement>) {
    const a = arrastre.current;
    const el = riel.current;
    if (!a || !el) return;
    const dx = e.clientX - a.x;
    if (Math.abs(dx) > 4) a.movio = true;
    el.scrollLeft = a.scroll - dx;
  }
  function alSoltar() {
    const el = riel.current;
    const a = arrastre.current;
    arrastre.current = null;
    if (!el) return;
    el.classList.remove("arrastrando");
    ultimoFueArrastre.current = !!a?.movio;
    // Al soltar, que el snap acomode la tarjeta más cercana.
    if (a?.movio) irA(Math.round(el.scrollLeft / (paso() || 1)));
  }
  function alClic(e: React.MouseEvent) {
    if (ultimoFueArrastre.current) {
      e.preventDefault();
      ultimoFueArrastre.current = false;
    }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={() => setPausado(false)}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
    >
      <ul
        ref={riel}
        className="c-carrusel -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 pt-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onPointerLeave={alSoltar}
        aria-label="Tipos de celebración"
      >
        {tarjetas.map((t, i) => {
          const Icono = ICONO_TIPO[t.id];
          return (
            <li key={t.id} id={`tipo-${t.id}`} className="w-[72vw] shrink-0 snap-start scroll-mt-24 sm:w-[300px]">
              <EnlaceCelebrar
                a={t.href}
                onClick={alClic}
                className="c-tarjeta-foto group relative block aspect-[4/5] overflow-hidden rounded-[22px] bg-(--c-marino)"
                draggable={false}
              >
                <Image
                  src={t.foto.url}
                  alt={t.foto.alt}
                  fill
                  sizes="(max-width: 640px) 72vw, 300px"
                  quality={80}
                  priority={i < 3}
                  draggable={false}
                  className="object-cover transition-transform duration-700 ease-(--ease-bookea) group-hover:scale-[1.06]"
                />
                <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,30,69,.88)_0%,rgba(11,30,69,.35)_45%,rgba(11,30,69,0)_75%)]" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                  <span>
                    <span className="c-disco h-10 w-10 rounded-xl bg-white/15 text-white backdrop-blur-sm">
                      <Icono className="h-5 w-5" />
                    </span>
                    <span className="c-montserrat mt-3 block text-[20px] font-bold leading-tight text-(--c-blanco)">{t.plural}</span>
                    <span className="mt-1 block text-[13px] text-white/80">40 diseños · editables en vivo</span>
                  </span>
                  <span className="c-montserrat mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--c-blanco) text-(--c-marino) transition-transform duration-(--duracion-micro) ease-(--ease-bookea) group-hover:translate-x-0.5" aria-hidden="true">
                    →
                  </span>
                </span>
              </EnlaceCelebrar>
            </li>
          );
        })}
      </ul>

      {/* Las flechas y el indicador */}
      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-hidden="true">
          {tarjetas.map((t, i) => (
            <span key={t.id} className={`h-1.5 rounded-full transition-all duration-(--duracion-micro) ease-(--ease-bookea) ${i === activo ? "w-6 bg-(--c-marino)" : "w-1.5 bg-(--c-linea)"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => irA(activo - 1)} aria-label="Anterior" className="flex h-11 w-11 items-center justify-center rounded-full border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) hover:border-(--c-marino)">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" onClick={() => irA(activo + 1)} aria-label="Siguiente" className="flex h-11 w-11 items-center justify-center rounded-full border border-(--c-linea) bg-(--c-blanco) text-(--c-tinta) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) hover:border-(--c-marino)">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
