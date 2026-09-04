import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import NavLealtad from "@/app/lealtad/nav-lealtad";
import BurbujaContacto from "@/app/lealtad/burbuja-contacto";
import FaqAcordeon from "@/app/lealtad/faq-acordeon";
import {
  IconArrastrar,
  IconChair,
  IconClipboard,
  IconCloche,
  IconEdit,
  IconEnlace,
  IconMovil,
  IconPaleta,
  IconStar,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import MockupsHero from "./mockups-hero";
import { CLASES_FUENTES } from "./fuentes";

/**
 * /solutions — LOS PRODUCTOS DE BOOKEA PARA NEGOCIOS.
 *
 * Pedido del dueño (3-4 sep 2026): una landing con mockups que venda
 * los tres productos, «más interactiva, más funcional, más informativa»,
 * y que las secciones aparezcan con animación al bajar.
 *
 * ── LO QUE ESTA PÁGINA ES ──────────────────────────────────────────
 * La vitrina: cuenta los tres productos y manda a cada uno a su lugar.
 *
 *   · Linktree → /s/<slug>, la página de un negocio de Solutions.
 *   · Menú     → /s/<slug>/menu, con pedidos por el QR de mesa.
 *   · Lealtad  → /lealtad (su landing madura).
 *
 * SOLUTIONS ES UN PRODUCTO APARTE (dueño, 3 sep 2026: «de cero, nada
 * depende de ranchos.detalles ni ranchos-fotos»): tablas solutions_*,
 * bucket propio, alta propia en /solutions/crear. Comparte con Bookea
 * solo la cuenta.
 *
 * ── EL REVELADO AL BAJAR ───────────────────────────────────────────
 * `data-reveal` + el `RevealOnScroll` del sitio — UN SOLO
 * IntersectionObserver para toda la página, que es la regla del repo
 * (nunca crear otro). El escalonado va por `--reveal-delay`: índice ×
 * 60 ms, TOPADO en 320 ms. Sin ese tope, la novena tarjeta espera casi
 * un segundo y eso se lee como lentitud, no como estilo.
 *
 * ⚠️ El contenido NACE VISIBLE: la clase `por-revelar` la agrega el
 * observador, no el HTML. Si el JS no corre se pierde la animación y
 * nunca el contenido (ver el comentario largo de globals.css sobre el
 * LCP que esto costó una vez).
 *
 * ── ESTÁTICA A PROPÓSITO ───────────────────────────────────────────
 * Sin `cookies()` ni sesión en el servidor: se prerenderiza y sale del
 * CDN. El nav resuelve la sesión solo, en el navegador.
 */

export const metadata: Metadata = {
  title: "Bookea Solutions · Tu página, tu carta digital y tu QR",
  description:
    "Creá la página de tu negocio con tu carta digital, pedidos desde la mesa sin comisión y tu tarjeta de lealtad. Un solo QR para todo, 100 % configurable.",
  alternates: { canonical: "/solutions" },
};

const NAVY = "#16295e";
const NAVY_PROFUNDO = "#0a1226";

/** Escalonado del revelado: 60 ms por elemento, con tope (ver arriba). */
const retraso = (i: number) =>
  ({ "--reveal-delay": `${Math.min(i * 60, 320)}ms` }) as React.CSSProperties;

const PRODUCTOS = [
  {
    id: "linktree",
    kicker: "Tu página",
    titulo: "Una página con tu marca, no con la nuestra",
    bajada:
      "Tus puertas en el orden que quieras: la carta, WhatsApp, Instagram, reservas, cómo llegar. Seis temas, dos tipos de botón y tres estilos de borde.",
    puntos: [
      "Hasta doce enlaces, ordenados arrastrando",
      "Se edita escribiendo encima de la página",
      "Un solo QR: bookea.lat/s/tu-negocio",
    ],
    cta: { href: "/solutions/crear", label: "Crear mi página gratis" },
    Icono: IconEnlace,
  },
  {
    id: "menu",
    kicker: "Restaurantes y cafeterías",
    titulo: "Carta digital con pedidos desde la mesa",
    bajada:
      "Tu carta con fotos, secciones y precios, vestida con tu marca. Un QR por mesa: el cliente pide desde su teléfono y la comanda te llega al panel.",
    puntos: [
      "Sin comisión por pedido — el cobro es tuyo",
      "Marcás «agotado hoy» y desaparece del menú",
      "Comandas en vivo: nuevo → preparando → listo",
    ],
    cta: { href: "/solutions/crear", label: "Armar mi carta" },
    Icono: IconCloche,
  },
  {
    id: "lealtad",
    kicker: "Fidelización",
    titulo: "Tarjeta de lealtad en el teléfono",
    bajada:
      "Sellos, puntos o cashback en Apple Wallet y Google Wallet. Sin apps que instalar ni cartones que se pierden.",
    puntos: [
      "Tu logo, tus colores y tu regalía",
      "Se agrega con un QR en el mostrador",
      "Correos automáticos en los hitos",
    ],
    cta: { href: "/lealtad", label: "Ver Bookea Lealtad" },
    Icono: IconStar,
  },
] as const;

const PASOS = [
  {
    n: "01",
    titulo: "Creás tu página",
    detalle:
      "Escribís el nombre y ya tenés tu enlace. Elegís tema, colores y forma mirando cómo queda al lado.",
  },
  {
    n: "02",
    titulo: "Cargás tu carta",
    detalle:
      "Secciones, platos, fotos y precios. Lo que marcás agotado desaparece del menú hasta que vuelva a haber.",
  },
  {
    n: "03",
    titulo: "Imprimís tus QR",
    detalle: "Una hoja con un QR por mesa, lista para recortar. El número de mesa viaja en el enlace.",
  },
  {
    n: "04",
    titulo: "Recibís pedidos",
    detalle:
      "El cliente escanea, arma su pedido y te llega al panel con su mesa. Vos lo movés a preparando y listo.",
  },
] as const;

const INCLUYE = [
  { t: "Seis temas", d: "Noche, claro, crema, bosque, vino o tus propios colores.", Icono: IconPaleta },
  { t: "Editás en vivo", d: "Tocás el texto en la vista del teléfono y lo escribís ahí.", Icono: IconEdit },
  { t: "Arrastrar y soltar", d: "Acomodás tus enlaces arrastrándolos. También con flechas.", Icono: IconArrastrar },
  { t: "QR por mesa", d: "Hasta 99 mesas, cada una con su código, en una hoja imprimible.", Icono: IconChair },
  { t: "Comandas en vivo", d: "El panel se refresca solo mientras la cocina trabaja.", Icono: IconClipboard },
  { t: "Tu equipo", d: "Invitás meseros por correo: ven comandas, no tocan la configuración.", Icono: IconUsers },
  { t: "Sin comisión", d: "El pedido es un comandero, no una pasarela. Cobrás en tu caja.", Icono: IconWallet },
  { t: "Sin apps", d: "Tu cliente escanea y listo. No instala nada.", Icono: IconMovil },
] as const;

const FAQ = [
  {
    pregunta: "¿Necesito varias cuentas?",
    respuesta:
      "No. Con tu cuenta de Bookea creás tu negocio en Solutions y desde su panel manejás la página, la carta y las comandas. La tarjeta de lealtad se arma aparte, en Bookea Lealtad, con la misma cuenta.",
  },
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta:
      "La página de enlaces y la carta digital con pedidos son gratis: creás tu negocio en /solutions/crear y ya tenés bookea.lat/s/tu-negocio. La tarjeta de lealtad tiene sus propios paquetes.",
  },
  {
    pregunta: "¿Los pedidos desde la mesa cobran comisión?",
    respuesta:
      "No, y no es un detalle: es una comanda, no una pasarela. El cliente pide desde el QR y a vos te llega al panel con el número de mesa. El cobro sigue siendo tuyo, en tu caja.",
  },
  {
    pregunta: "¿Puedo usar solo la carta, sin tarjeta de lealtad?",
    respuesta:
      "Sí. Solutions no exige tarjeta: creás el negocio, cargás la carta, imprimís los QR de mesa y listo. La página se arma con lo que tengas prendido.",
  },
  {
    pregunta: "¿Y si no tengo mesas?",
    respuesta:
      "Dejás las mesas en cero y apagás los pedidos. Te queda la página de enlaces con tu carta para mirar — que es lo que usan las cafeterías de mostrador y los negocios de servicios.",
  },
  {
    pregunta: "¿Puedo cambiar el diseño después?",
    respuesta:
      "Cuando quieras y las veces que quieras. El tema, el tipo de botón y los bordes se cambian desde el panel y tu página se actualiza al guardar — el QR que ya imprimiste sigue funcionando igual.",
  },
];

export default function SolutionsPage() {
  return (
    /* Las variables de las seis caras, para que los mockups del héroe
       puedan pintarse con la cara que le toca a cada teléfono. */
    <main className={`min-h-svh bg-white ${CLASES_FUENTES}`}>
      <RevealOnScroll />
      <NavLealtad autoOcultar />
      <BurbujaContacto />

      {/* ══ 1 · HERO ══════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 78% 30%, rgba(15,76,158,.10), transparent 34%)," +
            "linear-gradient(180deg,#ffffff 0%,#fbfcff 100%)",
        }}
      >
        <div className="relative mx-auto grid w-[min(1220px,92vw)] items-center gap-10 pb-14 pt-12 sm:pt-16 lg:grid-cols-[44%_56%] lg:gap-6 lg:pb-20">
          <div className="text-center lg:text-left">
            <p
              className="inline-flex items-center gap-2 rounded-full border border-[#dbe3f4] bg-white/75 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
              style={{ color: "var(--accion)" }}
            >
              Para restaurantes, cafeterías y servicios
            </p>
            <h1 className="titulo mt-5 max-w-[15ch] text-balance text-[clamp(34px,4.8vw,56px)] leading-[1.03] tracking-tight text-aventurea-navy">
              Tu página, tu carta y tu QR.{" "}
              <span style={{ color: "var(--accion)" }}>Diseñados por vos.</span>
            </h1>
            <p className="mt-5 max-w-[52ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Armá una página de enlaces 100 % configurable con tu carta digital, pedidos desde la
              mesa sin comisión y tu programa de lealtad.{" "}
              <strong className="text-aventurea-navy">Un solo QR para todo.</strong>
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/solutions/crear"
                className="presionable inline-flex min-h-[48px] items-center rounded-xl px-6 text-[15px] font-extrabold text-white"
                style={{ background: NAVY }}
              >
                Crear mi página gratis →
              </Link>
              <a
                href="#como-funciona"
                className="presionable inline-flex min-h-[48px] items-center rounded-xl border border-aventurea-line bg-white px-6 text-[15px] font-bold text-aventurea-navy"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="mt-4 text-[13px] text-aventurea-ink-soft">
              Sin tarjeta. Empezás con el plan Gratis y subís cuando lo necesités.
            </p>
          </div>

          {/* Los teléfonos con su selector de tema. Es lo único de esta
              página que necesita estado, así que es el único cliente. */}
          <MockupsHero />
        </div>
      </section>

      {/* ══ 2 · LOS TRES PRODUCTOS ════════════════════════════════ */}
      <section id="productos" className="mx-auto w-[min(1220px,92vw)] py-16 lg:py-24">
        <div data-reveal className="mx-auto max-w-[46ch] text-center">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--accion)" }}
          >
            Tres herramientas, una cuenta
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,40px)] leading-tight text-aventurea-navy">
            Todo lo digital de tu negocio, en un lugar
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-aventurea-ink-soft">
            Lo que antes eran tres servicios distintos —y tres facturas— acá es un panel y un QR.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PRODUCTOS.map((p, i) => (
            <article
              key={p.id}
              id={p.id}
              data-reveal
              style={retraso(i)}
              className="elevar flex flex-col rounded-[18px] border border-aventurea-line bg-white p-6 shadow-plano"
            >
              <span
                aria-hidden
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: "var(--accion-suave)", color: "var(--accion)" }}
              >
                <p.Icono className="h-[22px] w-[22px]" />
              </span>
              <p
                className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
                style={{ color: "var(--accion)" }}
              >
                {p.kicker}
              </p>
              <h3 className="titulo mt-1.5 text-[22px] leading-tight text-aventurea-navy">
                {p.titulo}
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">{p.bajada}</p>
              <ul className="mt-4 flex flex-col gap-2 text-[13.5px] text-aventurea-ink">
                {p.puntos.map((punto) => (
                  <li key={punto} className="flex gap-2">
                    <span aria-hidden style={{ color: "var(--accion)" }}>
                      ✓
                    </span>
                    <span>{punto}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.cta.href}
                className="presionable mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 text-[14px] font-extrabold text-white"
                style={{ background: NAVY }}
              >
                {p.cta.label} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ══ 3 · CÓMO FUNCIONA ═════════════════════════════════════ */}
      <section
        id="como-funciona"
        data-reveal
        data-tema="oscuro"
        className="mx-auto w-[min(1220px,92vw)] rounded-[24px] px-6 py-14 text-white sm:px-10 lg:py-20"
        style={{ background: NAVY_PROFUNDO }}
      >
        <div className="mx-auto max-w-[46ch] text-center">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--accion-claro)" }}
          >
            De cero a recibir pedidos
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight">
            Cuatro pasos, una tarde
          </h2>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p, i) => (
            <li
              key={p.n}
              data-reveal
              style={retraso(i)}
              className="rounded-2xl border border-white/12 bg-white/[.06] p-5"
            >
              <span
                className="text-[12px] font-extrabold tracking-[0.14em]"
                style={{ color: "var(--accion-claro)" }}
              >
                {p.n}
              </span>
              <p className="mt-2 text-[17px] font-extrabold leading-tight">{p.titulo}</p>
              <p className="mt-1.5 text-[13.5px] leading-snug text-white/75">{p.detalle}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ══ 4 · QUÉ INCLUYE ═══════════════════════════════════════ */}
      <section className="mx-auto w-[min(1220px,92vw)] py-16 lg:py-24">
        <div data-reveal className="mx-auto max-w-[46ch] text-center">
          <p
            className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "var(--accion)" }}
          >
            Lo que viene incluido
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,40px)] leading-tight text-aventurea-navy">
            Sin plugins, sin plantillas que comprar
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INCLUYE.map((x, i) => (
            <div
              key={x.t}
              data-reveal
              style={retraso(i)}
              className="elevar rounded-2xl border border-aventurea-line bg-white p-5"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-xl"
                style={{ background: "var(--accion-suave)", color: "var(--accion)" }}
              >
                <x.Icono className="h-5 w-5" />
              </span>
              <p className="mt-2.5 text-[15px] font-extrabold text-aventurea-navy">{x.t}</p>
              <p className="mt-1 text-[13px] leading-snug text-aventurea-ink-soft">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ 5 · EL QR ═════════════════════════════════════════════ */}
      <section
        data-reveal
        className="mx-auto w-[min(1220px,92vw)] rounded-[24px] border border-aventurea-line bg-[#f7f9fc] px-6 py-14 sm:px-10"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
              style={{ color: "var(--accion)" }}
            >
              Un solo código
            </p>
            <h2 className="titulo mt-2 text-[clamp(24px,3vw,34px)] leading-tight text-aventurea-navy">
              El cliente escanea una vez y encuentra todo.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-aventurea-ink-soft">
              El QR de la mesa abre{" "}
              <strong className="text-aventurea-navy">bookea.lat/s/tu-negocio</strong>: tu página,
              con tu marca. Desde ahí ve la carta, pide, suma sellos y te escribe. Y como el número
              de mesa viaja en el código, sabés de dónde viene cada pedido{" "}
              <strong className="text-aventurea-navy">sin reimprimir nada</strong>.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Escanea", "El QR de la mesa o del mostrador."],
              ["Elige", "Carta, reservas, WhatsApp — tus puertas."],
              ["Pide", "La comanda llega al panel con su mesa."],
            ].map(([t, d], i) => (
              <li
                key={t}
                data-reveal
                style={retraso(i)}
                className="rounded-2xl border border-aventurea-line bg-white p-4"
              >
                <span
                  className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "var(--accion)" }}
                >
                  0{i + 1}
                </span>
                <p className="mt-1 text-[16px] font-extrabold text-aventurea-navy">{t}</p>
                <p className="mt-1 text-[13px] leading-snug text-aventurea-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══ 6 · FAQ ═══════════════════════════════════════════════ */}
      <section data-reveal className="mx-auto w-[min(880px,92vw)] py-16 lg:py-24">
        <h2 className="titulo text-center text-[clamp(24px,3vw,34px)] text-aventurea-navy">
          Preguntas frecuentes
        </h2>
        <div className="mt-8">
          <FaqAcordeon items={FAQ} />
        </div>
      </section>

      {/* ══ 7 · CIERRE ════════════════════════════════════════════ */}
      <section
        data-reveal
        data-tema="oscuro"
        className="mx-auto mb-16 w-[min(1220px,92vw)] rounded-[24px] px-6 py-14 text-center text-white sm:px-10"
        style={{ background: NAVY }}
      >
        <h2 className="titulo mx-auto max-w-[20ch] text-balance text-[clamp(26px,3.4vw,40px)] leading-tight">
          Tu negocio, en el teléfono de tus clientes, hoy.
        </h2>
        <p className="mx-auto mt-4 max-w-[48ch] text-[15px] text-white/80">
          Se arma en una tarde y no pide tarjeta. Empezá por el nombre.
        </p>
        <Link
          href="/solutions/crear"
          className="presionable mt-7 inline-flex min-h-[48px] items-center rounded-xl bg-white px-6 text-[15px] font-extrabold"
          style={{ color: NAVY }}
        >
          Crear mi página gratis →
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
