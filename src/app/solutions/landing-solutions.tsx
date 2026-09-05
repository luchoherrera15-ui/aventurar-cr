import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import NavSolutions from "./nav-solutions";
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
import Telefono from "@/components/solutions/telefono";
import VistaPagina from "@/components/solutions/vista-pagina";
import { MockupCarta, MockupPase, MockupPedido, MUESTRA_PAGINA } from "@/components/solutions/mockup-pantallas";
import { PRESETS } from "@/lib/solutions/temas";
import { TEXTOS, type IdiomaLanding } from "./textos";

/**
 * /solutions y /solutions/en — LA LANDING DE SOLUTIONS, EN DOS IDIOMAS.
 *
 * Pedido del dueño (3-5 sep 2026): una landing con mockups que venda
 * los productos, «más interactiva, más informativa», con animación al
 * bajar, y «en inglés y en español, también en bookea.lat/soluciones».
 *
 * UN componente y dos diccionarios (`textos.ts`): el JSX no tiene ni
 * una frase suelta. Las tres rutas (/solutions, /solutions/en,
 * /soluciones) montan esto con su idioma; agregar una sección obliga
 * a escribirla en los dos o TypeScript no compila.
 *
 * ── LO QUE ESTA PÁGINA ES ──────────────────────────────────────────
 * La vitrina: cuenta los add-ons y manda a cada uno a su lugar.
 *   · Link hub → /s/<slug>, la página de un negocio de Solutions.
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
 * IntersectionObserver para toda la página (nunca crear otro). El
 * escalonado va por `--reveal-delay`: índice × 60 ms, TOPADO en 320 ms.
 * ⚠️ El contenido NACE VISIBLE: si el JS no corre se pierde la
 * animación y nunca el contenido.
 *
 * ── ESTÁTICA A PROPÓSITO ───────────────────────────────────────────
 * Sin `cookies()` ni sesión en el servidor: se prerenderiza y sale del
 * CDN. El nav resuelve la sesión solo, en el navegador.
 */

const NAVY = "#16295e";
const NAVY_PROFUNDO = "#0a1226";

/** Escalonado del revelado: 60 ms por elemento, con tope (ver arriba). */
const retraso = (i: number) => ({ "--reveal-delay": `${Math.min(i * 60, 320)}ms` }) as React.CSSProperties;

/** Lo que NO cambia con el idioma de cada card: id, ícono, destino y fondo. */
const PRODUCTOS = [
  { id: "linkhub", href: "/solutions/crear", Icono: IconEnlace, fondo: "linear-gradient(135deg, #16295e 0%, #2f4a94 100%)" },
  { id: "menu", href: "/solutions/crear", Icono: IconCloche, fondo: "linear-gradient(135deg, #dfe7f5 0%, #f4f6fb 100%)" },
  { id: "pedidos", href: "/solutions/crear", Icono: IconClipboard, fondo: "linear-gradient(135deg, #0b2447 0%, #1e4d8c 100%)" },
  { id: "lealtad", href: "/lealtad", Icono: IconStar, fondo: "linear-gradient(135deg, #efe4d3 0%, #f6efe4 100%)" },
] as const;

const ICONOS_INCLUYE = [IconPaleta, IconEdit, IconArrastrar, IconChair, IconClipboard, IconUsers, IconWallet, IconMovil];

/**
 * EL HEADER DE CADA CARD: el producto de verdad, en un teléfono. No son
 * imágenes: es el MISMO renderizador que sirve /s/<slug> y las mismas
 * maquetas del héroe, recortados por el header. Derecho y centrado por
 * flex, sin transform: un texto de 11 px girado se veía borroso.
 */
function VisualProducto({ id }: { id: (typeof PRODUCTOS)[number]["id"] }) {
  const ancho = 212;
  if (id === "linkhub") {
    return (
      <Telefono ancho={ancho}>
        <VistaPagina
          inerte
          className="min-h-full"
          datos={{
            ...MUESTRA_PAGINA,
            colorAcento: PRESETS.noche.acentoSugerido,
            tema: "noche",
            estiloLinks: "grilla",
            redondeo: "redondo",
            fuente: "redonda",
            efecto: "vidrio",
            estiloPortada: "card",
          }}
        />
      </Telefono>
    );
  }
  if (id === "menu") {
    return (
      <Telefono ancho={ancho} tinta="#101828">
        <MockupCarta tema="claro" redondeo="suave" acento={PRESETS.claro.acentoSugerido} fuente="editorial" />
      </Telefono>
    );
  }
  if (id === "pedidos") {
    return (
      <Telefono ancho={ancho}>
        <MockupPedido />
      </Telefono>
    );
  }
  return (
    <Telefono ancho={ancho} tinta="#3b2c1c">
      <MockupPase tema="crema" acento={PRESETS.crema.acentoSugerido} fuente="condensada" />
    </Telefono>
  );
}

export default function LandingSolutions({ idioma }: { idioma: IdiomaLanding }) {
  const t = TEXTOS[idioma];
  const crear = "/solutions/crear";

  return (
    <main className={`min-h-svh bg-white ${CLASES_FUENTES}`} lang={idioma}>
      <RevealOnScroll />
      <NavSolutions autoOcultar idioma={idioma} />
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
            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <p
                className="inline-flex items-center gap-2 rounded-full border border-[#dbe3f4] bg-white/75 px-3.5 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em]"
                style={{ color: "var(--accion)" }}
              >
                {t.hero.kicker}
              </p>
              {/* El cambio de idioma vive acá, junto al kicker: es una
                  landing, no una app, y un selector en el nav le
                  quitaría lugar a lo que vende. */}
              <Link
                href={t.otroIdioma.href}
                hrefLang={idioma === "es" ? "en" : "es"}
                className="inline-flex items-center gap-1.5 rounded-full border border-aventurea-line bg-white px-3 py-1.5 text-[11px] font-extrabold text-aventurea-navy"
              >
                {t.otroIdioma.etiqueta}
              </Link>
            </div>
            <h1 className="titulo mt-5 max-w-[15ch] text-balance text-[clamp(34px,4.8vw,56px)] leading-[1.03] tracking-tight text-aventurea-navy">
              {t.hero.titulo} <span style={{ color: "var(--accion)" }}>{t.hero.tituloAcento}</span>
            </h1>
            <p className="mt-5 max-w-[52ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-aventurea-ink-soft">
              {t.hero.bajada} <strong className="text-aventurea-navy">{t.hero.bajadaFuerte}</strong>
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href={crear} className="presionable inline-flex min-h-[48px] items-center rounded-xl px-6 text-[15px] font-extrabold text-white" style={{ background: NAVY }}>
                {t.hero.cta}
              </Link>
              <a href="#como-funciona" className="presionable inline-flex min-h-[48px] items-center rounded-xl border border-aventurea-line bg-white px-6 text-[15px] font-bold text-aventurea-navy">
                {t.hero.ver}
              </a>
            </div>
            <p className="mt-4 text-[13px] text-aventurea-ink-soft">{t.hero.nota}</p>
          </div>

          {/* El teléfono con los diseños de muestra. Es lo único de esta
              página que necesita estado, así que es el único cliente. */}
          <MockupsHero textos={t.looks} carrusel={t.carrusel} />
        </div>
      </section>

      {/* ══ 2 · LOS ADD-ONS ═══════════════════════════════════════ */}
      <section id="productos" className="mx-auto w-[min(1220px,92vw)] py-16 lg:py-24">
        <div data-reveal className="mx-auto max-w-[46ch] text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accion)" }}>
            {t.productos.kicker}
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,40px)] leading-tight text-aventurea-navy">{t.productos.titulo}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-aventurea-ink-soft">{t.productos.bajada}</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTOS.map((p, i) => {
            const tx = t.productos.items[i];
            return (
              /* La card es una columna: header con el producto, cuerpo
                 que crece, y el botón pegado abajo con `mt-auto`: los
                 cuatro botones a la MISMA altura. */
              <article key={p.id} id={p.id} data-reveal style={retraso(i)} className="elevar flex flex-col overflow-hidden rounded-[18px] border border-aventurea-line bg-white shadow-plano">
                <div className="relative h-[236px] overflow-hidden" style={{ background: p.fondo }}>
                  <div aria-hidden className="flex justify-center pt-7">
                    <VisualProducto id={p.id} />
                  </div>
                  <span aria-hidden className="absolute bottom-4 left-5 grid h-12 w-12 place-items-center rounded-2xl bg-white text-aventurea-navy shadow-elevado">
                    <p.Icono className="h-[22px] w-[22px]" />
                  </span>
                  <span className="absolute right-4 top-4 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-aventurea-navy shadow-plano">
                    {tx.precio}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accion)" }}>
                    {tx.kicker}
                  </p>
                  <h3 className="titulo mt-1.5 text-[21px] leading-tight text-aventurea-navy">{tx.titulo}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-aventurea-ink-soft">{tx.bajada}</p>
                  <ul className="mt-4 flex flex-col gap-2 text-[13.5px] text-aventurea-ink">
                    {tx.puntos.map((punto) => (
                      <li key={punto} className="flex gap-2">
                        <span aria-hidden style={{ color: "var(--accion)" }}>✓</span>
                        <span>{punto}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-6">
                    <Link href={p.href} className="presionable flex min-h-[46px] w-full items-center justify-center rounded-xl px-5 text-[14px] font-extrabold text-white" style={{ background: NAVY }}>
                      {tx.cta} →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ══ 3 · CÓMO FUNCIONA ═════════════════════════════════════ */}
      <section id="como-funciona" data-reveal data-tema="oscuro" className="mx-auto w-[min(1220px,92vw)] rounded-[24px] px-6 py-14 text-white sm:px-10 lg:py-20" style={{ background: NAVY_PROFUNDO }}>
        <div className="mx-auto max-w-[46ch] text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accion-claro)" }}>
            {t.pasos.kicker}
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,38px)] leading-tight">{t.pasos.titulo}</h2>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.pasos.items.map((p, i) => (
            <li key={p.titulo} data-reveal style={retraso(i)} className="rounded-2xl border border-white/12 bg-white/[.06] p-5">
              <span className="text-[12px] font-extrabold tracking-[0.14em]" style={{ color: "var(--accion-claro)" }}>
                0{i + 1}
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
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accion)" }}>
            {t.incluye.kicker}
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,40px)] leading-tight text-aventurea-navy">{t.incluye.titulo}</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.incluye.items.map((x, i) => {
            const Icono = ICONOS_INCLUYE[i] ?? IconPaleta;
            return (
              <div key={x.t} data-reveal style={retraso(i)} className="elevar rounded-2xl border border-aventurea-line bg-white p-5">
                <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "var(--accion-suave)", color: "var(--accion)" }}>
                  <Icono className="h-5 w-5" />
                </span>
                <p className="mt-2.5 text-[15px] font-extrabold text-aventurea-navy">{x.t}</p>
                <p className="mt-1 text-[13px] leading-snug text-aventurea-ink-soft">{x.d}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ 5 · EL QR ═════════════════════════════════════════════ */}
      <section data-reveal className="mx-auto w-[min(1220px,92vw)] rounded-[24px] border border-aventurea-line bg-[#f7f9fc] px-6 py-14 sm:px-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--accion)" }}>
              {t.qr.kicker}
            </p>
            <h2 className="titulo mt-2 text-[clamp(24px,3vw,34px)] leading-tight text-aventurea-navy">{t.qr.titulo}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-aventurea-ink-soft">
              {t.qr.p1}
              <strong className="text-aventurea-navy">{t.qr.fuerte1}</strong>
              {t.qr.p2}
              <strong className="text-aventurea-navy">{t.qr.fuerte2}</strong>
              {t.qr.p3}
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {t.qr.pasos.map(([tt, d], i) => (
              <li key={tt} data-reveal style={retraso(i)} className="rounded-2xl border border-aventurea-line bg-white p-4">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--accion)" }}>
                  0{i + 1}
                </span>
                <p className="mt-1 text-[16px] font-extrabold text-aventurea-navy">{tt}</p>
                <p className="mt-1 text-[13px] leading-snug text-aventurea-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══ 6 · FAQ ═══════════════════════════════════════════════ */}
      <section data-reveal className="mx-auto w-[min(880px,92vw)] py-16 lg:py-24">
        <h2 className="titulo text-center text-[clamp(24px,3vw,34px)] text-aventurea-navy">{t.faq.titulo}</h2>
        <div className="mt-8">
          <FaqAcordeon items={t.faq.items} />
        </div>
      </section>

      {/* ══ 7 · CIERRE ════════════════════════════════════════════ */}
      <section data-reveal data-tema="oscuro" className="mx-auto mb-16 w-[min(1220px,92vw)] rounded-[24px] px-6 py-14 text-center text-white sm:px-10" style={{ background: NAVY }}>
        <h2 className="titulo mx-auto max-w-[20ch] text-balance text-[clamp(26px,3.4vw,40px)] leading-tight">{t.cierre.titulo}</h2>
        <p className="mx-auto mt-4 max-w-[48ch] text-[15px] text-white/80">{t.cierre.bajada}</p>
        <Link href={crear} className="presionable mt-7 inline-flex min-h-[48px] items-center rounded-xl bg-white px-6 text-[15px] font-extrabold" style={{ color: NAVY }}>
          {t.cierre.cta}
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
