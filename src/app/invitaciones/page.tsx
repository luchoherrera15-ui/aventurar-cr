import type { Metadata } from "next";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { CATALOGO_INVITACIONES } from "@/lib/catalogo-invitaciones";
import {
  albumEnColones,
  ALBUM_ADICIONAL,
  montoEnColones,
  PAQUETES_PRINCIPALES,
  precioPaquete,
} from "@/lib/paquetes-invitaciones";
import CardPaquete from "./card-paquete";
import Reel from "./reel";
import RielEjemplos from "./riel-ejemplos";

/**
 * /invitaciones — la landing de invitaciones digitales, contada como
 * la cuenta Apple: primero QUÉ ES en una frase, después una sola
 * secuencia que lo demuestra sin cortes, y recién ahí los ejemplos, el
 * detalle y el precio.
 *
 * LA LÍNEA DE DISEÑO ES LA NUESTRA, no la de Apple: el oscuro es el
 * navy de la marca (#16295e llevado a #0a1226 para superficies
 * grandes), el acento es el naranja de siempre, y la tipografía es la
 * Figtree del sitio. De Apple se toma la ESTRUCTURA — respirar, una
 * idea por pantalla, tipografía grande y apretada — no la paleta.
 */

// La serif del papel de la invitación. Es la misma que usa el álbum
// (/a/{slug}), así que el producto se ve de una sola familia. Solo
// 400: ni reel.tsx ni riel-ejemplos.tsx le aplican font-bold/semibold
// junto con esta clase, así que 500 y 600 se estaban descargando sin
// que ningún texto de la página los usara.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  // Sin "| Bookea" acá: el layout raíz ya lo agrega con su template
  // ("%s | Bookea") — ponerlo dos veces duplicaba la marca en la
  // pestaña del navegador.
  title: "Invitaciones digitales",
  description:
    "Un link que se abre en cualquier teléfono, tus invitados confirman con un toque y la lista se te arma sola. Diseñada a mano para tu evento.",
};

const NAVY_PROFUNDO = "#0a1226";
const NAVY = "#16295e";

/** Lo que NO es, que es la objeción real de quien nunca vio una. */
const DIFERENCIAS = [
  {
    titulo: "No es una imagen que se reenvía",
    cuerpo:
      "Es una página propia con su dirección. Se abre a pantalla completa, con movimiento, música si querés, y se ve igual de nítida en cualquier teléfono.",
  },
  {
    titulo: "No se llena a mano",
    cuerpo:
      "Cada quien confirma desde su celular y tu lista se actualiza sola. No hay que ir anotando en una libreta lo que llega por WhatsApp.",
  },
  {
    titulo: "No se acaba",
    cuerpo:
      "Mandala las veces que quieras, a cuanta gente quieras. No se imprime, no se pierde, no hay que pedir más.",
  },
  {
    titulo: "No es una plantilla",
    cuerpo:
      "La diseñamos para tu evento, desde una hoja en blanco: tus colores, tu temática, tus nombres. No elegís entre doce moldes.",
  },
];

export default function InvitacionesLanding() {
  const desde = PAQUETES_PRINCIPALES.reduce(
    (min, p) => (p.precioUSD < min.precioUSD ? p : min),
    PAQUETES_PRINCIPALES[0],
  );

  return (
    <main
      className="min-h-svh"
      style={{ background: NAVY_PROFUNDO, color: "#ffffff" }}
    >
      <RevealOnScroll />

      {/* ================= HERO ================= */}
      <section className="relative flex min-h-svh items-center overflow-hidden">
        {/* Un halo naranja detrás, muy bajo: da profundidad sin
            convertirse en un degradado de los que el sitio evita. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[42%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-[120px]"
          style={{ background: "#ee7420" }}
        />

        <div className="relative mx-auto w-[min(1120px,92vw)] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#ee7420]">
            Invitaciones digitales
          </p>
          <h1 className="titulo mx-auto mt-5 max-w-[16ch] text-[clamp(42px,8vw,92px)] leading-[1.02]">
            Tu invitación,
            <br />
            hecha a mano.
          </h1>
          <p className="mx-auto mt-6 max-w-[52ch] text-[clamp(16px,2vw,21px)] leading-relaxed text-white/60">
            Un link que se abre en cualquier teléfono. Tus invitados confirman con un
            toque y la lista se te arma sola.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#paquetes"
              className="rounded-full bg-[#ee7420] px-7 py-3.5 text-[14.5px] font-bold text-white transition-transform hover:scale-[1.03]"
            >
              Ver los paquetes
            </Link>
            <Link
              href="#ejemplos"
              className="rounded-full border border-white/25 px-7 py-3.5 text-[14.5px] font-bold text-white/90 transition-colors hover:border-white/60"
            >
              Ver ejemplos reales
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-white/40">
            Desde ${desde.precioUSD} · {precioPaquete(montoEnColones({
              id: desde.id,
              nombre: desde.nombre,
              precioUSD: desde.precioUSD,
              precioCRC: null,
              etiqueta: desde.precioEtiqueta,
              tienePanel: false,
            }))} aproximadamente
          </p>

          {/* La flecha que invita a bajar: sin esto, media pantalla de
              gente no descubre que abajo pasa algo. */}
          <div
            aria-hidden
            className="mt-14 flex flex-col items-center gap-2 text-white/30"
          >
            <span className="text-[11px] uppercase tracking-[0.2em]">Mirá cómo funciona</span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 animate-bounce" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 5v14m0 0-6-6m6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </section>

      {/* ================= LA SECUENCIA ================= */}
      <Reel claseSerif={cormorant.className} />

      {/* ================= EJEMPLOS REALES ================= */}
      <section id="ejemplos" className="scroll-mt-8 px-5 py-24 sm:px-8">
        <div className="mx-auto w-[min(1120px,92vw)]">
          <div data-reveal className="text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#ee7420]">
              Ejemplos
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Invitaciones que ya están andando.
            </h2>
            <p className="mx-auto mt-4 max-w-[54ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              No son maquetas: son invitaciones de verdad. Tocá cualquiera y se te abre
              como se le abre a un invitado.
            </p>
          </div>

          {/* Un slide grande a la vez, con la barra de progreso abajo —
              el patrón de una página de producto (iPhone 17 Pro): no
              una grilla que se expone toda hacia abajo. Cada slide ES
              una muestra del diseño, con los colores reales de esa
              invitación (catalogo-invitaciones → muestra); todas del
              mismo azul no enseñarían ejemplos, enseñarían una lista. */}
          <div className="mt-12" data-reveal>
            <RielEjemplos demos={CATALOGO_INVITACIONES} claseSerif={cormorant.className} />
          </div>
        </div>
      </section>

      {/* ================= QUÉ NO ES ================= */}
      <section className="relative overflow-hidden px-5 py-24 sm:px-8" style={{ background: NAVY }}>
        {/* Sin esto la sección es un rectángulo azul de punta a punta:
            el halo y los números en naranja le dan el respiro y el
            acento de la marca, que es lo que la separa del resto. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: "#ee7420" }}
        />

        <div className="relative mx-auto w-[min(1120px,92vw)]">
          <div data-reveal className="max-w-[26ch]">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#ee7420]">
              Antes de seguir
            </p>
            <h2 className="titulo mt-4 text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Lo que <span className="text-[#ee7420]">no</span> es.
            </h2>
            <p className="mt-4 text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              La mayoría llega pensando en una imagen bonita para WhatsApp. Es otra cosa.
            </p>
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-11 sm:grid-cols-2">
            {DIFERENCIAS.map((d, i) => (
              <div key={d.titulo} data-reveal>
                <div className="h-[2px] w-12 rounded-full bg-[#ee7420]" />
                <p className="mt-5 text-[12px] font-bold tabular-nums tracking-[0.2em] text-[#ee7420]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-[19px] font-bold leading-snug">{d.titulo}</h3>
                <p className="mt-2.5 max-w-[46ch] text-[14.5px] leading-relaxed text-white/55">
                  {d.cuerpo}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PAQUETES ================= */}
      <section id="paquetes" className="scroll-mt-8 px-5 py-24 sm:px-8">
        <div className="mx-auto w-[min(1120px,92vw)]">
          <div data-reveal className="text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#ee7420]">
              Precios
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Elegí tu invitación.
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Todas se diseñan desde cero para tu evento. Lo que cambia es cuánto la
              afinamos y qué tanto trabaja por vos.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PAQUETES_PRINCIPALES.map((p) => {
              const resuelto = {
                id: p.id,
                nombre: p.nombre,
                precioUSD: p.precioUSD,
                precioCRC: null,
                etiqueta: p.precioEtiqueta,
                tienePanel: p.id !== "basico",
              };
              const soloPaquete = montoEnColones(resuelto);
              return (
                <div key={p.id} data-reveal className="flex">
                  <CardPaquete
                    id={p.id}
                    nombre={p.nombre}
                    badge={p.badge}
                    destacado={p.destacado}
                    lema={p.lema}
                    incluye={p.incluye}
                    precioUSD={p.precioUSD}
                    precioEtiqueta={p.precioEtiqueta}
                    colonesPaquete={precioPaquete(soloPaquete)}
                    colonesConAlbum={precioPaquete(soloPaquete + albumEnColones())}
                    album={{
                      nombre: ALBUM_ADICIONAL.nombre,
                      precioUSD: ALBUM_ADICIONAL.precioUSD,
                      detalle: ALBUM_ADICIONAL.detalle,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= CIERRE ================= */}
      <section className="px-5 py-28 text-center sm:px-8" style={{ background: NAVY }}>
        <div data-reveal className="mx-auto w-[min(760px,92vw)]">
          <h2 className="titulo text-[clamp(32px,5.6vw,64px)] leading-[1.04]">
            Dejá de perseguir invitados por WhatsApp.
          </h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/60">
            Contanos de tu evento y te mandamos una propuesta. Si no te gusta, no pagás
            nada.
          </p>
          <Link
            href="/invitaciones/pedido/intermedio"
            className="mt-9 inline-block rounded-full bg-[#ee7420] px-9 py-4 text-[15px] font-bold text-white transition-transform hover:scale-[1.03]"
          >
            Quiero la mía
          </Link>
        </div>
      </section>
    </main>
  );
}
