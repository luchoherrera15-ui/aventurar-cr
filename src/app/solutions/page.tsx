import type { Metadata } from "next";
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
import {
  MockupCarta,
  MockupPase,
  MockupPedidoWhatsapp,
  MUESTRA_PAGINA,
} from "@/components/solutions/mockup-pantallas";
import { PRESETS } from "@/lib/solutions/temas";

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
  title: "Bookea Solutions · Tu página, tu menú digital y tu QR",
  description:
    "Creá la página de tu negocio con tu menú digital, pedidos desde la mesa sin comisión y tu tarjeta de lealtad. Un solo QR para todo, 100 % configurable.",
  alternates: { canonical: "/solutions" },
};

const NAVY = "#16295e";
const NAVY_PROFUNDO = "#0a1226";

/** Escalonado del revelado: 60 ms por elemento, con tope (ver arriba). */
const retraso = (i: number) =>
  ({ "--reveal-delay": `${Math.min(i * 60, 320)}ms` }) as React.CSSProperties;

/**
 * LOS PRODUCTOS SON ADD-ONS (dueño, 4 sep 2026): una cuenta, un
 * negocio, y lo que se agrega por separado. El link hub es lo
 * incluido; el resto tiene su precio — hoy ₡0 mientras dure la
 * prueba, pero el lugar del precio ya existe para que cuando cambie
 * se vea acá, antes de crear la cuenta.
 */
const PRODUCTOS = [
  {
    id: "linkhub",
    kicker: "Incluido",
    precio: "Gratis",
    titulo: "Tu link hub: una página con tu marca",
    bajada:
      "Tus puertas en el orden que quieras: el menú, WhatsApp, Instagram, reservas, cómo llegar. Seis temas, seis fuentes, cinco efectos y foto de fondo por botón.",
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
    kicker: "Add-on",
    precio: "₡0 en prueba",
    titulo: "Menú digital",
    bajada:
      "Secciones, platos, fotos y precios, vestidos con tu marca. Se abre desde tu página y desde el QR.",
    puntos: [
      "Marcás «agotado hoy» y desaparece del menú",
      "Fotos por plato, precios en colones",
      "Lo prendés desde tu panel cuando lo necesités",
    ],
    cta: { href: "/solutions/crear", label: "Empezar con mi página" },
    Icono: IconCloche,
  },
  {
    id: "pedidos",
    kicker: "Add-on",
    precio: "₡0 en prueba",
    titulo: "Pedidos: mesa, para llevar y exprés",
    bajada:
      "Un QR por mesa y la comanda te llega al panel. Para llevar o exprés, el cliente arma su pedido y te llega ordenado por WhatsApp.",
    puntos: [
      "Sin comisión por pedido — el cobro es tuyo",
      "Comandas en vivo: nuevo → preparando → listo",
      "Nombre, teléfono, dirección y forma de pago, siempre en el mismo orden",
    ],
    cta: { href: "/solutions/crear", label: "Empezar con mi página" },
    Icono: IconClipboard,
  },
  {
    id: "lealtad",
    kicker: "Add-on",
    precio: "Con Bookea Lealtad",
    titulo: "Tarjeta de lealtad en el teléfono",
    bajada:
      "Sellos, puntos o cashback en Apple Wallet y Google Wallet. Se arma con la misma cuenta y aparece como una puerta más en tu página.",
    puntos: [
      "Tu logo, tus colores y tu regalía",
      "Se agrega con un QR en el mostrador",
      "Correos automáticos en los hitos",
    ],
    cta: { href: "/lealtad", label: "Ver Bookea Lealtad" },
    Icono: IconStar,
  },
] as const;

/**
 * EL HEADER DE CADA CARD: el producto de verdad, en un teléfono.
 *
 * Pedido del dueño (4 sep 2026): «cards de lujo, profesionales, con
 * imágenes en el header, uno de cada cosa». No son imágenes: es el
 * MISMO renderizador que sirve /s/<slug> y las mismas maquetas del
 * héroe, recortados por el header. Así la card muestra lo que el
 * negocio va a tener —no una foto de stock de otro producto— y cambia
 * sola cuando el producto cambia.
 *
 * Cada una con un vestido distinto a propósito: cuatro teléfonos
 * iguales con distinto contenido se leen como una sola cosa; cuatro
 * con tema, cara y acabado propios se leen como cuatro productos.
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
        <MockupPedidoWhatsapp />
      </Telefono>
    );
  }
  return (
    <Telefono ancho={ancho} tinta="#3b2c1c">
      <MockupPase tema="crema" acento={PRESETS.crema.acentoSugerido} fuente="condensada" />
    </Telefono>
  );
}

/** El fondo del header de cada card: azules de la marca, y el crema
 *  del pase para la tarjeta. Cero naranja, como en todo el panel. */
const FONDO_HEADER: Record<(typeof PRODUCTOS)[number]["id"], string> = {
  linkhub: "linear-gradient(135deg, #16295e 0%, #2f4a94 100%)",
  menu: "linear-gradient(135deg, #dfe7f5 0%, #f4f6fb 100%)",
  pedidos: "linear-gradient(135deg, #0b2447 0%, #1e4d8c 100%)",
  lealtad: "linear-gradient(135deg, #efe4d3 0%, #f6efe4 100%)",
};

const PASOS = [
  {
    n: "01",
    titulo: "Creás tu página",
    detalle:
      "Escribís el nombre y ya tenés tu enlace. Elegís tema, colores y forma mirando cómo queda al lado.",
  },
  {
    n: "02",
    titulo: "Cargás tu menú",
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
      "No. Una sola cuenta de Bookea. Con ella creás tu negocio en Solutions y te queda tu link hub gratis; el menú digital, los pedidos y la tarjeta de lealtad son add-ons que agregás desde el panel cuando los necesités — con esa misma cuenta.",
  },
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta:
      "El link hub es gratis, siempre. Los add-ons se venden por separado y, mientras dure la prueba, están en ₡0: los prendés desde Inicio y los apagás cuando quieras. Cuando tengan precio lo vas a ver ahí mismo, antes de activarlos.",
  },
  {
    pregunta: "¿Cómo funciona el pedido por WhatsApp?",
    respuesta:
      "El cliente abre tu menú, va sumando —un combo, unas papas, un refresco—, elige para llevar o exprés, llena nombre, teléfono, cédula, dirección y cómo paga, y toca enviar. Se abre WhatsApp con el pedido ya escrito y ordenado; solo lo manda. Vos lo ves en el chat y en «Comandas», con el mismo código.",
  },
  {
    pregunta: "¿Los pedidos cobran comisión?",
    respuesta:
      "No, y no es un detalle: es una comanda, no una pasarela. Desde la mesa te llega al panel; para llevar o exprés te llega por WhatsApp. El cobro sigue siendo tuyo, en tu caja o como lo coordinés con el cliente.",
  },
  {
    pregunta: "¿Puedo usar solo el link hub?",
    respuesta:
      "Sí. Es lo que usan las cafeterías de mostrador y los negocios de servicios: tu página con tus enlaces y tu QR, sin menú ni pedidos. Los add-ons se agregan después, si hacen falta.",
  },
  {
    pregunta: "¿Puedo cambiar el diseño después?",
    respuesta:
      "Cuando quieras y las veces que quieras. Tema, fuente, efectos, portada y bordes se cambian desde el panel y tu página se actualiza al guardar — el QR que ya imprimiste sigue funcionando igual.",
  },
];

export default function SolutionsPage() {
  return (
    /* Las variables de las seis caras, para que los mockups del héroe
       puedan pintarse con la cara que le toca a cada teléfono. */
    <main className={`min-h-svh bg-white ${CLASES_FUENTES}`}>
      <RevealOnScroll />
      <NavSolutions autoOcultar />
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
              Tu página, tu menú y tu QR.{" "}
              <span style={{ color: "var(--accion)" }}>Diseñados por vos.</span>
            </h1>
            <p className="mt-5 max-w-[52ch] text-[clamp(15px,1.7vw,18px)] leading-relaxed text-aventurea-ink-soft">
              Armá una página de enlaces 100 % configurable con tu menú digital, pedidos desde la
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
            Una cuenta, tus add-ons
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,40px)] leading-tight text-aventurea-navy">
            Empezás gratis y agregás lo que necesités
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-aventurea-ink-soft">
            Creás tu cuenta, tenés tu link hub, y desde el panel sumás el menú, los pedidos o la tarjeta cuando te hagan falta. Un panel, un QR, una factura.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTOS.map((p, i) => (
            /* La card es una columna: header con el producto, cuerpo que
               crece, y el botón pegado abajo con `mt-auto`. Es lo que
               deja los cuatro botones a la MISMA altura aunque una card
               tenga tres puntos y otra cuatro — antes cada botón caía
               donde terminaba su texto. */
            <article
              key={p.id}
              id={p.id}
              data-reveal
              style={retraso(i)}
              className="elevar flex flex-col overflow-hidden rounded-[18px] border border-aventurea-line bg-white shadow-plano"
            >
              <div className="relative h-[236px] overflow-hidden" style={{ background: FONDO_HEADER[p.id] }}>
                {/* El teléfono asoma desde abajo, DERECHO y centrado por
                    flex, sin transform. Acá hubo un `rotate(-4deg)` con
                    `translateX(-50%)` y las cuatro cards se veían
                    borrosas (dueño, 5 sep 2026): un texto de 11 px
                    girado se re-muestrea en cada píxel y pierde el
                    hinting, y el corrimiento del 50 % lo dejaba en medio
                    píxel. Sin transform, el texto se pinta alineado a la
                    grilla de píxeles y sale nítido. La inclinación se
                    veía bien de lejos, pero de cerca costaba la nitidez
                    de lo único que hay que poder leer. */}
                <div aria-hidden className="flex justify-center pt-7">
                  <VisualProducto id={p.id} />
                </div>
                {/* El «logo» del producto, sobre el header, como una
                    marca sobre su portada. */}
                <span
                  aria-hidden
                  className="absolute bottom-4 left-5 grid h-12 w-12 place-items-center rounded-2xl bg-white text-aventurea-navy shadow-elevado"
                >
                  <p.Icono className="h-[22px] w-[22px]" />
                </span>
                <span className="absolute right-4 top-4 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-aventurea-navy shadow-plano">
                  {p.precio}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <p
                  className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
                  style={{ color: "var(--accion)" }}
                >
                  {p.kicker}
                </p>
                <h3 className="titulo mt-1.5 text-[21px] leading-tight text-aventurea-navy">
                  {p.titulo}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-aventurea-ink-soft">{p.bajada}</p>
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
                {/* `mt-auto` en el envoltorio y no en el botón: el
                    envoltorio absorbe el aire sobrante y el `pt-6` deja
                    la separación mínima con la lista. */}
                <div className="mt-auto pt-6">
                  <Link
                    href={p.cta.href}
                    className="presionable flex min-h-[46px] w-full items-center justify-center rounded-xl px-5 text-[14px] font-extrabold text-white"
                    style={{ background: NAVY }}
                  >
                    {p.cta.label} →
                  </Link>
                </div>
              </div>
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
              con tu marca. Desde ahí ve el menú, pide, suma sellos y te escribe. Y como el número
              de mesa viaja en el código, sabés de dónde viene cada pedido{" "}
              <strong className="text-aventurea-navy">sin reimprimir nada</strong>.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Escanea", "El QR de la mesa o del mostrador."],
              ["Elige", "Menú, reservas, WhatsApp — tus puertas."],
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
