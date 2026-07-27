"use client";

import { useCallback, useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { FOTOS_DESTACADAS } from "@/app/mi-rancho/types";

/**
 * La grilla de fotos del portal (rancho, DJ, catering...), pero cada
 * foto abre en grande al tocarla. Antes solo se veían del tamaño fijo
 * de la grilla — para ver detalle había que confiar en el zoom del
 * navegador.
 */
export default function GaleriaLightbox({
  fotos,
  nombre,
}: {
  fotos: string[];
  nombre: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);

  const cerrar = useCallback(() => setAbierta(null), []);
  const anterior = useCallback(() => {
    setAbierta((i) => (i === null ? null : (i - 1 + fotos.length) % fotos.length));
  }, [fotos.length]);
  const siguiente = useCallback(() => {
    setAbierta((i) => (i === null ? null : (i + 1) % fotos.length));
  }, [fotos.length]);

  useEffect(() => {
    if (abierta === null) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") siguiente();
    }
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierta, cerrar, anterior, siguiente]);

  if (fotos.length === 0) return null;

  const destacadas = fotos.slice(0, FOTOS_DESTACADAS);
  const resto = fotos.slice(FOTOS_DESTACADAS);

  return (
    <>
      <div
        className={`mt-7 grid gap-3 ${
          destacadas.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {destacadas.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setAbierta(i)}
            aria-label={`Ver la foto ${i + 1} de ${nombre} en grande`}
            className={`group overflow-hidden rounded-2xl bg-aventurea-cream-2 ${
              destacadas.length === 1 ? "aspect-[16/9]" : "aspect-[4/3]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${nombre} — foto ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {resto.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {resto.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setAbierta(FOTOS_DESTACADAS + i)}
              aria-label={`Ver la foto ${FOTOS_DESTACADAS + i + 1} de ${nombre} en grande`}
              className="group aspect-[4/3] overflow-hidden rounded-xl bg-aventurea-cream-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${nombre} — foto ${FOTOS_DESTACADAS + i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      {abierta !== null && (
        <div
          onClick={cerrar}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ${abierta + 1} de ${fotos.length} — ${nombre}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white hover:bg-white/20"
          >
            ×
          </button>

          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[12.5px] font-bold text-white/70">
            {abierta + 1} / {fotos.length}
          </span>

          {fotos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                anterior();
              }}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:left-4"
            >
              <IconChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[abierta]}
            alt={`${nombre} — foto ${abierta + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />

          {fotos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                siguiente();
              }}
              aria-label="Foto siguiente"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:right-4"
            >
              <IconChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
