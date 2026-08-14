"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { IconChevronLeft, IconChevronRight, IconX } from "@/components/icons";
import type { FotoPortfolio } from "./perfil-tipos";

type Props = { fotos: FotoPortfolio[] };

/** "Balayage — por Laura Méndez" · "Balayage" · "Por Laura Méndez" · null si no hay ninguno de los dos. */
function etiquetaFoto(foto: FotoPortfolio): string | null {
  if (foto.servicioNombre && foto.profesionalNombre) {
    return `${foto.servicioNombre} — por ${foto.profesionalNombre}`;
  }
  if (foto.servicioNombre) return foto.servicioNombre;
  if (foto.profesionalNombre) return `Por ${foto.profesionalNombre}`;
  return null;
}

/**
 * La galería de trabajos con lightbox. HOY estas fotos son las mismas
 * fotos generales del negocio (no existe todavía una tabla de
 * portafolio propia), así que "servicioNombre"/"profesionalNombre"
 * van a venir casi siempre null — el componente se ve bien igual, sin
 * etiqueta. Sin fotos, la sección no se renderiza: nunca un espacio
 * gigante vacío.
 */
export default function PortfolioGallery({ fotos }: Props) {
  const [indice, setIndice] = useState<number | null>(null);

  const hayVarias = fotos.length > 1;

  useEffect(() => {
    if (indice === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIndice(null);
      if (e.key === "ArrowRight" && hayVarias) {
        setIndice((i) => (i === null ? i : (i + 1) % fotos.length));
      }
      if (e.key === "ArrowLeft" && hayVarias) {
        setIndice((i) => (i === null ? i : (i - 1 + fotos.length) % fotos.length));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [indice, hayVarias, fotos.length]);

  if (fotos.length === 0) return null;

  const fotoActual = indice !== null ? fotos[indice] : null;
  const etiquetaActual = fotoActual ? etiquetaFoto(fotoActual) : null;

  return (
    <div className="mt-9">
      <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">
        Portafolio
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {fotos.map((foto, i) => (
          <button
            key={`${foto.url}-${i}`}
            type="button"
            onClick={() => setIndice(i)}
            aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-blue-light"
          >
            <Image
              src={foto.url}
              alt={foto.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {/* ---------- Lightbox ---------- */}
      {fotoActual && indice !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto del portafolio"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setIndice(null)}
            className="absolute inset-0 cursor-default bg-[rgba(10,18,42,0.72)] backdrop-blur-[2px]"
          />

          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setIndice(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/50"
          >
            <IconX className="h-4 w-4" />
          </button>

          {hayVarias && (
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => setIndice((i) => (i === null ? i : (i - 1 + fotos.length) % fotos.length))}
              className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/50 sm:left-5"
            >
              <IconChevronLeft className="h-5 w-5" />
            </button>
          )}
          {hayVarias && (
            <button
              type="button"
              aria-label="Foto siguiente"
              onClick={() => setIndice((i) => (i === null ? i : (i + 1) % fotos.length))}
              className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white transition-colors hover:bg-black/50 sm:right-5"
            >
              <IconChevronRight className="h-5 w-5" />
            </button>
          )}

          <div className="relative z-[5] flex max-h-[85vh] w-full max-w-[720px] flex-col items-center">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/20">
              <Image
                src={fotoActual.url}
                alt={fotoActual.alt}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
            {etiquetaActual && (
              <p className="mt-3 text-center text-[13.5px] font-bold text-white">
                {etiquetaActual}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
