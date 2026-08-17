"use client";

import { esDemo } from "@/lib/demo";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPause,
  IconPin,
  IconPlay,
} from "./icons";
import { categoriaGradiente, categoriaIcono, categoriaLabel } from "@/lib/categorias-vertical";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";

export type NegocioDestacado = {
  id: string;
  slug: string | null;
  nombre: string;
  fotoUrl: string | null;
  provincia: string | null;
  canton: string | null;
  categoria: string;
  vertical: string;
  /** Para el aviso «Demo»: la marca autoritativa vive acá adentro. */
  detalles?: Record<string, unknown> | null;
};

/** Cuánto se queda quieta cada tarjeta antes de empezar a cambiar. */
const INTERVALO_MS = 4000;
/**
 * El fundido entre una tarjeta y la siguiente, SOLO para el avance
 * automático. Un clic en una flecha cambia de una: quien tocó quiere ver
 * el resultado ya, y así tres clics seguidos avanzan tres negocios en vez
 * de cancelarse entre ellos.
 */
const DURACION_CRUCE_MS = 260;

/**
 * A dónde lleva la tarjeta. La ruta `/{slug}` sirve a Eventos y
 * Hospedajes, pero para Citas y Restaurantes es un 307: `/[slug]`
 * los redirige a su propia sección (ver los `redirect()` de
 * src/app/[slug]/page.tsx). Como el carrusel muestra negocios de
 * TODAS las verticales, mandarlos a `/{slug}` le regalaba un viaje
 * de ida y vuelta extra a cada visita — desde la portada, que es la
 * URL canónica del sitio.
 */
function hrefDeNegocio(n: NegocioDestacado) {
  if (!n.slug) return `/eventos/${n.id}`;
  if (n.vertical === "citas") return `/citas/${n.slug}`;
  if (n.vertical === "restaurantes") return `/restaurantes/${n.slug}`;
  return `/${n.slug}`;
}

/**
 * El carrusel "Súper destacados" de arriba de la portada: hasta 10
 * negocios (migración 0169) que el admin elige a mano desde
 * /admin/ranchos, rotando cada 4 segundos.
 *
 * TRES FORMAS DE FRENARLO, y las tres hacen falta:
 *  · el mouse encima o el foco adentro (pausa mientras dure),
 *  · el botón de pausa (manda sobre todo lo demás) — sin él esto
 *    incumpliría el criterio 2.2.2 de WCAG, que exige poder detener
 *    cualquier cosa que se mueva sola por más de 5 segundos; y el
 *    hover no cuenta como mecanismo en un teléfono, donde no existe,
 *  · `prefers-reduced-motion`, que apaga el avance automático entero
 *    (las flechas siguen andando) — misma convención que el resto del
 *    sitio vía useMovimientoReducido.
 */
export default function CarruselSuperDestacados({
  negocios,
}: {
  negocios: NegocioDestacado[];
}) {
  const total = negocios.length;
  const [activo, setActivo] = useState(0);
  /** Pausa por mouse encima y pausa por foco adentro, POR SEPARADO: con
   *  una sola bandera, sacar el mouse cancelaba la pausa que había pedido
   *  el teclado y el carrusel se movía debajo del foco. */
  const [hoverPausa, setHoverPausa] = useState(false);
  const [focoPausa, setFocoPausa] = useState(false);
  /** Pausa deliberada, la del botón: manda sobre las dos de arriba. */
  const [pausadoAMano, setPausadoAMano] = useState(false);
  const [visible, setVisible] = useState(true);
  const movimientoReducido = useMovimientoReducido();
  const cruceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Si la lista se achica entre renders —el admin sacó negocios del
   * carrusel y la página se revalidó sin desmontar el componente— el
   * índice viejo apuntaría fuera del arreglo y `negocios[activo]`
   * sería `undefined`: leerle `.slug` reventaba la portada entera.
   */
  const indice = activo < total ? activo : 0;

  const limpiarCruce = useCallback(() => {
    if (cruceRef.current) {
      clearTimeout(cruceRef.current);
      cruceRef.current = null;
    }
  }, []);

  /** Flechas y puntos: cambio inmediato, sin fundido. */
  const irManual = useCallback(
    (siguiente: (actual: number) => number) => {
      limpiarCruce();
      setActivo((i) => siguiente(i < total ? i : 0));
      setVisible(true);
    },
    [limpiarCruce, total],
  );

  /** El avance solo: apaga, cambia y vuelve a prender. */
  const avanzarSolo = useCallback(() => {
    setVisible(false);
    cruceRef.current = setTimeout(() => {
      // Se anula el ref apenas termina: así el cleanup de abajo puede
      // distinguir "hay un fundido a medio camino" de "ya terminó".
      cruceRef.current = null;
      setActivo((i) => ((i < total ? i : 0) + 1) % total);
      setVisible(true);
    }, DURACION_CRUCE_MS);
  }, [total]);

  const autoAvanzando =
    total > 1 && !hoverPausa && !focoPausa && !pausadoAMano && !movimientoReducido;

  /**
   * Un timer que se REPROGRAMA en cada cambio de tarjeta, en vez de un
   * `setInterval` suelto. Con el intervalo, tocar una flecha no reiniciaba
   * la cuenta: el avance automático seguía su reloj viejo y se pisaba con
   * el clic, así que el carrusel saltaba DOS negocios de golpe (probado:
   * estando en la tarjeta 2, "siguiente" terminaba en la 1 y no en la 3).
   */
  useEffect(() => {
    if (!autoAvanzando) return;
    const id = setTimeout(avanzarSolo, INTERVALO_MS);
    return () => {
      clearTimeout(id);
      // Si nos frenaron JUSTO durante el fundido (mouse encima, botón de
      // pausa, desmontaje), el cruce quedaría a mitad y la tarjeta se
      // quedaría en opacity-0 para siempre: se cancela y se vuelve a ver.
      if (cruceRef.current) {
        clearTimeout(cruceRef.current);
        cruceRef.current = null;
        setVisible(true);
      }
    };
  }, [indice, autoAvanzando, avanzarSolo]);

  useEffect(() => limpiarCruce, [limpiarCruce]);

  if (total === 0) return null;

  const n = negocios[indice];
  const ubicacion = [n.canton, n.provincia].filter(Boolean).join(", ");
  // Mismo criterio que rancho-card.tsx —literalmente el mismo, ahora
  // compartido en src/lib/demo.ts—: los negocios de muestra se marcan
  // como tales. Si uno llega al carrusel, tiene que decirlo acá arriba
  // igual que lo dice la grilla de abajo. Acá se notaba doble: el
  // carrusel es el héroe de la portada.
  const demo = esDemo(n.slug, n.detalles);

  const botonCls =
    "flex h-9 w-9 items-center justify-center rounded-full bg-aventurea-navy/45 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-aventurea-navy/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <section
      aria-roledescription="carrusel"
      aria-labelledby="titulo-super-destacados"
      className="relative mb-5 overflow-hidden rounded-3xl bg-aventurea-navy shadow-[0_24px_60px_-28px_rgba(6,38,83,0.55)]"
      onMouseEnter={() => setHoverPausa(true)}
      onMouseLeave={() => setHoverPausa(false)}
      onFocus={() => setFocoPausa(true)}
      onBlur={() => setFocoPausa(false)}
    >
      {/* El encabezado de la sección es FIJO. El nombre del negocio va
          como párrafo: si fuera el <h2>, el índice de encabezados de la
          portada cambiaría solo cada 4 segundos. */}
      <h2 id="titulo-super-destacados" className="sr-only">
        Negocios súper destacados
      </h2>

      {/* Mientras avanza solo, el lector de pantalla NO debe anunciar cada
          cambio: sería una interrupción cada 4 segundos. Cuando la persona
          maneja el carrusel a mano, sí — ahí el anuncio es la respuesta a
          lo que acaba de hacer. (Patrón de carrusel de la APG de ARIA.) */}
      <div aria-live={autoAvanzando ? "off" : "polite"} aria-atomic="true">
        <Link
          href={hrefDeNegocio(n)}
          aria-roledescription="tarjeta"
          aria-label={`${n.nombre} — ${indice + 1} de ${total}`}
          className={`relative block h-[280px] transition-opacity duration-300 ease-out motion-reduce:transition-none sm:h-[340px] lg:h-[420px] ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* La `key` es lo que obliga a React a MONTAR un <img> nuevo en
              vez de mutarle el `src` al de antes. Sin ella el navegador
              seguía pintando la foto del negocio anterior hasta que
              terminaba de bajar la nueva — o sea, la foto de un negocio
              debajo del nombre de otro durante uno a tres segundos. */}
          <div
            key={n.id}
            className="absolute inset-0"
            style={
              !n.fotoUrl
                ? { backgroundImage: categoriaGradiente(n.vertical, n.categoria) }
                : undefined
            }
          >
            {n.fotoUrl ? (
              <Image
                src={n.fotoUrl}
                alt={n.nombre}
                fill
                priority={indice === 0}
                // Va detrás de un velo y a tamaño de banner: 60 es la
                // calidad que next.config ya permite para justamente esto.
                quality={60}
                // El ancho REAL: el contenedor es max-w-[1600px] con
                // px-4 (lg:px-6), así que arriba de 1648px queda fijo en
                // 1552. Declarar "1600px" a secas hacía que un teléfono
                // pidiera una imagen mucho más grande que su pantalla.
                sizes="(min-width: 1648px) 1552px, (min-width: 1024px) calc(100vw - 48px), calc(100vw - 32px)"
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-16 [&_svg]:w-16">
                {categoriaIcono(n.vertical, n.categoria)}
              </span>
            )}
          </div>

          {/* El velo arranca recién a media altura: abajo tapa lo justo
              para que el texto blanco se lea sobre CUALQUIER foto, y
              arriba deja la foto limpia — es la foto del negocio lo que
              tiene que lucir, no el azul de la marca. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,38,83,0.93)_0%,rgba(6,38,83,0.62)_28%,rgba(6,38,83,0.12)_58%,transparent_78%)]" />

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 sm:p-8">
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-aventurea-orange px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                ★ Súper destacado
              </span>
              {demo && (
                <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900">
                  Demo
                </span>
              )}
            </span>
            <p className="max-w-[80%] text-2xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgba(6,38,83,0.6)] sm:text-3xl lg:text-4xl">
              {n.nombre}
            </p>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-white/90">
              {ubicacion && (
                <span className="flex items-center gap-1.5">
                  <IconPin className="h-3.5 w-3.5" />
                  {ubicacion}
                </span>
              )}
              <span className="text-white/70">
                {categoriaLabel(n.vertical, n.categoria)}
              </span>
            </span>
          </div>
        </Link>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => irManual((i) => (i - 1 + total) % total)}
            aria-label="Negocio anterior"
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${botonCls}`}
          >
            <IconChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => irManual((i) => (i + 1) % total)}
            aria-label="Siguiente negocio"
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${botonCls}`}
          >
            <IconChevronRight />
          </button>

          <div className="absolute right-5 top-5 flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-full bg-aventurea-navy/45 px-2.5 py-1.5 ring-1 ring-white/25 backdrop-blur">
              {negocios.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => irManual(() => i)}
                  aria-label={`Ver ${item.nombre}`}
                  aria-current={i === indice ? "true" : undefined}
                  className={`h-1.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    i === indice ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>

            {/* Sin movimiento automático no hay nada que pausar: con
                `prefers-reduced-motion` el botón sobra y se esconde. */}
            {!movimientoReducido && (
              <button
                type="button"
                onClick={() => {
                  // "Reanudar" tiene que ganarle a las pausas de cortesía.
                  // Si no, el botón queda inservible: al tocarlo se lleva
                  // el foco (y el mouse está encima), así que el carrusel
                  // seguía pausado por foco/hover y parecía roto.
                  if (pausadoAMano) {
                    setFocoPausa(false);
                    setHoverPausa(false);
                  }
                  setPausadoAMano(!pausadoAMano);
                }}
                aria-label={
                  pausadoAMano ? "Reanudar el carrusel" : "Pausar el carrusel"
                }
                aria-pressed={pausadoAMano}
                className={botonCls}
              >
                {pausadoAMano ? (
                  <IconPlay className="h-4 w-4" />
                ) : (
                  <IconPause className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
