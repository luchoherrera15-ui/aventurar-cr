import type { Metadata } from "next";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
// Las animaciones de esta landing (reel + riel de ejemplos) viven en su
// propia hoja — así el resto del sitio (home, eventos, citas, el panel
// de negocio...) no las descarga nunca.
import "./reel.css";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { CATALOGO_INVITACIONES } from "@/lib/catalogo-invitaciones";
import {
  PRODUCTOS_INDIVIDUALES,
  tipoCambioUSD,
} from "@/lib/paquetes-invitaciones";
import {
  IconCamera,
  IconMail,
  IconSparkles,
  IconUsers,
} from "@/components/icons";
import PreciosCatalogo from "./precios-catalogo";
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

/**
 * Las cuatro piezas del producto, cada una apuntando a un ejemplo que
 * se abre de verdad. Los slugs están verificados: si se borra una demo
 * de la base, el botón lleva a un 404 — al armar esto, `demo-zoologico`
 * ya estaba en el catálogo pero no en la base.
 */
const PIEZAS_EJEMPLO = [
  {
    titulo: "Invitación Estándar",
    texto: "Una sola pantalla, elegante: cuenta regresiva, cómo llegar y confirmación por WhatsApp.",
    href: "/i/demo-boda-estandar",
    Icono: IconMail,
    tono: "bg-[#ee7420]/15 text-[#ee7420]",
  },
  {
    titulo: "Invitación Premium",
    texto:
      "Un sobre que se abre con música: capítulos, código de vestimenta y confirmación de asistencia.",
    href: "/i/demo-boda-premium",
    Icono: IconSparkles,
    tono: "bg-white/15 text-white",
  },
  {
    titulo: "Confirmaciones",
    texto: "Mirá en tiempo real quién confirmó y cuántos van a tu evento.",
    href: "/invitaciones/ejemplo/confirmaciones",
    Icono: IconUsers,
    tono: "bg-aventurea-sky/25 text-aventurea-sky",
  },
  {
    titulo: "Álbum digital",
    texto: "Las fotos de tus invitados, todas en un solo lugar y con código QR.",
    href: "/a/fotos-ejemplo-cumpleanos-star-wars-de-luis-herrera",
    Icono: IconCamera,
    tono: "bg-aventurea-green/25 text-aventurea-green",
  },
] as const;

export default function InvitacionesLanding() {
  // El "desde ₡X" del hero sale del producto más barato del catálogo —
  // hoy el Save the Date. Se calcula y no se escribe a mano para que
  // no quede desactualizado cuando cambien los precios.
  const desdeUSD = Math.min(...PRODUCTOS_INDIVIDUALES.map((p) => p.precioUSD));
  const desdeColones =
    "₡" + (Math.round((desdeUSD * tipoCambioUSD()) / 100) * 100).toLocaleString("es-CR");

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

        <div className="relative mx-auto w-full max-w-[1120px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#ee7420]">
            Invitaciones digitales
          </p>
          <h1 className="titulo mx-auto mt-5 max-w-[16ch] text-[clamp(42px,8vw,92px)] leading-[1.02]">
            Tu invitación
            <br />
            personalizada.
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
            Desde ${desdeUSD} · {desdeColones} aproximadamente
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
        <div className="mx-auto w-full max-w-[1120px]">
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

          {/* Las cuatro piezas del producto, cada una con su ejemplo
              abierto de verdad: el riel de arriba enseña DISEÑOS, esto
              enseña QUÉ SE LLEVA. Sin esto, el panel de confirmaciones
              y el álbum —lo que más se vende— no se ven en ningún lado
              hasta después de comprar. */}
          <div data-reveal className="mt-20">
            <h3 className="titulo text-center text-[clamp(22px,3vw,32px)]">
              Y esto es lo que se lleva.
            </h3>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PIEZAS_EJEMPLO.map(({ titulo, texto, href, Icono, tono }) => (
                <div
                  key={titulo}
                  className="flex flex-col rounded-2xl bg-white/[0.06] p-6 text-center ring-1 ring-white/10"
                >
                  <span
                    className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${tono}`}
                  >
                    <Icono className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-[17px] font-bold text-white">{titulo}</p>
                  <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-white/50">
                    {texto}
                  </p>
                  <Link
                    href={href}
                    className="mt-5 rounded-full bg-[#ee7420] py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-white transition-transform hover:scale-[1.03]"
                  >
                    Ver ejemplo →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= PAQUETES ================= */}
      <section id="paquetes" className="scroll-mt-8 px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <div data-reveal className="text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#ee7420]">
              Precios
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(30px,5vw,58px)] leading-[1.06]">
              Elegí lo que necesitás.
            </h2>
            <p className="mx-auto mt-4 max-w-[50ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/55">
              Todo se diseña desde cero para tu evento. Llevá una pieza suelta, o el
              pack completo si querés la invitación y el álbum juntos.
            </p>
          </div>

          <div data-reveal>
            <PreciosCatalogo colonesPorUSD={tipoCambioUSD()} />
          </div>
        </div>
      </section>

      {/* ================= CIERRE ================= */}
      <section className="px-5 py-28 text-center sm:px-8" style={{ background: NAVY }}>
        <div data-reveal className="mx-auto w-full max-w-[760px]">
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
