import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import ReclamarLink from "./reclamar-link";
import VitrinaEscenas, { type Bloque, type Escena } from "./vitrina-escenas";
import NavLinksy, { type SesionNavLinksy } from "./menu-productos";
import MockupsVivos from "./mockups-vivos";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { MockupPase } from "@/components/solutions/mockup-pantallas";
import Telefono from "@/components/solutions/telefono";
import { PRESETS, TEMAS } from "@/lib/solutions/temas";
import { IconChartBars, IconGlobe, IconInstagram, IconStar, IconWallet } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA LANDING DE LINKSY — linksy.lat, estilo Linktree
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6–7 sep 2026), con linktr.ee abierto al lado:
 * «letras grandes, cards grandes, minimalista, con colores. El héroe
 * en dos columnas: texto y píldora a la izquierda; a la derecha las
 * escenas del producto con una buena transición. Lealtad con énfasis.
 * Y el menú superior como el de ellos, con nuestros productos».
 *
 * ── LA ESTRUCTURA ES LA DE LINKTREE ─────────────────────────────────
 * Bloques de color de borde a borde, uno por sección, cada uno con un
 * titular enorme y una sola idea. Los colores son la paleta `.linksy`
 * de globals.css, cada uno con su tinta medida; acá no hay un hex.
 *
 * Las secciones tienen `id` porque el menú «Productos» (menu-productos.tsx)
 * apunta a ellas: #lealtad, #vender, #instagram, #disenos, #dominio.
 * Si se renombra una, el menú se rompe en silencio: buscar el id ahí.
 *
 * ── LOS LINKS AL MUNDO CON SESIÓN SON ABSOLUTOS ─────────────────────
 * «Ingresar», «Crear gratis» y el reclamo del link van a bookea.lat con
 * `urlBookea`: el alta y el panel viven allá. El proxy además redirige
 * allá cualquier ruta de ese mundo pedida en linksy.lat.
 */

const retraso = (i: number) => ({ "--reveal-delay": `${Math.min(i * 60, 320)}ms` }) as React.CSSProperties;
const bloque = (b: Bloque) => ({ background: `var(--linksy-${b})`, color: `var(--linksy-${b}-tinta)` });

/**
 * Las tres escenas viven en Cloudflare Images (7 sep 2026): los PNG
 * originales de 1536×1024 subidos tal cual con `scripts/subir-escenas-linksy.mjs`
 * (ids fijos `linksy-hero-*`); la variante `gallery` los sirve a tamaño
 * completo, en WebP/AVIF según el navegador. Antes eran WebP de 1400 px
 * muy comprimidos en /public, y se veían «sin HD».
 */
const ESCENAS: Escena[] = [
  {
    src: "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-gimnasio/gallery",
    alt: "Entrenadora junto a un teléfono con su página de Linksy: planes, nutrición, comunidad",
    rubro: "Gimnasios y coaches",
    marca: "shaep",
    bloque: "lima",
  },
  {
    src: "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-restaurante/gallery",
    alt: "Plato de un restaurante y un teléfono con su página de Linksy: menú, reservas, lealtad",
    rubro: "Restaurantes",
    marca: "Sabores",
    bloque: "coral",
  },
  {
    src: "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-lavacar/gallery",
    alt: "Auto recién lavado y un teléfono con la página de Linksy del lavacar: servicios y citas",
    rubro: "Lavacar y detailing",
    marca: "Auto Spa",
    bloque: "azul",
  },
];

/** Los 13 temas reales del editor, para la sección «Diseños». */
const DISENOS = TEMAS.map((t) => PRESETS[t]);

export default function LandingLinksy({ sesion }: { sesion?: SesionNavLinksy }) {
  return (
    <main className={`min-h-svh ${CLASES_FUENTES}`} lang="es" style={bloque("celeste")}>
      <RevealOnScroll />
      <NavLinksy sesion={sesion} />

      {/* ══ 1 · HÉROE — celeste, texto a la izquierda, las escenas a la derecha ═ */}
      <section className="px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pb-24" style={bloque("celeste")}>
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
              <ReclamarLink tono="celeste" />
            </div>
          </div>
          <div className="min-w-0">
            <VitrinaEscenas escenas={ESCENAS} />
          </div>
        </div>
      </section>

      {/* ══ 1b · CREÁ Y PERSONALIZÁ — carbón, el teléfono del que se salen las piezas ═ */}
      <section id="crear" className="overflow-hidden px-4 py-20 sm:px-6 sm:py-28" style={bloque("carbon")}>
        <div className="mx-auto grid w-[min(1280px,100%)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 order-2 lg:order-1">
            <MockupsVivos />
          </div>
          <div className="order-1 lg:order-2" data-reveal>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--linksy-lima)" }}>
              En minutos
            </p>
            <h2 className="titulo mt-4 max-w-[13ch] text-balance text-[clamp(40px,6vw,84px)] font-extrabold leading-[0.98] tracking-[-0.02em]" style={{ color: "var(--linksy-lima)" }}>
              Creá y personalizá tu Linksy en minutos.
            </h2>
            <p className="mt-6 max-w-[46ch] text-[clamp(17px,1.9vw,22px)] font-semibold leading-snug">
              Conectá todo tu contenido —redes, WhatsApp, menú, tienda y tarjeta de lealtad— en un solo link. Personalizá
              cada detalle, o subí tu foto y dejá que Linksy tome sus colores y arme el tema por vos.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href={"/solutions/crear"} className="presionable inline-flex min-h-[54px] items-center rounded-full px-8 text-[16px] font-extrabold" style={bloque("lima")}>
                Empezar gratis
              </a>
              <a href="#disenos" className="inline-flex min-h-[54px] items-center px-2 text-[16px] font-bold underline underline-offset-4 opacity-90 hover:opacity-100">
                Ver los diseños ↓
              </a>
            </div>
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
            <a href={"/lealtad/planes"} className="presionable mt-8 inline-flex min-h-[50px] items-center rounded-full px-7 text-[15px] font-extrabold" style={bloque("lima")}>
              Ver los planes de lealtad →
            </a>
          </div>
          {/* El pase, en el teléfono. La luz de atrás lo despega del
              azul: sin ella el aparato oscuro se hunde en el fondo. */}
          <div data-reveal aria-hidden className="relative mx-auto flex w-full items-center justify-center py-4">
            <span
              className="pointer-events-none absolute h-[320px] w-[320px] rounded-full blur-[80px]"
              style={{ background: "var(--linksy-lima)", opacity: 0.32 }}
            />
            <span
              className="pointer-events-none absolute bottom-2 h-6 w-[62%] rounded-[50%] blur-xl"
              style={{ background: "rgba(4,10,30,.55)" }}
            />
            <Telefono ancho={292} className="relative">
              <MockupPase tema="crema" acento={PRESETS.crema.acentoSugerido} fuente="condensada" />
            </Telefono>
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
              { b: "menta" as Bloque, n: "03", t: "Vitrina en tu página", d: "Tus productos con foto y precio adentro del link, como la tienda de Linktree." },
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

      {/* ══ 4 · INSTAGRAM AUTO REPLY — lima ═════════════════════ */}
      <section id="instagram" className="px-4 py-20 sm:px-6 sm:py-28" style={bloque("lima")}>
        <div className="mx-auto grid w-[min(1280px,100%)] items-center gap-12 lg:grid-cols-[1fr_1fr]">
          <div data-reveal>
            <p className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold uppercase tracking-[0.12em]" style={bloque("carbon")}>
              <IconInstagram className="h-4 w-4" /> Instagram Auto Reply
            </p>
            <h2 className="titulo mt-6 max-w-[14ch] text-balance text-[clamp(40px,6vw,84px)] font-extrabold leading-[0.98] tracking-[-0.02em]">
              Comentan «precio». Reciben tu link por DM.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[clamp(17px,1.9vw,22px)] font-semibold leading-snug">
              Elegís una publicación y una palabra clave. Cada comentario con esa palabra recibe tu
              mensaje privado con el enlace, al instante, y si querés una respuesta pública debajo.
              Con la API oficial de Instagram: sin contraseñas ni trucos.
            </p>
            <ul className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                { t: "Palabra clave", d: "«precio», «info», «menú»… sin importar mayúsculas ni acentos." },
                { t: "DM automático", d: "Tu texto y tu enlace, uno por comentario, en segundos." },
                { t: "Estadísticas", d: "Comentarios, DMs enviados, tasa de respuesta." },
              ].map((x, i) => (
                <li key={x.t} data-reveal style={{ ...retraso(i), ...bloque("carbon"), borderRadius: "var(--linksy-radio-chico)" }} className="p-5">
                  <p className="text-[18px] font-extrabold leading-tight">{x.t}</p>
                  <p className="mt-1 text-[14px] font-medium opacity-90">{x.d}</p>
                </li>
              ))}
            </ul>
            <a href={"/solutions/panel"} className="presionable mt-8 inline-flex min-h-[50px] items-center rounded-full px-7 text-[15px] font-extrabold" style={bloque("carbon")}>
              Activarlo en mi panel →
            </a>
          </div>
          {/* La conversación, dibujada: un comentario y la respuesta. */}
          <div data-reveal aria-hidden className="mx-auto flex w-[min(100%,440px)] flex-col gap-3 p-6 shadow-flotante" style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)", borderRadius: "var(--linksy-radio)" }}>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--linksy-tinta-suave)" }}>Comentarios</p>
            <div className="rounded-2xl px-4 py-3 text-[15px] font-bold" style={{ background: "var(--linksy-celeste)", color: "var(--linksy-celeste-tinta)" }}>
              <span style={{ color: "var(--linksy-tinta-suave)" }}>@ana.cliente</span> ¿Cuál es el PRECIO? 👀
            </div>
            <div className="ml-8 rounded-2xl px-4 py-3 text-[15px] font-bold" style={{ background: "var(--linksy-lila)", color: "var(--linksy-lila-tinta)" }}>
              <span style={{ color: "var(--linksy-tinta-suave)" }}>@cafearoma</span> ¡Te escribimos por DM! 👋
            </div>
            <p className="mt-2 text-[12px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--linksy-tinta-suave)" }}>Mensaje privado</p>
            <div className="rounded-2xl px-4 py-3 text-[15px] font-bold" style={bloque("carbon")}>
              ¡Hola! 👋 Gracias por comentar. Acá tenés los precios:
              <br />
              <span className="underline underline-offset-2">linksy.lat/cafearoma</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 5 · DISEÑOS — los 13 temas reales, amarillo ══════════ */}
      <section id="disenos" className="px-4 py-20 sm:px-6 sm:py-28" style={bloque("amarillo")}>
        <div className="mx-auto w-[min(1280px,100%)]">
          <h2 className="titulo max-w-[16ch] text-balance text-[clamp(40px,6vw,84px)] font-extrabold leading-[0.98] tracking-[-0.02em]">
            Trece temas, seis fuentes, y tus dos colores.
          </h2>
          <p className="mt-6 max-w-[44ch] text-[clamp(17px,1.9vw,22px)] font-semibold leading-snug">
            Elegís uno, lo afinás con animaciones, fondos y forma de los botones, y lo ves cambiar mientras
            lo tocás. La vista previa es tu página de verdad.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {DISENOS.map((d, i) => (
              <li
                key={d.id}
                data-reveal
                style={{
                  ...retraso(i),
                  background: d.fondo ?? "linear-gradient(135deg, var(--linksy-celeste), var(--linksy-lila))",
                  color: d.tinta ?? "var(--linksy-tinta)",
                  borderRadius: "var(--linksy-radio-chico)",
                }}
                className="flex min-h-[112px] flex-col justify-between p-4 shadow-plano"
              >
                <span aria-hidden className="h-5 w-5 rounded-full" style={{ background: d.acentoSugerido }} />
                <div>
                  <p className="titulo text-[17px] font-extrabold leading-none">{d.nombre}</p>
                  <p className="mt-1 text-[12px] font-semibold opacity-80">{d.pie}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ 6 · DOMINIO Y QR — blanco ════════════════════════════ */}
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
          <div data-reveal style={{ ...retraso(1), ...bloque("menta"), borderRadius: "var(--linksy-radio)" }} className="p-8 sm:p-12">
            <IconChartBars className="h-10 w-10" />
            <h2 className="titulo mt-6 text-[clamp(32px,4vw,56px)] font-extrabold leading-none tracking-tight">Un QR para todo.</h2>
            <p className="mt-5 max-w-[40ch] text-[18px] font-semibold leading-snug">
              En la puerta, en la mesa, en tu tarjeta. Cambiás lo que quieras adentro y el QR
              impreso sigue sirviendo. No se reimprime nada.
            </p>
          </div>
        </div>
      </section>

      {/* ══ 7 · CIERRE — carbón ═════════════════════════════════ */}
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
