"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { FOTOS_DESTACADAS } from "@/app/mi-negocio/types";

/**
 * Los hosts que `next.config.ts` le autoriza al optimizador de
 * imágenes. Si la foto no viene de acá (blob: de una subida en curso,
 * URL firmada, dominio ajeno), se sirve tal cual.
 */
const HOSTS_OPTIMIZABLES = ["bjhprmtobmualefvcmau.supabase.co", "images.unsplash.com"];

function esOptimizable(src: string) {
  return src.startsWith("/") || HOSTS_OPTIMIZABLES.some((h) => src.startsWith(`https://${h}/`));
}

/** La misma foto pasada por el optimizador, a un ancho concreto. */
function urlVisor(src: string, ancho: number) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${ancho}&q=75`;
}

/**
 * La grilla de fotos del portal (rancho, DJ, catering...), pero cada
 * foto abre en grande al tocarla. Antes solo se veían del tamaño fijo
 * de la grilla — para ver detalle había que confiar en el zoom del
 * navegador.
 */
/**
 * El visor a pantalla completa, separado de la grilla para que
 * también lo pueda abrir el carrusel del hero. Quien lo usa guarda
 * el índice abierto (o null) y se lo pasa.
 */
export function Lightbox({
  fotos,
  nombre,
  abierta,
  onCambiar,
  onCerrar,
}: {
  fotos: string[];
  nombre: string;
  abierta: number | null;
  onCambiar: (indice: number) => void;
  onCerrar: () => void;
}) {
  const anterior = useCallback(() => {
    if (abierta !== null) onCambiar((abierta - 1 + fotos.length) % fotos.length);
  }, [abierta, fotos.length, onCambiar]);
  const siguiente = useCallback(() => {
    if (abierta !== null) onCambiar((abierta + 1) % fotos.length);
  }, [abierta, fotos.length, onCambiar]);

  useEffect(() => {
    if (abierta === null) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") siguiente();
    }
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierta, onCerrar, anterior, siguiente]);

  if (abierta === null) return null;

  return (
    <div
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${abierta + 1} de ${fotos.length} — ${nombre}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onCerrar}
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

      {/* eslint-disable-next-line @next/next/no-img-element -- visor a
          pantalla completa: cada foto tiene un aspect ratio distinto y
          desconocido de antemano, así que necesita su tamaño intrínseco
          real (object-contain + max-h/max-w) — no es la miniatura que
          se repite en la grilla (esas sí van por next/image, abajo).

          Lo que SÍ cambió: el `src` apuntaba al archivo crudo del
          bucket. Se auditó el bucket `ranchos-fotos` y hay 43 archivos
          de más de 1 MB, el mayor de 5702 KB (5712×4284, foto de
          iPhone sin tocar) — o sea que tocar una foto podía disparar
          una descarga de 5.7 MB para verla, como mucho, a 92vw. Ahora
          pasa por el optimizador con un srcset acotado: mismo encuadre
          (no hay `fill`, el tamaño intrínseco lo sigue poniendo la
          imagen), pero AVIF/WebP al ancho que corresponde. */}
      <img
        src={esOptimizable(fotos[abierta]) ? urlVisor(fotos[abierta], 1920) : fotos[abierta]}
        srcSet={
          esOptimizable(fotos[abierta])
            ? [828, 1200, 1920]
                .map((w) => `${urlVisor(fotos[abierta], w)} ${w}w`)
                .join(", ")
            : undefined
        }
        sizes="92vw"
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
  );
}

export default function GaleriaLightbox({
  fotos,
  nombre,
}: {
  fotos: string[];
  nombre: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);

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
            className={`group relative overflow-hidden rounded-2xl bg-aventurea-cream-2 ${
              destacadas.length === 1 ? "aspect-[16/9]" : "aspect-[4/3]"
            }`}
          >
            <Image
              src={url}
              alt={`${nombre} — foto ${i + 1}`}
              fill
              sizes={destacadas.length === 1 ? "100vw" : "(max-width: 640px) 100vw, 50vw"}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
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
              className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-aventurea-cream-2"
            >
              <Image
                src={url}
                alt={`${nombre} — foto ${FOTOS_DESTACADAS + i + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        fotos={fotos}
        nombre={nombre}
        abierta={abierta}
        onCambiar={setAbierta}
        onCerrar={() => setAbierta(null)}
      />
    </>
  );
}
