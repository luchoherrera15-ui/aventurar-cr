"use client";

import { useRef, useState } from "react";
import { Lightbox } from "@/components/galeria-lightbox";

/**
 * Las fotos del hero del portal. En desktop es la grilla de 1 grande +
 * 4 chicas de siempre; en el teléfono era solo la primera foto sin
 * forma de ver el resto, así que ahora es un carrusel deslizable con
 * contador. En ambos casos tocar una foto la abre en grande.
 */
export default function GaleriaHeroFotos({
  fotos,
  nombre,
}: {
  fotos: string[];
  nombre: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [visible, setVisible] = useState(0);
  const rielRef = useRef<HTMLDivElement>(null);

  const [grande, ...resto] = fotos;
  const chicas = resto.slice(0, 4);
  // Cuántas quedaron fuera de la grilla de desktop (van al chip "+N").
  const ocultasDesktop = fotos.length - 1 - chicas.length;

  // El carrusel de móvil muestra las mismas 5 fotos que la grilla de
  // desktop (grande + chicas) — el resto vive más abajo en "Conocé el
  // espacio". Antes el carrusel recorría TODAS las fotos, así que en
  // móvil se veían dos veces: primero deslizando acá arriba y de nuevo
  // en la sección de abajo.
  const previa = fotos.slice(0, 5);
  const ocultasMovil = fotos.length - previa.length;

  return (
    <div className="mx-auto max-w-[1080px] px-0 sm:px-7 sm:pt-7">
      {/* ---------- Móvil: carrusel con scroll-snap ---------- */}
      <div className="relative sm:hidden">
        <div
          ref={rielRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setVisible(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {previa.map((foto, i) => {
            const esUltima = i === previa.length - 1 && ocultasMovil > 0;
            return (
              <button
                key={foto + i}
                type="button"
                onClick={() => setAbierta(i)}
                aria-label={`Ver la foto ${i + 1} de ${nombre} en grande`}
                className="relative w-full shrink-0 snap-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- fotos externas subidas por cada proveedor */}
                <img
                  src={foto}
                  alt={`${nombre} — foto ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="aspect-[16/11] w-full object-cover"
                />
                {esUltima && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[15px] font-extrabold text-white">
                    +{ocultasMovil} fotos
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {previa.length > 1 && (
          <>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/55 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur-sm">
              {visible + 1} / {previa.length}
            </span>
            <div className="pointer-events-none absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-1.5">
              {previa.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === visible ? "w-4 bg-white" : "w-1.5 bg-white/55"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Botón explícito para ver todo el álbum en móvil — antes solo se
          podía adivinar tocando el "+N" de la última miniatura. */}
      {fotos.length > 1 && (
        <button
          type="button"
          onClick={() => setAbierta(0)}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-navy hover:text-aventurea-navy sm:hidden"
        >
          Ver todas las fotos ({fotos.length})
        </button>
      )}

      {/* ---------- Desktop: 1 grande + hasta 4 chicas ---------- */}
      <div className="relative hidden gap-2 overflow-hidden sm:grid sm:grid-cols-4 sm:grid-rows-2 sm:rounded-xl">
        <button
          type="button"
          onClick={() => setAbierta(0)}
          aria-label={`Ver la foto principal de ${nombre} en grande`}
          className="group col-span-2 row-span-2 overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ídem */}
          <img
            src={grande}
            alt={nombre}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </button>
        {chicas.map((foto, i) => {
          const esUltima = i === chicas.length - 1 && ocultasDesktop > 0;
          return (
            <button
              key={foto + i}
              type="button"
              onClick={() => setAbierta(i + 1)}
              aria-label={`Ver la foto ${i + 2} de ${nombre} en grande`}
              className="group relative aspect-square overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ídem */}
              <img
                src={foto}
                alt={`${nombre} — foto ${i + 2}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {esUltima && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[14px] font-extrabold text-white">
                  +{ocultasDesktop} fotos
                </span>
              )}
            </button>
          );
        })}

        {/* Botón explícito para ver todo el álbum — antes solo se podía
            adivinar tocando el "+N" de la última miniatura. */}
        {fotos.length > 1 && (
          <button
            type="button"
            onClick={() => setAbierta(0)}
            className="absolute bottom-3 right-3 flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[13px] font-bold text-aventurea-ink shadow-[0_2px_10px_rgba(16,26,44,0.18)] hover:bg-aventurea-cream-2"
          >
            Ver todas las fotos ({fotos.length})
          </button>
        )}
      </div>

      <Lightbox
        fotos={fotos}
        nombre={nombre}
        abierta={abierta}
        onCambiar={setAbierta}
        onCerrar={() => setAbierta(null)}
      />
    </div>
  );
}
