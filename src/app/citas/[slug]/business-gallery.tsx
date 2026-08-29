"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { IconClock } from "@/components/icons";
import type { FotoGaleria } from "./perfil-tipos";

/**
 * El visor a pantalla completa (navegación, Escape, click afuera, X)
 * ya existe y lo usa el portal de Eventos/Hospedajes —no se reescribe
 * acá esa lógica, solo se reusa. Dinámico porque solo hace falta
 * cuando alguien toca una foto.
 */
const Lightbox = dynamic(
  () => import("@/components/galeria-lightbox").then((m) => m.Lightbox),
  { ssr: false },
);

const SM = 640;
/**
 * Las dos galerías (carrusel de móvil, grid de escritorio) están
 * siempre en el DOM y una se esconde con CSS — el escáner de precarga
 * del navegador no respeta `display:none` y bajaría las dos. El mismo
 * truco que ya usa GaleriaHeroFotos (src/components/galeria-hero.tsx):
 * declarar `3vw` en la rama invisible mete un candidato minúsculo en
 * el srcset y el navegador termina eligiendo ese.
 */
const SIZES_CARRUSEL = `(min-width: ${SM}px) 3vw, 100vw`;
const SIZES_GRANDE = `(max-width: ${SM - 1}px) 3vw, (max-width: 1080px) 55vw, 620px`;
const SIZES_CHICA = `(max-width: ${SM - 1}px) 3vw, (max-width: 1080px) 22vw, 260px`;

/**
 * La galería del perfil: en escritorio, una foto grande a la izquierda
 * y hasta 4 secundarias en grid a la derecha; en móvil, un carrusel
 * deslizable con puntos. Tocar cualquier foto (o "Ver todas las
 * fotos") abre el visor grande. Con 0 o 1 foto degrada con gracia —
 * sin dejar huecos en la grilla ni secciones vacías.
 */
export default function BusinessGallery({
  fotos,
  nombreNegocio,
}: {
  fotos: FotoGaleria[];
  nombreNegocio: string;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [visible, setVisible] = useState(0);

  // El carrusel recorre TODAS las fotos del negocio, y el navegador las
  // bajaba todas al abrir la ficha aunque nadie deslizara (un riel
  // horizontal cae dentro del margen de carga diferida de Chrome, así
  // que ni `loading="lazy"` salva). Mismo remedio que GaleriaHeroFotos
  // (src/components/galeria-hero.tsx): pintar de una solo las primeras
  // y materializar el resto cuando la persona toca el riel. A
  // diferencia del hero NO se activa en el `load` de la ventana: allá
  // son 5 fotos recortadas, acá pueden ser 20 — sin interacción no se
  // piden.
  const [restoListo, setRestoListo] = useState(false);

  if (fotos.length === 0) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-3xl border border-aventurea-line bg-aventurea-blue-light text-aventurea-navy">
        <IconClock className="h-14 w-14" />
      </div>
    );
  }

  const [grande, ...resto] = fotos;
  const chicas = resto.slice(0, 4);
  const ocultas = fotos.length - 1 - chicas.length;
  const urls = fotos.map((f) => f.url);

  return (
    <div>
      {/* ---------- Móvil: carrusel con scroll-snap ---------- */}
      <div className="relative overflow-hidden rounded-2xl sm:hidden">
        <div
          // `pointerdown` dispara ANTES de que el dedo empiece a mover:
          // las fotos que faltan arrancan a bajar mientras dura el
          // primer deslizamiento, y la 2 ya está pintada — no se ven
          // huecos.
          onPointerDown={() => setRestoListo(true)}
          onScroll={(e) => {
            // Red de seguridad para scroll sin puntero (teclado, foco).
            setRestoListo(true);
            const el = e.currentTarget;
            setVisible(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {fotos.map((foto, i) => {
            // La 0 es el LCP y la 1 va precargada para que el primer
            // deslizamiento nunca muestre el fondo pelado; el resto
            // espera la interacción. El <button> conserva su tamaño
            // (aspect + bg), así que materializar no mueve el riel.
            const mostrar = i < 2 || restoListo;
            return (
              <button
                key={foto.url + i}
                type="button"
                onClick={() => setAbierta(i)}
                aria-label={`Ver la foto ${i + 1} de ${nombreNegocio} en grande`}
                className="relative aspect-[16/11] w-full shrink-0 snap-center bg-aventurea-blue-light"
              >
                {mostrar && (
                  <Image
                    src={foto.url}
                    alt={foto.alt || `${nombreNegocio} — foto ${i + 1}`}
                    fill
                    // La primera es el LCP en móvil. `eager` + `high` (no
                    // `priority`) para no duplicar el <link preload> con
                    // la foto grande del grid de escritorio, que también
                    // vive en el DOM aunque esté oculta.
                    loading={i === 0 ? "eager" : undefined}
                    fetchPriority={i === 0 ? "high" : undefined}
                    sizes={SIZES_CARRUSEL}
                    className="object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Píldora oscura debajo de los puntos: sobre una foto clara el
            punto activo (blanco) daba 1,00:1 y el carrusel se quedaba sin
            indicador. Mismo remedio que en galeria-hero. */}
        {fotos.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/55 px-2 py-1.5">
            {fotos.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === visible ? "w-4 bg-white" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- Escritorio: 1 grande + hasta 4 chicas ---------- */}
      {chicas.length === 0 ? (
        <button
          type="button"
          onClick={() => setAbierta(0)}
          aria-label={`Ver la foto de ${nombreNegocio} en grande`}
          className="group relative hidden aspect-[16/10] w-full overflow-hidden rounded-3xl sm:block"
        >
          <Image
            src={grande.url}
            alt={grande.alt || nombreNegocio}
            fill
            loading="eager"
            fetchPriority="high"
            sizes={SIZES_GRANDE}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </button>
      ) : (
        <div className="relative hidden gap-2 overflow-hidden rounded-3xl sm:grid sm:grid-cols-4 sm:grid-rows-2">
          <button
            type="button"
            onClick={() => setAbierta(0)}
            aria-label={`Ver la foto principal de ${nombreNegocio} en grande`}
            className="group relative col-span-2 row-span-2 overflow-hidden"
          >
            <Image
              src={grande.url}
              alt={grande.alt || nombreNegocio}
              fill
              loading="eager"
              fetchPriority="high"
              sizes={SIZES_GRANDE}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </button>
          {chicas.map((foto, i) => {
            const esUltima = i === chicas.length - 1 && ocultas > 0;
            return (
              <button
                key={foto.url + i}
                type="button"
                onClick={() => setAbierta(i + 1)}
                aria-label={`Ver la foto ${i + 2} de ${nombreNegocio} en grande`}
                className="group relative aspect-square overflow-hidden"
              >
                <Image
                  src={foto.url}
                  alt={foto.alt || `${nombreNegocio} — foto ${i + 2}`}
                  fill
                  sizes={SIZES_CHICA}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                {esUltima && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[14px] font-extrabold text-white">
                    +{ocultas} fotos
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {fotos.length > 1 && (
        <button
          type="button"
          onClick={() => setAbierta(0)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-aventurea-line bg-white py-2.5 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy hover:text-aventurea-navy sm:w-fit sm:px-5"
        >
          Ver todas las fotos ({fotos.length})
        </button>
      )}

      {abierta !== null && (
        <Lightbox
          fotos={urls}
          nombre={nombreNegocio}
          abierta={abierta}
          onCambiar={setAbierta}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}
