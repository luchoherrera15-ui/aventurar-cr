import Link from "next/link";
import RevealOnScroll from "@/components/reveal-on-scroll";
import SiteFooter from "@/components/site-footer";
import ReclamarLink from "./reclamar-link";
import VitrinaEscenas, { type Escena } from "./vitrina-escenas";
import NavLinksy, { type SesionNavLinksy } from "./menu-productos";
import MockupsVivos from "./mockups-vivos";
import { CLASES_FUENTES } from "@/app/solutions/fuentes";
import { MockupPase } from "@/components/solutions/mockup-pantallas";
import Telefono from "@/components/solutions/telefono";
import { PRESETS, TEMAS } from "@/lib/solutions/temas";
import {
  IconChartBars,
  IconCloche,
  IconGlobe,
  IconInstagram,
  IconStar,
  IconWallet,
  IconWhatsapp,
} from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA LANDING DE LINKSY — el sitio web del negocio que no lo tiene
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (22 sep 2026): «enfoquémonos en el problema: tenés un
 * restaurante, una tienda, un local, y necesitás… que la gente pueda
 * crear su sitio web con nosotros. Que no sea tan colorida, sino más
 * neutro y más profesional».
 *
 * ── QUÉ CAMBIÓ, Y POR QUÉ ───────────────────────────────────────────
 * Antes la página vendía una CAPACIDAD («todo tu negocio, un solo
 * link») sobre siete bloques de color saturado. El problema de eso no
 * es el gusto: un dueño de soda no se levanta pensando «necesito un
 * link hub», se levanta con el menú desactualizado en una foto de
 * WhatsApp. Ahora la página nombra ESE problema primero y recién
 * después el producto.
 *
 * El orden es el del cliente, no el nuestro:
 *   1. el problema que ya tiene          (#problema)
 *   2. qué hace falta para resolverlo    (#crear)
 *   3. las piezas, una por una           (#vender, #instagram, #lealtad)
 *   4. cómo se va a ver                  (#disenos)
 *   5. su dirección y su QR              (#dominio)
 *   6. cuánto cuesta                     (#precio)
 *
 * ── EL COLOR LO PONE EL PRODUCTO ────────────────────────────────────
 * Tres superficies neutras (papel, hueso, arena), un negro y UN acento
 * cálido en dosis chicas — los pares están medidos en globals.css. Las
 * únicas manchas de color fuertes son las fotos de las páginas de
 * clientes: si el sitio grita más que ellas, el dueño no se imagina la
 * suya adentro.
 *
 * Los `id` de las secciones los usa el menú «Productos»
 * (menu-productos.tsx). Si se renombra uno, el menú se rompe en
 * silencio: buscarlo ahí antes de tocar.
 */

const retraso = (i: number) => ({ "--reveal-delay": `${Math.min(i * 60, 320)}ms` }) as React.CSSProperties;

/** Las superficies. El par fondo+tinta se decide junto, nunca por separado. */
const SUP = {
  papel: { background: "var(--linksy-papel)", color: "var(--linksy-tinta)" },
  hueso: { background: "var(--linksy-hueso)", color: "var(--linksy-tinta)" },
  arena: { background: "var(--linksy-arena)", color: "var(--linksy-tinta)" },
  carbon: { background: "var(--linksy-carbon)", color: "var(--linksy-carbon-tinta)" },
} as const;

const SECCION = "px-4 py-20 sm:px-6 sm:py-28";
const ANCHO = "mx-auto w-[min(1180px,100%)]";
/** 12 px, la escala de botones de la casa. Antes eran píldoras. */
const BOTON = "presionable inline-flex min-h-[52px] items-center justify-center rounded-xl px-7 text-[15px] font-bold";
const TITULAR = "titulo text-balance text-[clamp(34px,4.6vw,60px)] font-extrabold leading-[1.02] tracking-[-0.025em]";
const BAJADA = "text-[clamp(16px,1.5vw,19px)] leading-relaxed";

/** El rótulo chico de cada sección. Es el único lugar del acento. */
function Rotulo({ children, sobreOscuro = false }: { children: React.ReactNode; sobreOscuro?: boolean }) {
  return (
    <p
      className="text-[12px] font-extrabold uppercase tracking-[0.16em]"
      style={{ color: sobreOscuro ? "var(--linksy-carbon-suave)" : "var(--linksy-acento)" }}
    >
      {children}
    </p>
  );
}

/** Una tarjeta de filete: el ladrillo de toda la página. */
function Tarjeta({
  children,
  indice = 0,
  sobre = "hueso",
  className = "",
}: {
  children: React.ReactNode;
  indice?: number;
  sobre?: "hueso" | "papel" | "arena" | "carbon";
  className?: string;
}) {
  const oscuro = sobre === "carbon";
  return (
    <div
      data-reveal
      style={{
        ...retraso(indice),
        background: oscuro ? "rgba(255,255,255,.04)" : "var(--linksy-papel)",
        borderColor: oscuro ? "rgba(255,255,255,.14)" : sobre === "arena" ? "var(--linksy-linea-arena)" : "var(--linksy-linea)",
        borderRadius: "var(--linksy-radio-chico)",
      }}
      className={`border p-6 ${className}`}
    >
      {children}
    </div>
  );
}

const ESCENAS: Escena[] = [
  {
    src: "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-restaurante/gallery",
    alt: "Plato de un restaurante y un teléfono con su página de Bookea: menú, pedidos y lealtad",
    rubro: "Restaurantes y sodas",
    marca: "Sabores",
    bloque: "carbon",
  },
  {
    src: "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-gimnasio/gallery",
    alt: "Entrenadora junto a un teléfono con su página de Bookea: planes, nutrición y comunidad",
    rubro: "Gimnasios y coaches",
    marca: "shaep",
    bloque: "carbon",
  },
  {
    src: "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-lavacar/gallery",
    alt: "Auto recién lavado y un teléfono con la página de Bookea del lavacar: servicios y citas",
    rubro: "Servicios y talleres",
    marca: "Auto Spa",
    bloque: "carbon",
  },
];

/** El problema, dicho como lo vive el dueño — no como lo nombramos nosotros. */
const PROBLEMAS = [
  {
    t: "El menú viaja como foto",
    d: "Cambiás un precio y hay que volver a fotografiar todo. La gente abre una imagen borrosa, no encuentra lo que busca y pregunta por WhatsApp.",
  },
  {
    t: "Los pedidos se pierden en el chat",
    d: "«¿Era sin cebolla?» «¿Cuál era la dirección?». Entre veinte conversaciones abiertas, un pedido se arma tres veces y a veces se entrega mal.",
  },
  {
    t: "Nadie sabe quién vuelve",
    d: "Tu mejor cliente vino cuatro veces este mes y no tenés cómo saberlo, ni cómo darle una razón para volver la quinta.",
  },
];

const PASOS = [
  { n: "01", t: "Elegí tu dirección", d: "bookea.lat/s/tu-negocio, o tu propio dominio si ya lo tenés. Queda lista en el momento." },
  { n: "02", t: "Armá tu página", d: "Subí tu logo, elegí un diseño y agregá lo que vendés. Sin programar y sin diseñador." },
  { n: "03", t: "Compartila", d: "En tu bio de Instagram, en tu WhatsApp y en el QR de la mesa. Un solo lugar que siempre está al día." },
];

const PIEZAS = [
  { Icono: IconCloche, t: "Menú o catálogo", d: "Secciones, fotos y precios en tu moneda. Cambiás un precio y ya está cambiado en todos lados." },
  { Icono: IconWhatsapp, t: "Pedidos por WhatsApp", d: "Tu cliente arma el plato, elige recoger o envío, y te llega el pedido escrito y completo." },
  { Icono: IconWallet, t: "Tarjeta de lealtad", d: "Sellos o puntos en Apple Wallet y Google Wallet. Se agrega con un QR, sin instalar nada." },
  { Icono: IconInstagram, t: "Instagram automático", d: "Comentan una palabra clave en tu post y reciben tu enlace por DM, al instante." },
  { Icono: IconGlobe, t: "Tu dirección y tu QR", d: "Una dirección corta para la bio y un QR para la mesa, la vitrina o la factura." },
  { Icono: IconChartBars, t: "Quién entra y qué mira", d: "Cuánta gente abre tu página, qué toca y qué pide. Sin planillas." },
];

const DISENOS = TEMAS.map((t) => PRESETS[t]);

export default function LandingLinksy({ sesion }: { sesion?: SesionNavLinksy }) {
  return (
    <main className={`min-h-svh ${CLASES_FUENTES}`} lang="es" style={SUP.hueso}>
      <RevealOnScroll />
      <NavLinksy sesion={sesion} />

      {/* ══ 1 · EL PROBLEMA Y LA PROMESA ═══════════════════════════ */}
      <section className="px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:pb-24" style={SUP.hueso}>
        <div className={`${ANCHO} grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}>
          <div>
            <Rotulo>Para restaurantes, tiendas y locales</Rotulo>
            <h1 className={`${TITULAR} mt-5 max-w-[14ch]`}>
              El sitio web que tu negocio todavía no tiene.
            </h1>
            <p className={`${BAJADA} mt-6 max-w-[46ch]`} style={{ color: "var(--linksy-tinta-suave)" }}>
              Tu menú, tus pedidos por WhatsApp, tu tarjeta de lealtad y tus redes, en una página
              con tu nombre y tu cara. Sin programar, sin diseñador y sin mensualidad para empezar.
            </p>
            <div className="mt-8">
              <ReclamarLink tono="celeste" />
            </div>
          </div>
          <div className="min-w-0">
            <VitrinaEscenas escenas={ESCENAS} />
          </div>
        </div>
      </section>

      {/* ══ 2 · LO QUE PASA HOY ════════════════════════════════════ */}
      <section id="problema" className={SECCION} style={SUP.papel}>
        <div className={ANCHO}>
          <Rotulo>Lo que pasa hoy</Rotulo>
          <h2 className={`${TITULAR} mt-5 max-w-[20ch]`}>
            Tu negocio ya vende. El problema es por dónde.
          </h2>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEMAS.map((x, i) => (
              <li key={x.t} className="min-w-0">
                <Tarjeta indice={i} sobre="papel" className="h-full">
                  <p className="text-[19px] font-extrabold leading-tight">{x.t}</p>
                  <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--linksy-tinta-suave)" }}>
                    {x.d}
                  </p>
                </Tarjeta>
              </li>
            ))}
          </ul>
          <p data-reveal className="mt-10 max-w-[52ch] text-[clamp(18px,2vw,22px)] font-bold leading-snug">
            Las tres cosas se arreglan con lo mismo: una página propia, al día, que trabaje mientras
            vos atendés.
          </p>
        </div>
      </section>

      {/* ══ 3 · CÓMO SE ARMA ═══════════════════════════════════════ */}
      <section id="crear" className={`overflow-hidden ${SECCION}`} style={SUP.hueso}>
        <div className={`${ANCHO} grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
          <div className="order-2 min-w-0 lg:order-1">
            <MockupsVivos />
          </div>
          <div className="order-1 lg:order-2" data-reveal>
            <Rotulo>En cinco minutos</Rotulo>
            <h2 className={`${TITULAR} mt-5 max-w-[16ch]`}>Se arma en una tarde, no en un proyecto.</h2>
            <ol className="mt-10 flex flex-col gap-7">
              {PASOS.map((p, i) => (
                <li key={p.n} data-reveal style={retraso(i)} className="flex gap-4">
                  <span
                    className="shrink-0 text-[13px] font-extrabold tabular-nums"
                    style={{ color: "var(--linksy-acento)" }}
                  >
                    {p.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[18px] font-extrabold leading-tight">{p.t}</span>
                    <span
                      className="mt-1.5 block text-[15px] leading-relaxed"
                      style={{ color: "var(--linksy-tinta-suave)" }}
                    >
                      {p.d}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/solutions/crear" className={`${BOTON} mt-10`} style={SUP.carbon}>
              Crear mi sitio gratis
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 4 · LAS PIEZAS ═════════════════════════════════════════ */}
      <section id="vender" className={SECCION} style={SUP.arena}>
        <div className={ANCHO}>
          <Rotulo>Todo adentro</Rotulo>
          <h2 className={`${TITULAR} mt-5 max-w-[18ch]`}>Una página. Todo lo que tu negocio necesita.</h2>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PIEZAS.map((x, i) => (
              <li key={x.t} className="min-w-0">
                <Tarjeta indice={i} sobre="arena" className="h-full">
                  <span aria-hidden className="block" style={{ color: "var(--linksy-acento)" }}>
                    <x.Icono className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-[18px] font-extrabold leading-tight">{x.t}</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--linksy-tinta-suave)" }}>
                    {x.d}
                  </p>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ 5 · INSTAGRAM ══════════════════════════════════════════ */}
      <section id="instagram" className={SECCION} style={SUP.papel}>
        <div className={`${ANCHO} grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
          <div data-reveal>
            <Rotulo>Instagram</Rotulo>
            <h2 className={`${TITULAR} mt-5 max-w-[16ch]`}>Contestá cada comentario sin estar ahí.</h2>
            <p className={`${BAJADA} mt-6 max-w-[46ch]`} style={{ color: "var(--linksy-tinta-suave)" }}>
              Alguien comenta «MENÚ» en tu publicación y recibe tu enlace por mensaje privado, al
              instante. Con la API oficial de Instagram, no con un robot que te puede cerrar la
              cuenta.
            </p>
            <Link href="/solutions/panel" className={`${BOTON} mt-8`} style={SUP.carbon}>
              Conectar mi Instagram
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              { t: "Vos elegís la palabra", d: "«MENÚ», «PRECIO», «QUIERO». Las que quieras, por publicación." },
              { t: "Responde en segundos", d: "Sin que nadie esté mirando el teléfono." },
              { t: "Una sola vez", d: "El mismo comentario no recibe dos mensajes." },
              { t: "Queda registrado", d: "Ves qué comentario entró y qué se respondió." },
            ].map((x, i) => (
              <li key={x.t} className="min-w-0">
                <Tarjeta indice={i} sobre="papel" className="h-full">
                  <p className="text-[16px] font-extrabold leading-tight">{x.t}</p>
                  <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--linksy-tinta-suave)" }}>
                    {x.d}
                  </p>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ 6 · LEALTAD ════════════════════════════════════════════ */}
      <section id="lealtad" className={SECCION} style={SUP.carbon}>
        <div className={`${ANCHO} grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]`}>
          <div data-reveal>
            <Rotulo sobreOscuro>Solo en Bookea</Rotulo>
            <h2 className={`${TITULAR} mt-5 max-w-[15ch]`}>La tarjeta de sellos, en el teléfono del cliente.</h2>
            <p className={`${BAJADA} mt-6 max-w-[46ch]`} style={{ color: "var(--linksy-carbon-suave)" }}>
              Sellos o puntos en Apple Wallet y Google Wallet, con tu logo y tu premio. Se agrega
              escaneando el QR del mostrador, sin descargar ninguna app. Ningún link hub tiene esto.
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { Icono: IconWallet, t: "En su Wallet", d: "Como una tarjeta de embarque. No se pierde." },
                { Icono: IconStar, t: "Un QR y listo", d: "Escanean y ya son miembros." },
                { Icono: IconChartBars, t: "Vuelven más", d: "Y sabés quiénes son." },
              ].map((x, i) => (
                <li key={x.t} className="min-w-0">
                  <Tarjeta indice={i} sobre="carbon" className="h-full">
                    <x.Icono className="h-5 w-5" />
                    <p className="mt-3 text-[16px] font-extrabold leading-tight">{x.t}</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--linksy-carbon-suave)" }}>
                      {x.d}
                    </p>
                  </Tarjeta>
                </li>
              ))}
            </ul>
            <Link
              href="/lealtad/planes"
              className={`${BOTON} mt-10`}
              style={{ background: "var(--linksy-papel)", color: "var(--linksy-tinta)" }}
            >
              Ver los planes de lealtad
            </Link>
          </div>
          <div data-reveal aria-hidden className="relative mx-auto flex w-full items-center justify-center py-4">
            <span
              className="pointer-events-none absolute h-[320px] w-[320px] rounded-full blur-[90px]"
              style={{ background: "var(--linksy-acento)", opacity: 0.35 }}
            />
            <Telefono ancho={272} className="relative">
              <MockupPase tema="crema" acento={PRESETS.crema.acentoSugerido} fuente="condensada" />
            </Telefono>
          </div>
        </div>
      </section>

      {/* ══ 7 · DISEÑOS ════════════════════════════════════════════ */}
      <section id="disenos" className={SECCION} style={SUP.hueso}>
        <div className={ANCHO}>
          <div className="max-w-[46ch]">
            <Rotulo>Cómo se va a ver</Rotulo>
            <h2 className={`${TITULAR} mt-5`}>Trece temas. Y después, todo tuyo.</h2>
            <p className={`${BAJADA} mt-6`} style={{ color: "var(--linksy-tinta-suave)" }}>
              Elegí un punto de partida y cambiá lo que quieras: colores, tipografía, tamaño,
              esquinas, fondo y cómo se apila cada pieza. Tu página no se tiene que parecer a la de
              nadie.
            </p>
          </div>
          <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {DISENOS.map((d, i) => {
              // «Mi marca» no trae colores propios: toma los del negocio.
              // En la vitrina se enseña con los neutros del sitio.
              const fondo = d.fondo ?? "var(--linksy-arena)";
              const tinta = d.tinta ?? "var(--linksy-tinta)";
              const acento = d.acentoSugerido ?? "var(--linksy-acento)";
              return (
                <li key={d.nombre} data-reveal style={retraso(i)} className="min-w-0">
                <span
                  className="block overflow-hidden border"
                  style={{ borderColor: "var(--linksy-linea)", borderRadius: "var(--linksy-radio-chico)" }}
                >
                  <span className="block h-[104px] w-full" style={{ background: fondo }}>
                    <span className="flex h-full flex-col justify-center gap-1.5 px-3">
                      <span className="block h-2 w-10 rounded-full" style={{ background: acento }} />
                      <span className="block h-1.5 w-full rounded-full" style={{ background: tinta, opacity: 0.22 }} />
                      <span className="block h-1.5 w-2/3 rounded-full" style={{ background: tinta, opacity: 0.16 }} />
                    </span>
                  </span>
                  <span className="block bg-[var(--linksy-papel)] px-3 py-2.5 text-[13px] font-bold">
                    {d.nombre}
                  </span>
                </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ══ 8 · TU DIRECCIÓN ═══════════════════════════════════════ */}
      <section id="dominio" className={SECCION} style={SUP.papel}>
        <div className={`${ANCHO} grid gap-4 lg:grid-cols-2`}>
          <Tarjeta sobre="papel" className="p-8 sm:p-10">
            <Rotulo>Tu dirección</Rotulo>
            <p className="mt-4 text-[clamp(24px,2.6vw,34px)] font-extrabold leading-tight">
              bookea.lat/s/tu-negocio
            </p>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--linksy-tinta-suave)" }}>
              Corta, fácil de dictar por teléfono y lista para la bio de Instagram. ¿Ya tenés tu
              dominio propio? También lo podés usar.
            </p>
          </Tarjeta>
          <Tarjeta indice={1} sobre="papel" className="p-8 sm:p-10">
            <Rotulo>Tu QR</Rotulo>
            <p className="mt-4 text-[clamp(24px,2.6vw,34px)] font-extrabold leading-tight">
              Uno por mesa, si querés
            </p>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--linksy-tinta-suave)" }}>
              Para la mesa, la vitrina, la bolsa o la factura. El mismo QR sirve para el menú, para
              pedir y para sumar el sello.
            </p>
          </Tarjeta>
        </div>
      </section>

      {/* ══ 9 · PRECIO ═════════════════════════════════════════════ */}
      <section id="precio" className={SECCION} style={SUP.arena}>
        <div className={ANCHO}>
          <Rotulo>Cuánto cuesta</Rotulo>
          <h2 className={`${TITULAR} mt-5 max-w-[18ch]`}>Empezá gratis. Pagá cuando te sirva.</h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <Tarjeta sobre="arena" className="p-8 sm:p-10">
              <p className="text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--linksy-tinta-suave)" }}>
                Gratis
              </p>
              <p className="mt-3 text-[40px] font-extrabold leading-none tracking-tight">₡0</p>
              <ul className="mt-6 flex flex-col gap-2.5 text-[15px]">
                {["Tu página con tus enlaces", "Tu dirección y tu QR", "Tres temas con tu color", "Instagram automático"].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden style={{ color: "var(--linksy-acento)" }}>—</span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link href="/solutions/crear" className={`${BOTON} mt-8 w-full`} style={SUP.carbon}>
                Crear mi sitio
              </Link>
            </Tarjeta>
            <Tarjeta indice={1} sobre="arena" className="p-8 sm:p-10">
              <p className="text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--linksy-acento)" }}>
                Pro
              </p>
              <p className="mt-3 text-[40px] font-extrabold leading-none tracking-tight">
                $9<span className="text-[18px] font-bold" style={{ color: "var(--linksy-tinta-suave)" }}> / mes</span>
              </p>
              <ul className="mt-6 flex flex-col gap-2.5 text-[15px]">
                {[
                  "Todo lo de Gratis",
                  "Menú o catálogo con 26 diseños",
                  "Pedidos por WhatsApp",
                  "Tipografía, colores y tamaños a tu gusto",
                  "Tu dominio propio",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden style={{ color: "var(--linksy-acento)" }}>—</span>
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/solutions/crear"
                className={`${BOTON} mt-8 w-full border`}
                style={{ borderColor: "var(--linksy-tinta)", background: "transparent", color: "var(--linksy-tinta)" }}
              >
                Empezar y pasar a Pro
              </Link>
            </Tarjeta>
          </div>
          <p className="mt-6 text-[14px]" style={{ color: "var(--linksy-tinta-suave)" }}>
            La tarjeta de lealtad se cobra aparte, por su propio plan. Sin contratos: se cancela
            cuando quieras.
          </p>
        </div>
      </section>

      {/* ══ 10 · CIERRE ════════════════════════════════════════════ */}
      <section className="px-4 py-24 sm:px-6 sm:py-32" style={SUP.carbon}>
        <div className={`${ANCHO} max-w-[820px] text-center`}>
          <h2 className={`${TITULAR} mx-auto max-w-[16ch]`}>Tu negocio con sitio web, hoy.</h2>
          <p className={`${BAJADA} mx-auto mt-6 max-w-[44ch]`} style={{ color: "var(--linksy-carbon-suave)" }}>
            Elegí tu dirección y empezá. Gratis, sin tarjeta, y la podés cambiar todas las veces que
            quieras.
          </p>
          <div className="mt-10 flex justify-center">
            <ReclamarLink tono="carbon" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
