"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import type { DemoInvitacion } from "@/lib/catalogo-invitaciones";

// En móvil se ve una tarjeta completa más un asomo de la siguiente —
// eso es lo que invita a deslizar. Mismo criterio que el riel del
// directorio (RielProveedores), solo que acá cada card es más alta.
const ANCHO_TARJETA = "clamp(250px, 74vw, 320px)";

/**
 * Los ejemplos como un riel horizontal, no una grilla que se extiende
 * hacia abajo. Mismo patrón que RielProveedores en el directorio
 * (scroll-snap + flechas que se apagan en los extremos), reescrito acá
 * porque ese componente está atado a RanchoCard y a la piel clara del
 * sitio; esta landing es oscura y las cards son su propio diseño.
 *
 * Es cliente solo por las flechas — sin JavaScript el riel sigue
 * andando: es scroll horizontal nativo con snap, así que en el
 * teléfono se desliza con el dedo aunque algo falle.
 */
export default function RielEjemplos({
  demos,
  claseSerif,
}: {
  demos: DemoInvitacion[];
  claseSerif: string;
}) {
  const rielRef = useRef<HTMLDivElement>(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);

  const medir = useCallback(() => {
    const el = rielRef.current;
    if (!el) return;
    setPuedeIzq(el.scrollLeft > 4);
    setPuedeDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir, demos.length]);

  function desplazar(direccion: -1 | 1) {
    const el = rielRef.current;
    if (!el) return;
    // Casi una pantalla por click: se conserva un asomo de la tarjeta
    // anterior para no perder el hilo de dónde se venía.
    el.scrollBy({ left: direccion * el.clientWidth * 0.85, behavior: "smooth" });
  }

  const flechaCls =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white backdrop-blur-sm transition-all hover:border-white/35 hover:bg-white/10 disabled:opacity-25 disabled:hover:border-white/15 disabled:hover:bg-white/[0.06] [&_svg]:h-4.5 [&_svg]:w-4.5";

  return (
    <div className="relative">
      {/* Las flechas quedan arriba a la derecha, junto al texto — igual
          que en el directorio — en vez de flotar sobre las cards, que
          en un fondo con imágenes reales tapa contenido. */}
      <div className="mb-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => desplazar(-1)}
          disabled={!puedeIzq}
          aria-label="Ejemplos anteriores"
          className={flechaCls}
        >
          <IconChevronLeft />
        </button>
        <button
          type="button"
          onClick={() => desplazar(1)}
          disabled={!puedeDer}
          aria-label="Más ejemplos"
          className={flechaCls}
        >
          <IconChevronRight />
        </button>
      </div>

      {/* Los bordes se desvanecen contra el fondo de la sección para
          insinuar que sigue algo más allá, sin depender de que alguien
          note las flechas. */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#0a1226] to-transparent sm:w-16"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0a1226] to-transparent sm:w-16"
        />

        <div
          ref={rielRef}
          onScroll={medir}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {demos.map((demo) => {
            const m = demo.muestra ?? {
              fondo: "#efe7d8",
              tinta: "#2a2318",
              acento: "#c9a227",
            };
            return (
              <a
                key={demo.slug}
                href={`/i/${demo.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group block shrink-0 snap-start overflow-hidden rounded-3xl transition-transform duration-300 hover:-translate-y-1.5"
                style={{ width: ANCHO_TARJETA, background: "rgba(255,255,255,.05)" }}
              >
                {/* El lienzo: la invitación en chiquito. */}
                <div
                  className="relative flex aspect-[5/6] flex-col items-center justify-center px-6 text-center"
                  style={{ background: m.fondo, color: m.tinta }}
                >
                  {/* Marco interior, como el filete de una tarjeta impresa. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-4 rounded-xl border transition-all duration-300 group-hover:inset-3"
                    style={{ borderColor: m.acento, opacity: 0.45 }}
                  />
                  <p
                    className="text-[9.5px] font-bold uppercase tracking-[0.3em]"
                    style={{ color: m.acento }}
                  >
                    {demo.ocasion}
                  </p>
                  <p
                    className={`${claseSerif} mt-3 text-[clamp(26px,3.2vw,34px)] leading-[1.08]`}
                  >
                    {demo.nombre}
                  </p>
                  <span
                    aria-hidden
                    className="my-4 h-px w-10 transition-all duration-300 group-hover:w-16"
                    style={{ background: m.acento }}
                  />
                  <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                    Bookea · Invitación digital
                  </p>
                </div>

                {/* El pie, ya en la piel del sitio. */}
                <div className="p-5">
                  <p className="text-[13.5px] leading-relaxed text-white/60">
                    {demo.descripcion}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#ee7420]">
                    Abrir la invitación
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                    >
                      <path
                        d="M4 10h12m0 0-5-5m5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
