import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import NavLealtad from "@/app/lealtad/nav-lealtad";
import BurbujaContacto from "@/app/lealtad/burbuja-contacto";
import FaqAcordeon from "@/app/lealtad/faq-acordeon";

/**
 * /solutions — LOS PRODUCTOS DE BOOKEA PARA NEGOCIOS, EN UNA PÁGINA.
 *
 * Pedido del dueño (3 sep 2026): «bookea.lat/solutions: una sección
 * que redirecciona a /lealtad, una para crear un linktree con diseños
 * profesionales y minimalistas, y una para crear un menú digital
 * profesional con pedidos desde la mesa».
 *
 * ── LO QUE ESTA PÁGINA ES Y NO ES ──────────────────────────────────
 * Es la VITRINA: cuenta los tres productos y manda a cada uno a su
 * lugar. No es un panel ni un creador — los tres productos ya tienen
 * el suyo y esta página no duplica ninguno:
 *
 *   · Lealtad  → /lealtad (su landing madura).
 *   · Linktree → /s/<slug>, la página de un negocio de Solutions;
 *                las puertas se editan en /solutions/panel.
 *   · Menú     → /s/<slug>/menu, con pedidos por el QR de mesa.
 *
 * SOLUTIONS ES UN PRODUCTO APARTE (dueño, 3 sep 2026: «de cero, nada
 * depende de ranchos.detalles ni ranchos-fotos»): tablas solutions_*,
 * bucket propio, alta propia en /solutions/crear. Comparte con Bookea
 * solo la cuenta. Por eso linktree y menú mandan a /solutions/crear y
 * Lealtad manda a lo suyo.
 *
 * ── ESTÁTICA A PROPÓSITO ───────────────────────────────────────────
 * Sin `cookies()` ni sesión en el servidor: la página se prerenderiza
 * y sale del CDN. El nav resuelve la sesión solo, en el navegador
 * (`useSesionDelNav`), igual que /lealtad. Meter una lectura de
 * cookies acá la volvería dinámica para todo el mundo.
 */

export const metadata: Metadata = {
  title: "Bookea Solutions · Lealtad, linktree y menú digital para tu negocio",
  description:
    "Tres herramientas para tu negocio en una sola cuenta: tarjeta de lealtad en Apple y Google Wallet, tu página de links con tu marca, y un menú digital con pedidos desde la mesa.",
  alternates: { canonical: "/solutions" },
};

const NAVY = "#16295e";
const NAVY_PROFUNDO = "#0a1226";

/**
 * Los tres productos. `href` es a dónde manda el botón de cada uno;
 * `demo` es un ejemplo público real para que se vea antes de crear
 * cuenta — el banco de pruebas de Lealtad, que existe para esto.
 */
const PRODUCTOS = [
  {
    id: "lealtad",
    kicker: "Fidelización",
    titulo: "Tarjeta de lealtad en el teléfono",
    bajada:
      "Sellos, puntos o cashback en Apple Wallet y Google Wallet. Sin apps que instalar ni cartones que se pierden.",
    puntos: [
      "Tu marca: logo, colores y regalía a tu gusto",
      "Se agrega al teléfono con un QR en el mostrador",
      "Correos automáticos en los hitos, no en cada sello",
    ],
    cta: { href: "/lealtad", label: "Ver Bookea Lealtad" },
    icono: "⭐",
  },
  {
    id: "linktree",
    kicker: "Tu página",
    titulo: "Un linktree con tu marca, no con la nuestra",
    bajada:
      "Una página limpia con tus puertas: el menú, la tarjeta, WhatsApp, Instagram, reservas, lo que vos elijas. Con tu logo y tus colores.",
    puntos: [
      "Hasta doce enlaces, en el orden que quieras",
      "Foto de portada, promo del día encendible",
      "Un solo QR para todo: bookea.lat/s/tu-negocio",
    ],
    cta: { href: "/solutions/crear", label: "Crear mi página gratis" },
    icono: "🔗",
  },
  {
    id: "menu",
    kicker: "Restaurantes y cafés",
    titulo: "Menú digital con pedidos desde la mesa",
    bajada:
      "Tu carta con fotos, secciones y precios, vestida con tu marca. Y un QR por mesa: el cliente pide desde su teléfono y la comanda te llega al panel.",
    puntos: [
      "Los platos se editan una vez y salen en todos lados",
      "QR por mesa: sabés de qué mesa viene cada pedido",
      "Comandas en vivo: nuevo → preparando → listo",
    ],
    cta: { href: "/solutions/crear", label: "Armar mi menú" },
    icono: "🍽",
  },
] as const;

const FAQ = [
  {
    pregunta: "¿Necesito varias cuentas?",
    respuesta:
      "No. Con tu cuenta de Bookea creás tu negocio en Solutions y desde su panel manejás la página de links, el menú y las comandas. La tarjeta de lealtad se arma aparte, en Bookea Lealtad, con la misma cuenta.",
  },
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta:
      "La página de links y el menú digital con pedidos son gratis: creás tu negocio en /solutions/crear y ya tenés bookea.lat/s/tu-negocio. La tarjeta de lealtad tiene sus propios paquetes en Bookea Lealtad.",
  },
  {
    pregunta: "¿Los pedidos desde la mesa cobran?",
    respuesta:
      "No. Es una comanda, no una pasarela: el cliente pide desde el QR y a vos te llega al panel con el número de mesa. El cobro sigue siendo tuyo, en tu caja, como siempre.",
  },
  {
    pregunta: "¿Puedo usar solo el menú, sin tarjeta de lealtad?",
    respuesta:
      "Sí. Solutions no exige tarjeta: creás el negocio, cargás la carta, imprimís los QR de mesa y listo. La página se arma con lo que tengas prendido.",
  },
];

export default function SolutionsPage() {
  return (
    <main className="min-h-svh bg-white">
      <RevealOnScroll />
      <NavLealtad autoOcultar />
      <BurbujaContacto />

      {/* ── 1 · HERO ────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 76% 38%, rgba(15,76,158,.10), transparent 32%)," +
            "linear-gradient(180deg,#ffffff 0%,#fbfcff 100%)",
        }}
      >
        <div className="relative mx-auto w-[min(1180px,92vw)] pb-12 pt-12 text-center sm:pt-16 lg:pb-16">
          <p
            className="inline-flex items-center gap-2 rounded-full border border-[#dbe3f4] bg-white/75 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
            style={{ color: "var(--accion)" }}
          >
            Bookea Solutions
          </p>
          <h1 className="titulo mx-auto mt-5 max-w-[18ch] text-balance text-[clamp(36px,5vw,60px)] leading-[1.02] tracking-tight text-aventurea-navy">
            Todo lo que tu negocio necesita en el teléfono de tu cliente.
          </h1>
          <p className="mx-auto mt-5 max-w-[56ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-aventurea-ink-soft">
            Una tarjeta de lealtad, tu página de links y un menú con pedidos desde la mesa.{" "}
            <strong className="text-aventurea-navy">Una sola cuenta, una sola marca: la tuya.</strong>
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/solutions/crear"
              className="presionable inline-flex min-h-[48px] items-center rounded-xl px-6 text-[15px] font-extrabold text-white"
              style={{ background: NAVY }}
            >
              Empezar gratis →
            </Link>
            <a
              href="#productos"
              className="presionable inline-flex min-h-[48px] items-center rounded-xl border border-aventurea-line bg-white px-6 text-[15px] font-bold text-aventurea-navy"
            >
              Ver los tres productos
            </a>
          </div>
        </div>
      </section>

      {/* ── 2 · LOS TRES PRODUCTOS ──────────────────────────────────── */}
      <section id="productos" className="mx-auto w-[min(1180px,92vw)] py-14 lg:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {PRODUCTOS.map((p, i) => (
            <article
              key={p.id}
              id={p.id}
              data-reveal
              style={{ transitionDelay: `${Math.min(i * 60, 320)}ms` }}
              className="flex flex-col rounded-[18px] border border-aventurea-line bg-white p-6 shadow-plano"
            >
              <span
                aria-hidden
                className="grid h-12 w-12 place-items-center rounded-2xl text-[22px]"
                style={{ background: "var(--accion-suave)" }}
              >
                {p.icono}
              </span>
              <p
                className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.16em]"
                style={{ color: "var(--accion)" }}
              >
                {p.kicker}
              </p>
              <h2 className="titulo mt-1.5 text-[22px] leading-tight text-aventurea-navy">
                {p.titulo}
              </h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
                {p.bajada}
              </p>
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

      {/* ── 3 · CÓMO SE CONECTAN ────────────────────────────────────── */}
      <section
        data-reveal
        data-tema="oscuro"
        className="mx-auto w-[min(1180px,92vw)] rounded-[24px] px-6 py-12 text-white sm:px-10 lg:py-16"
        style={{ background: NAVY_PROFUNDO }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
              style={{ color: "var(--accion-claro)" }}
            >
              Un solo QR
            </p>
            <h2 className="titulo mt-2 text-[clamp(26px,3.2vw,38px)] leading-tight">
              El cliente escanea una vez y encuentra todo.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/80">
              El QR de la mesa abre <strong className="text-white">bookea.lat/s/tu-negocio</strong>:
              tu página con tu marca. Desde ahí ve el menú, pide, suma sellos y te escribe. Y
              como el número de mesa viaja en el QR, sabés de dónde viene cada pedido sin
              reimprimir nada.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Escanea", "El QR de la mesa o del mostrador abre tu página."],
              ["Elige", "Menú, tarjeta, WhatsApp, reservas — tus puertas."],
              ["Pide", "La comanda te llega al panel con la mesa."],
            ].map(([t, d], i) => (
              <li
                key={t}
                className="rounded-2xl border border-white/12 bg-white/[.06] p-4"
              >
                <span
                  className="text-[11px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: "var(--accion-claro)" }}
                >
                  0{i + 1}
                </span>
                <p className="mt-1 text-[16px] font-extrabold">{t}</p>
                <p className="mt-1 text-[13px] leading-snug text-white/75">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 4 · FAQ ─────────────────────────────────────────────────── */}
      <section data-reveal className="mx-auto w-[min(880px,92vw)] py-14 lg:py-20">
        <h2 className="titulo text-center text-[clamp(24px,3vw,34px)] text-aventurea-navy">
          Preguntas frecuentes
        </h2>
        <div className="mt-8">
          <FaqAcordeon items={FAQ} />
        </div>
      </section>

      {/* ── 5 · CIERRE ──────────────────────────────────────────────── */}
      <section
        data-reveal
        data-tema="oscuro"
        className="mx-auto mb-16 w-[min(1180px,92vw)] rounded-[24px] px-6 py-12 text-center text-white sm:px-10"
        style={{ background: NAVY }}
      >
        <h2 className="titulo mx-auto max-w-[20ch] text-balance text-[clamp(26px,3.4vw,40px)] leading-tight">
          Tu negocio, en el teléfono de tus clientes, hoy.
        </h2>
        <p className="mx-auto mt-4 max-w-[48ch] text-[15px] text-white/80">
          La primera tarjeta es gratis y trae tu página. Se arma en cinco minutos.
        </p>
        <Link
          href="/solutions/crear"
          className="presionable mt-7 inline-flex min-h-[48px] items-center rounded-xl bg-white px-6 text-[15px] font-extrabold"
          style={{ color: NAVY }}
        >
          Empezar gratis →
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
