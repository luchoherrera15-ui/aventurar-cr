import Image from "next/image";
import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import ReclamarLink from "./reclamar-link";
import CarruselRubros from "./carrusel-rubros";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { MockupPase } from "@/components/solutions/mockup-pantallas";
import { PRESETS } from "@/lib/solutions/temas";
import IconoLinkSVG from "@/components/solutions/icono-link";
import type { IconoLink } from "@/lib/solutions/tipos";
import { IconChartBars, IconGlobe, IconStar, IconWallet } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA LANDING DE LINKSY — linksy.lat, estilo Linktree
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026), con linktr.ee abierto al lado:
 * «letras grandes, cards grandes, minimalista, con colores. El héroe
 * en dos columnas: texto y píldora a la izquierda; a la derecha cards
 * cuadrados con imágenes de fondo —un gimnasio, un lavacar, cosas
 * bonitas— que avanzan solos hacia la derecha. Y lealtad con énfasis:
 * es el valor agregado».
 *
 * ── LA ESTRUCTURA ES LA DE LINKTREE ─────────────────────────────────
 * Bloques de color de borde a borde, uno por sección, cada uno con un
 * titular enorme y una sola idea. La página se lee de lejos. Los
 * colores son la paleta `.linksy` de globals.css, cada uno con su
 * tinta ya medida; acá no hay un hex.
 *
 * ── LOS CARDS DEL HÉROE ─────────────────────────────────────────────
 * Cada card es una FOTO del rubro (Unsplash, mismo host que los seeds
 * de demo y los mockups de Solutions) con la mini página del negocio
 * montada encima, como el teléfono en las fotos de Linktree. La mini
 * página es un dibujo chico a propósito —avatar, nombre, dirección y
 * tres botones— y no `VistaPagina` entero: a ese tamaño el
 * renderizador real se veía como un formulario, y lo que vende acá es
 * la foto. Los íconos de los botones sí son los del producto
 * (`IconoLinkSVG`), para que lo que se ve exista en el editor.
 */

const retraso = (i: number) => ({ "--reveal-delay": `${Math.min(i * 60, 320)}ms` }) as React.CSSProperties;

type Bloque = "lima" | "azul" | "coral" | "lila" | "amarillo" | "menta" | "carbon";
const bloque = (b: Bloque) => ({ background: `var(--linksy-${b})`, color: `var(--linksy-${b}-tinta)` });

// ── Los cards del héroe ─────────────────────────────────────────────

type Tarjeta = {
  rubro: string;
  bloque: Bloque;
  foto: string;
  alt: string;
  nombre: string;
  slug: string;
  links: { icono: IconoLink; etiqueta: string }[];
};

const FOTO = (id: string) => `https://images.unsplash.com/${id}?w=1200&q=75&auto=format&fit=crop`;

const TARJETAS: Tarjeta[] = [
  {
    rubro: "Gimnasios",
    bloque: "lima",
    foto: FOTO("photo-1534438327276-14e5300c3a48"),
    alt: "Sala de pesas de un gimnasio",
    nombre: "Fuerza Norte",
    slug: "fuerzanorte",
    links: [
      { icono: "reservar", etiqueta: "Reservar una clase" },
      { icono: "menu", etiqueta: "Planes y precios" },
      { icono: "whatsapp", etiqueta: "Escribinos" },
    ],
  },
  {
    rubro: "Restaurantes",
    bloque: "coral",
    foto: FOTO("photo-1414235077428-338989a2e8c0"),
    alt: "Mesa servida en un restaurante",
    nombre: "Casa Nostra",
    slug: "casanostra",
    links: [
      { icono: "menu", etiqueta: "Ver el menú" },
      { icono: "reservar", etiqueta: "Reservar mesa" },
      { icono: "tienda", etiqueta: "Pedir para llevar" },
    ],
  },
  {
    rubro: "Lavacar",
    bloque: "azul",
    foto: FOTO("photo-1520340356584-f9917d1eea6f"),
    alt: "Auto recién lavado en un lavacar",
    nombre: "AutoBrillo",
    slug: "autobrillo",
    links: [
      { icono: "menu", etiqueta: "Servicios y precios" },
      { icono: "reservar", etiqueta: "Reservar un turno" },
      { icono: "mapa", etiqueta: "Cómo llegar" },
    ],
  },
  {
    rubro: "Tiendas",
    bloque: "lila",
    foto: FOTO("photo-1441986300917-64674bd600d8"),
    alt: "Perchero de ropa en una boutique",
    nombre: "Nova Studio",
    slug: "novastudio",
    links: [
      { icono: "tienda", etiqueta: "Ver el catálogo" },
      { icono: "instagram", etiqueta: "Nueva colección" },
      { icono: "whatsapp", etiqueta: "Pedir por WhatsApp" },
    ],
  },
  {
    rubro: "Cafés",
    bloque: "amarillo",
    foto: FOTO("photo-1509042239860-f550ce710b93"),
    alt: "Taza de café con arte latte",
    nombre: "Café Aroma",
    slug: "cafearoma",
    links: [
      { icono: "menu", etiqueta: "Ver el menú" },
      { icono: "tienda", etiqueta: "Pedir para recoger" },
      { icono: "instagram", etiqueta: "Instagram" },
    ],
  },
  {
    rubro: "Barberías",
    bloque: "menta",
    foto: FOTO("photo-1503951914875-452162b0f3f1"),
    alt: "Barbero afeitando a un cliente",
    nombre: "Barbería Norte",
    slug: "barberianorte",
    links: [
      { icono: "reservar", etiqueta: "Reservar un turno" },
      { icono: "menu", etiqueta: "Cortes y precios" },
      { icono: "mapa", etiqueta: "Cómo llegar" },
    ],
  },
];

/** Un card del héroe: la foto, el rubro arriba y la mini página abajo. */
function TarjetaRubro({ t, prioridad }: { t: Tarjeta; prioridad: boolean }) {
  return (
    <article
      className="relative aspect-[4/5] w-[min(84vw,400px)] flex-none overflow-hidden shadow-flotante sm:w-[400px]"
      style={{ borderRadius: "var(--linksy-radio)" }}
    >
      <Image
        src={t.foto}
        alt={t.alt}
        fill
        sizes="(min-width: 640px) 400px, 84vw"
        priority={prioridad}
        className="object-cover"
      />
      {/* El velo: garantiza que la mini página y el rótulo se lean sobre
          cualquier foto. Lo pone el diseño, no la foto. */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/0" />

      <span
        className="titulo absolute left-5 top-5 rounded-full px-4 py-2 text-[15px] font-extrabold"
        style={bloque(t.bloque)}
      >
        {t.rubro}
      </span>

      <div
        className="absolute inset-x-5 bottom-5 p-4 shadow-elevado"
        style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)", borderRadius: "var(--linksy-radio-chico)" }}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="titulo grid h-11 w-11 flex-none place-items-center rounded-full text-[18px] font-extrabold"
            style={bloque(t.bloque)}
          >
            {t.nombre[0]}
          </span>
          <div className="min-w-0">
            <p className="titulo truncate text-[17px] font-extrabold leading-tight">{t.nombre}</p>
            <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--linksy-tinta-suave)" }}>
              linksy.lat/{t.slug}
            </p>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {t.links.map((l) => (
            <li
              key={l.etiqueta}
              className="flex items-center gap-2.5 rounded-full border-2 px-4 py-2.5 text-[14px] font-bold"
              style={{ borderColor: "var(--linksy-tinta)" }}
            >
              <IconoLinkSVG icono={l.icono} className="h-4 w-4 flex-none" />
              <span className="truncate">{l.etiqueta}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** El nav de Linktree: la marca a la izquierda, dos píldoras a la derecha. */
function NavLinksy() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
      <nav
        className="mx-auto flex h-[68px] w-[min(1280px,100%)] items-center justify-between rounded-full px-5 shadow-elevado sm:px-7"
        style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}
      >
        <Link href="/linksy" className="titulo text-[26px] font-extrabold tracking-tight" style={{ color: "var(--linksy-tinta)" }}>
          Linksy
        </Link>
        <div className="hidden items-center gap-7 text-[15px] font-bold lg:flex">
          <a href="#lealtad">Lealtad</a>
          <a href="#vender">Vender</a>
          <a href="#dominio">Tu dominio</a>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/linksy/login"
            className="presionable hidden min-h-[44px] items-center rounded-full px-5 text-[15px] font-bold sm:inline-flex"
            style={{ background: "var(--linksy-lila)", color: "var(--linksy-lila-tinta)" }}
          >
            Ingresar
          </Link>
          <Link
            href="/solutions/crear"
            className="presionable inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-extrabold"
            style={{ background: "var(--linksy-carbon)", color: "var(--linksy-carbon-tinta)" }}
          >
            Crear gratis
          </Link>
        </div>
      </nav>
    </header>
  );
}

export default function LandingLinksy() {
  return (
    <main className={`min-h-svh ${CLASES_FUENTES}`} lang="es" style={bloque("lima")}>
      <RevealOnScroll />
      <NavLinksy />

      {/* ══ 1 · HÉROE — texto a la izquierda, cards a la derecha ═ */}
      <section className="px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pb-24" style={bloque("lima")}>
        <div className="mx-auto grid w-[min(1280px,100%)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <h1 className="titulo max-w-[11ch] text-balance text-[clamp(48px,7.5vw,104px)] font-extrabold leading-[0.95] tracking-[-0.03em]">
              Todo tu negocio. Un solo link.
            </h1>
            <p className="mt-7 max-w-[40ch] text-[clamp(18px,2vw,23px)] font-semibold leading-snug">
              Tu WhatsApp, tus redes, tu menú, tus productos y tu tarjeta de lealtad, en una
              página que se ve como vos.
            </p>
            <div className="mt-9">
              <ReclamarLink tono="lima" />
            </div>
          </div>

          {/* Los cards: a la derecha del texto, y pasan solos. En
              teléfono bajan debajo del texto, a todo el ancho. */}
          <div className="min-w-0">
            <CarruselRubros>
              {TARJETAS.map((t, i) => (
                <TarjetaRubro key={t.slug} t={t} prioridad={i === 0} />
              ))}
            </CarruselRubros>
          </div>
        </div>
      </section>

      {/* ══ 2 · LEALTAD — el valor agregado, en azul ═════════════ */}
      <section id="lealtad" className="px-4 py-20 sm:px-6 sm:py-28" style={bloque("azul")}>
        <div className="mx-auto grid w-[min(1280px,100%)] items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div data-reveal>
            <p className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.12em]" style={bloque("lima")}>
              <IconStar className="h-4 w-4" /> Solo en Linksy
            </p>
            <h2 className="titulo mt-6 max-w-[14ch] text-balance text-[clamp(40px,6vw,84px)] font-extrabold leading-[0.98] tracking-[-0.02em]">
              Tu tarjeta de lealtad, en el teléfono de tus clientes.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[clamp(17px,1.9vw,22px)] font-semibold leading-snug">
              Sellos o puntos en Apple Wallet y Google Wallet, con tu logo y tu regalía. Se
              agrega desde tu mismo link, sin descargar nada. Ningún linktree tiene esto.
            </p>
            <ul className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                { Icono: IconWallet, t: "En su Wallet", d: "Como una tarjeta de embarque. No se pierde." },
                { Icono: IconStar, t: "Un QR y listo", d: "Escanean y ya son miembros." },
                { Icono: IconChartBars, t: "Vuelven más", d: "Correos en los hitos, automáticos." },
              ].map((x, i) => (
                <li key={x.t} data-reveal style={{ ...retraso(i), ...bloque("carbon"), borderRadius: "var(--linksy-radio-chico)" }} className="p-5">
                  <x.Icono className="h-7 w-7" />
                  <p className="mt-3 text-[18px] font-extrabold leading-tight">{x.t}</p>
                  <p className="mt-1 text-[14px] font-medium opacity-90">{x.d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal aria-hidden className="mx-auto w-[min(100%,380px)] overflow-hidden shadow-flotante" style={{ borderRadius: "var(--linksy-radio)" }}>
            <div className="h-[560px]">
              <MockupPase tema="crema" acento={PRESETS.crema.acentoSugerido} fuente="condensada" />
            </div>
          </div>
        </div>
      </section>

      {/* ══ 3 · VENDER — lila ════════════════════════════════════ */}
      <section id="vender" className="px-4 py-20 sm:px-6 sm:py-28" style={bloque("lila")}>
        <div className="mx-auto w-[min(1280px,100%)]">
          <h2 className="titulo max-w-[16ch] text-balance text-[clamp(40px,6vw,84px)] font-extrabold leading-[0.98] tracking-[-0.02em]">
            Y cuando quieras vender, se vende desde ahí.
          </h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              { b: "coral" as Bloque, n: "01", t: "Menú o catálogo", d: "Secciones, fotos, precios en tu moneda. Hasta seis idiomas. «Agotado hoy» con un toque." },
              { b: "amarillo" as Bloque, n: "02", t: "Pedidos sin comisión", d: "Carrito con tus precios. Mesa con QR, para recoger o con envío. Te llega por WhatsApp." },
              { b: "menta" as Bloque, n: "03", t: "Tu propio dominio", d: "Empezás con linksy.lat/tu-negocio y, cuando quieras, la misma página responde en tu dominio." },
            ].map((c, i) => (
              <article key={c.t} data-reveal style={{ ...retraso(i), ...bloque(c.b), borderRadius: "var(--linksy-radio)" }} className="flex min-h-[320px] flex-col justify-between p-8">
                <span className="titulo text-[20px] font-extrabold opacity-70">{c.n}</span>
                <div>
                  <h3 className="titulo text-[clamp(28px,3vw,40px)] font-extrabold leading-none tracking-tight">{c.t}</h3>
                  <p className="mt-4 text-[17px] font-semibold leading-snug">{c.d}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4 · DOMINIO Y QR — blanco ════════════════════════════ */}
      <section id="dominio" className="px-4 py-20 sm:px-6 sm:py-28" style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}>
        <div className="mx-auto grid w-[min(1280px,100%)] gap-5 lg:grid-cols-2">
          <div data-reveal style={{ ...bloque("carbon"), borderRadius: "var(--linksy-radio)" }} className="p-8 sm:p-12">
            <IconGlobe className="h-10 w-10" />
            <h2 className="titulo mt-6 text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-tight">Tu dominio, tu página.</h2>
            <p className="mt-5 max-w-[40ch] text-[18px] font-semibold leading-snug opacity-90">
              Te decimos exactamente qué poner en tu DNS. No queda «activo» hasta que visitamos
              tu dominio de verdad y responde: nunca vas a imprimir un QR que no abre.
            </p>
          </div>
          <div data-reveal style={{ ...retraso(1), ...bloque("lima"), borderRadius: "var(--linksy-radio)" }} className="p-8 sm:p-12">
            <IconChartBars className="h-10 w-10" />
            <h2 className="titulo mt-6 text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-tight">Un QR para todo.</h2>
            <p className="mt-5 max-w-[40ch] text-[18px] font-semibold leading-snug">
              En la puerta, en la mesa, en tu tarjeta. Cambiás lo que quieras adentro y el QR
              impreso sigue sirviendo. No se reimprime nada.
            </p>
          </div>
        </div>
      </section>

      {/* ══ 5 · CIERRE — carbón ═════════════════════════════════ */}
      <section className="px-4 py-24 sm:px-6 sm:py-32" style={bloque("carbon")}>
        <div className="mx-auto flex w-[min(1280px,100%)] flex-col items-start gap-9">
          <h2 className="titulo max-w-[12ch] text-balance text-[clamp(44px,8vw,110px)] font-extrabold leading-[0.95] tracking-[-0.03em]">
            Tu link, listo hoy.
          </h2>
          <ReclamarLink tono="carbon" />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
