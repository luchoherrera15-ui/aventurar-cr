"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";

/**
 * El visor a pantalla completa solo aparece cuando alguien toca una
 * foto. Cargarlo con la página metía su JS en el chunk crítico del
 * portal, que es justo donde se midió la ventana muerta más larga del
 * sitio (la ficha de un negocio se ve a los 2604 ms y no responde
 * hasta los 4323 ms en móvil 4G). Ahora entra al hacer clic.
 */
const Lightbox = dynamic(
  () => import("@/components/galeria-lightbox").then((m) => m.Lightbox),
  { ssr: false },
);

/**
 * Punto de corte `sm` de Tailwind: por debajo se ve el carrusel, por
 * encima la grilla. Los `sizes` de abajo repiten este número a mano
 * porque el navegador elige la foto ANTES de aplicar el CSS.
 */
const SM = 640;

/**
 * Las dos galerías se renderizan siempre y una se esconde con CSS
 * (`sm:hidden` / `hidden sm:grid`) — pero el navegador descarga las
 * fotos de las dos: `display:none` no cancela una descarga que ya
 * eligió el escáner de precarga. Medido en producción: en escritorio
 * se bajaba la foto del carrusel invisible a w=1920 (264 KB) y en
 * móvil la grilla invisible a w=640 (37 KB) más 4 miniaturas.
 *
 * El arreglo es decirle al navegador el tamaño REAL que va a ocupar la
 * foto en cada viewport, incluido el caso en que no ocupa nada. Como
 * next/image arma el srcset a partir de la fracción de `vw` más chica
 * que encuentre, declarar `3vw` para la rama invisible logra dos
 * cosas: mete los anchos chiquitos en el srcset y hace que el
 * navegador elija justamente uno de esos.
 *
 * ¿Por qué 3vw y no 1vw? Con 1vw el filtro de next/image deja entrar
 * el candidato de 16w, y el optimizador de Vercel lo rechaza:
 * `/_next/image?…&w=16` devuelve 400 INVALID_IMAGE_OPTIMIZE_REQUEST
 * (probado contra producción). Con 3vw el candidato más chico pasa a
 * ser 32w, que sí responde.
 *
 * Medido sobre la foto real de rancholastorres (IMG_1067.jpeg,
 * original de 5112 KB en el bucket), por el optimizador de producción:
 *
 *   w=32 → 294 B · w=48 → 532 B · w=96 → 1476 B
 *   w=640 → 37 430 B (la que SÍ se ve en escritorio)
 *   w=1920 → 270 112 B (la que se bajaba de gusto)
 *
 * O sea que en escritorio la galería invisible pasa de 270 KB a 532 B.
 */
const SIZES_CARRUSEL = `(min-width: ${SM}px) 3vw, 100vw`;
const SIZES_GRANDE = `(max-width: ${SM - 1}px) 3vw, (max-width: 1080px) 50vw, 540px`;
/**
 * 270px, no 135px. El número viejo salía de dividir el ancho de la
 * foto grande (540) entre las 4 columnas — pero la grande NO es la
 * grilla: ocupa 2 de las 4 columnas. La grilla entera mide 1080, así
 * que una columna son 270.
 *
 * Ese factor de 2 se veía: medido en producción con Playwright a
 * DPR 2, las cuatro miniaturas ocupan 250 px de CSS (500 px físicos) y
 * recibían la variante de 384 px — 0.77 del tamaño al que se dibujan.
 * El navegador las estiraba, y de ahí venía el aspecto lavado de la
 * galería contra la misma foto vista en grande. Pasa en TODA página de
 * negocio, no en una sola.
 *
 * Con 270 el candidato elegido pasa a ser el de 640 (1.28×, ya nítido)
 * y cuesta 12 KB más por miniatura en pantallas Retina; en las de
 * densidad 1 el salto es de 256 a 384 px, unos 3 KB.
 */
const SIZES_CHICA = `(max-width: ${SM - 1}px) 3vw, (max-width: 1080px) 25vw, 270px`;

/**
 * La galería es LO PRIMERO que se mira de un negocio y contra lo que
 * se lo compara con Airbnb o Booking, así que estas fotos —y solo
 * estas— van por encima del 75 que usa el resto del sitio.
 *
 * Medido contra el optimizador de producción sobre la foto real de
 * rancholastorres (5712 px, 4992 KB en el bucket), en AVIF:
 *
 *   w=640  → q60 12.8 KB · q75 20.5 KB · q82 ~27 KB
 *   w=1080 → q60 32.2 KB · q75 51.9 KB · q82 ~68 KB
 *
 * O sea 16 KB más en la foto principal. Es la única imagen grande de
 * la vista y es el LCP: se paga barato y se nota, que es exactamente
 * lo contrario de subir la calidad en todas las imágenes del sitio.
 */
const CALIDAD_GALERIA = 82;

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

  // Las 4 fotos que siguen en el carrusel viven fuera de pantalla pero
  // el navegador las bajaba igual (un riel horizontal cae dentro del
  // margen de carga diferida de Chrome): ~493 KB en móvil ANTES de que
  // nadie deslizara, robándole ancho de banda a la única foto que sí
  // se ve — que por eso tardaba 4785 ms en llegar en 4G lento. Ahora
  // entran cuando la persona toca el riel o cuando la página terminó
  // de cargar, lo que pase primero.
  const [restoListo, setRestoListo] = useState(false);
  useEffect(() => {
    if (restoListo) return;
    const activar = () => setRestoListo(true);
    // En una navegación de cliente la página ya está "complete" y el
    // evento `load` no vuelve a dispararse nunca: ahí se agenda para
    // el turno siguiente.
    if (document.readyState === "complete") {
      const t = window.setTimeout(activar, 0);
      return () => window.clearTimeout(t);
    }
    window.addEventListener("load", activar, { once: true });
    return () => window.removeEventListener("load", activar);
  }, [restoListo]);

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
          onPointerDown={() => setRestoListo(true)}
          onScroll={(e) => {
            setRestoListo(true);
            const el = e.currentTarget;
            setVisible(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {previa.map((foto, i) => {
            const esUltima = i === previa.length - 1 && ocultasMovil > 0;
            // La primera se pinta siempre (es el LCP de la página en
            // móvil); las demás esperan a `restoListo`. El <button>
            // sigue ahí con su tamaño, así que el riel no se mueve ni
            // un pixel cuando entran (CLS medido: 0.000).
            const mostrar = i === 0 || restoListo;
            return (
              <button
                key={foto + i}
                type="button"
                onClick={() => setAbierta(i)}
                aria-label={`Ver la foto ${i + 1} de ${nombre} en grande`}
                className="relative aspect-[16/11] w-full shrink-0 snap-center bg-aventurea-cream-2"
              >
                {mostrar && (
                  <Image
                    src={foto}
                    alt={`${nombre} — foto ${i + 1}`}
                    fill
                    // `eager` + `high` en vez de `preload`: los docs de
                    // Next 16 lo piden explícitamente cuando el LCP
                    // cambia según el viewport, que es justo este caso
                    // (acá el carrusel, abajo la grilla). Antes las dos
                    // llevaban `priority`, o sea DOS <link preload> en
                    // el <head>, y un preload se descarga aunque el
                    // elemento esté en display:none.
                    loading={i === 0 ? "eager" : undefined}
                    fetchPriority={i === 0 ? "high" : undefined}
                    sizes={SIZES_CARRUSEL}
                    quality={CALIDAD_GALERIA}
                    className="object-cover"
                  />
                )}
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
          className="group relative col-span-2 row-span-2 overflow-hidden"
        >
          <Image
            src={grande}
            alt={nombre}
            fill
            // Ídem el carrusel: sin <link preload>, pero eager y con
            // prioridad alta — es el LCP medido en escritorio.
            loading="eager"
            fetchPriority="high"
            sizes={SIZES_GRANDE}
            quality={CALIDAD_GALERIA}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
              <Image
                src={foto}
                alt={`${nombre} — foto ${i + 2}`}
                fill
                sizes={SIZES_CHICA}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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

      {abierta !== null && (
        <Lightbox
          fotos={fotos}
          nombre={nombre}
          abierta={abierta}
          onCambiar={setAbierta}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}
