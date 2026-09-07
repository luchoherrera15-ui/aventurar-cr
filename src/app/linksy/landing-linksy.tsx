import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import ReclamarLink from "./reclamar-link";
import VitrinaEscenas, { type Bloque, type Escena } from "./vitrina-escenas";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { MockupPase } from "@/components/solutions/mockup-pantallas";
import { PRESETS } from "@/lib/solutions/temas";
import { urlBookea } from "@/lib/solutions/dominios";
import { IconChartBars, IconGlobe, IconStar, IconWallet } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA LANDING DE LINKSY — linksy.lat, estilo Linktree
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6–7 sep 2026), con linktr.ee abierto al lado:
 * «letras grandes, cards grandes, minimalista, con colores. El héroe
 * en dos columnas: texto y píldora a la izquierda; a la derecha las
 * escenas del producto —un gimnasio, un restaurante, un lavacar— con
 * una buena transición. Y lealtad con énfasis: es el valor agregado».
 *
 * ── LA ESTRUCTURA ES LA DE LINKTREE ─────────────────────────────────
 * Bloques de color de borde a borde, uno por sección, cada uno con un
 * titular enorme y una sola idea. La página se lee de lejos. Los
 * colores son la paleta `.linksy` de globals.css, cada uno con su
 * tinta ya medida; acá no hay un hex.
 *
 * ── LAS ESCENAS DEL HÉROE ───────────────────────────────────────────
 * Tres imágenes hechas para Linksy (referencia/imagenes, optimizadas a
 * WebP en public/linksy) que ya traen el teléfono con la página
 * adentro. `VitrinaEscenas` las funde una en otra; acá solo se declaran.
 *
 * ── LOS LINKS AL MUNDO CON SESIÓN SON ABSOLUTOS ─────────────────────
 * «Ingresar», «Crear gratis» y el reclamo del link van a bookea.lat con
 * `urlBookea`: el alta y el panel viven allá porque la cookie de sesión
 * no cruza entre dominios de apex distinto. Bajo bookea.lat son el
 * mismo origen. El proxy además redirige allá cualquier ruta de ese
 * mundo pedida en linksy.lat (`PREFIJOS_BOOKEA`) — dos cinturones.
 */

const retraso = (i: number) => ({ "--reveal-delay": `${Math.min(i * 60, 320)}ms` }) as React.CSSProperties;
const bloque = (b: Bloque) => ({ background: `var(--linksy-${b})`, color: `var(--linksy-${b}-tinta)` });

const ESCENAS: Escena[] = [
  {
    src: "/linksy/gimnasio.webp",
    alt: "Entrenadora junto a un teléfono con su página de Linksy: planes, nutrición, comunidad",
    rubro: "Gimnasios y coaches",
    marca: "shaep",
    bloque: "lima",
  },
  {
    src: "/linksy/restaurante.webp",
    alt: "Plato de un restaurante y un teléfono con su página de Linksy: menú, reservas, lealtad",
    rubro: "Restaurantes",
    marca: "Sabores",
    bloque: "coral",
  },
  {
    src: "/linksy/lavacar.webp",
    alt: "Auto recién lavado y un teléfono con la página de Linksy del lavacar: servicios y citas",
    rubro: "Lavacar y detailing",
    marca: "Auto Spa",
    bloque: "azul",
  },
];

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
          <a
            href={urlBookea("/linksy/login")}
            className="presionable hidden min-h-[44px] items-center rounded-full px-5 text-[15px] font-bold sm:inline-flex"
            style={{ background: "var(--linksy-lila)", color: "var(--linksy-lila-tinta)" }}
          >
            Ingresar
          </a>
          <a
            href={urlBookea("/solutions/crear")}
            className="presionable inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-extrabold"
            style={{ background: "var(--linksy-carbon)", color: "var(--linksy-carbon-tinta)" }}
          >
            Crear gratis
          </a>
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

      {/* ══ 1 · HÉROE — texto a la izquierda, las escenas a la derecha ═ */}
      <section className="px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pb-24" style={bloque("lima")}>
        <div className="mx-auto grid w-[min(1280px,100%)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
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

          <div className="min-w-0">
            <VitrinaEscenas escenas={ESCENAS} />
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
