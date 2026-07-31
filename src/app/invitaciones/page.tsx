import Link from "next/link";
import SiteHeader from "@/components/site-header";
import RevealOnScroll from "@/components/reveal-on-scroll";
import PaquetesInvitaciones from "@/components/paquetes-invitaciones";
import { createClient } from "@/lib/supabase/server";
import {
  CATALOGO_INVITACIONES,
  type DemoInvitacion,
} from "@/lib/catalogo-invitaciones";
import {
  IconBalloon,
  IconBalloons,
  IconChartBars,
  IconCheck,
  IconChevronDown,
  IconClipboard,
  IconGlobe,
  IconHeart,
  IconMail,
  IconSparkles,
  IconStar,
  IconUsers,
  IconWand,
  IconWhatsapp,
} from "@/components/icons";

/** Los íconos de línea del catálogo — formales, nada de emojis. */
const ICONO_DEMO: Record<DemoInvitacion["icono"], React.ReactNode> = {
  corazon: <IconHeart />,
  destellos: <IconSparkles />,
  estrella: <IconStar />,
  globos: <IconBalloons />,
  globo: <IconBalloon />,
};

export const metadata = {
  title: "Invitaciones digitales que enamoran",
  description:
    "Bookea diseña la invitación digital de tu evento: ubicación con un toque, confirmación de invitados en línea y diseño a tu medida.",
};

/** Una entrada del catálogo, venga del archivo o de la base. */
type EntradaCatalogo = DemoInvitacion & { generada?: boolean };

/** Tarjeta de crédito, para el bloque de medios de pago. */
function IconTarjeta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path strokeLinecap="round" d="M2.5 9.5h19M6 15h3.5" />
    </svg>
  );
}

/** Manzana simple para Apple Pay (sin marca registrada). */
function IconApple() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.4 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1-.02 1.8-1 2.5-2.1.8-1.2 1.1-2.3 1.1-2.4-.02-.01-2.1-.8-2.1-3zM14.3 5.6c.6-.7 1-1.7.9-2.6-.8.03-1.9.5-2.5 1.3-.5.6-1 1.6-.9 2.5.9.07 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

/** Lo que incluye la invitación. Las tres primeras se ven de una;
 *  el resto vive detrás del "Ver más". */
const FEATURES: { icono: React.ReactNode; titulo: string; texto: string }[] = [
  {
    icono: <IconMail />,
    titulo: "Invitación digital",
    texto: "Link a pantalla completa, animado y con la ubicación en Maps y Waze.",
  },
  {
    icono: <IconCheck />,
    titulo: "Confirmación en tiempo real",
    texto: "Tus invitados confirman en el link y la lista se actualiza al instante.",
  },
  {
    icono: <IconChartBars />,
    titulo: "Panel administrativo",
    texto: "Quiénes asisten y quiénes no, con el conteo de personas al día.",
  },
  {
    icono: <IconUsers />,
    titulo: "Personalizadas por invitado",
    texto: "Cada persona recibe su invitación con su nombre.",
  },
  {
    icono: <IconClipboard />,
    titulo: "PDF descargable",
    texto: "También en documento, lista para imprimir o guardar de recuerdo.",
  },
  {
    icono: <IconWhatsapp />,
    titulo: "Envíos ilimitados",
    texto: "Compartila por WhatsApp, correo o redes sin límite de invitados.",
  },
  {
    icono: <IconGlobe />,
    titulo: "Diversidad de idiomas",
    texto: "Español, inglés o el idioma que necesités.",
  },
  {
    icono: <IconWand />,
    titulo: "Diseño a tu medida",
    texto: "Tus colores, tus fotos y tu historia — o algo 100% exclusivo.",
  },
];

/** Para que las generadas no salgan todas con el mismo lienzo. */
const LIENZOS_GENERADOS = [
  "bg-[linear-gradient(150deg,#16295e_0%,#3b7fc4_55%,#ee7420_100%)]",
  "bg-[linear-gradient(150deg,#7b2d5e_0%,#c65a86_55%,#f5b98a_100%)]",
  "bg-[linear-gradient(150deg,#1f7a4d_0%,#7bbf6a_55%,#f7c948_100%)]",
] as const;
const ICONOS_GENERADOS: DemoInvitacion["icono"][] = [
  "destellos",
  "estrella",
  "globos",
];

/**
 * Las invitaciones que el creador con IA marcó para el catálogo
 * (en_catalogo + activa). Si la migración 0074 todavía no corrió, la
 * consulta falla y el catálogo se queda solo con las de siempre.
 */
async function catalogoGenerado(): Promise<EntradaCatalogo[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invitaciones")
      .select("slug, titulo, created_at")
      .eq("en_catalogo", true)
      .eq("estado", "activa")
      .order("created_at", { ascending: false })
      .limit(6);
    if (error || !data) return [];

    return data.map((inv, i) => ({
      slug: inv.slug as string,
      nombre: (inv.titulo as string) || "Invitación",
      ocasion: "Hecha con Bookea",
      descripcion: "Invitación generada con el asistente de Bookea.",
      // Un lienzo distinto por fila para que la vitrina no se vea
      // como una tira de cards calcadas.
      lienzo: LIENZOS_GENERADOS[i % LIENZOS_GENERADOS.length],
      icono: ICONOS_GENERADOS[i % ICONOS_GENERADOS.length],
      iconoClase: "text-white/90",
      generada: true,
    }));
  } catch {
    return [];
  }
}

/**
 * La landing de venta de Invitaciones Digitales — el producto que
 * Bookea diseña y entrega llave en mano: el cliente comparte un link
 * y los invitados confirman ahí mismo.
 *
 * Está pensada para leerse de un scroll: hero, qué incluye, tres
 * pasos, ejemplos y paquetes. Lo que solo algunos quieren ver (la
 * escena animada) vive plegado en un <details>.
 */
export default async function InvitacionesLanding() {
  const generadas = await catalogoGenerado();
  // Primero los diseños de la casa (los más pulidos) y después las
  // que hicieron clientes reales, como prueba social.
  const catalogo: EntradaCatalogo[] = [...CATALOGO_INVITACIONES, ...generadas];

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Invitaciones digitales" />
      <RevealOnScroll />

      <section className="mx-auto max-w-[1080px] px-6 py-8 sm:py-10">
        {/* ---------- Hero navy: se ve como la invitación real ---------- */}
        <div
          data-reveal
          className="relative overflow-hidden rounded-3xl bg-[#16295e] px-7 py-10 text-center text-white sm:px-12 sm:py-12"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(42rem 26rem at 88% -10%, rgba(238,116,32,0.22), transparent 60%)," +
                "radial-gradient(36rem 24rem at -8% 110%, rgba(59,127,196,0.25), transparent 60%)",
            }}
          />
          <div className="relative">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5b98a]">
              <IconMail className="h-3.5 w-3.5" /> Nuevo de Bookea
            </p>
            <h1 className="titulo mx-auto mt-4 max-w-[18ch] text-[clamp(28px,5vw,46px)]">
              Invitaciones digitales que enamoran
            </h1>
            <p className="mx-auto mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-white/80">
              Un link precioso que tus invitados abren, admiran y confirman en
              un minuto — sin papel, sin cadenas de WhatsApp.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href="#paquetes"
                className="rounded-xl bg-aventurea-orange px-6 py-3 text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
              >
                Pedí la tuya
              </Link>
              <Link
                href="#catalogo"
                className="rounded-xl border border-white/30 px-6 py-3 text-[14.5px] font-bold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                Ver catálogos de ejemplo
              </Link>
            </div>
          </div>
        </div>

        {/* ---------- Qué incluye: la única lista de features de la
            página (antes había además tres bentos que decían lo
            mismo) ---------- */}
        <div
          data-reveal
          className="mt-4 rounded-3xl border border-aventurea-line bg-aventurea-surface px-6 py-7 sm:px-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="titulo text-[clamp(19px,3vw,24px)] text-aventurea-ink">
              Todo lo que incluye tu invitación
            </h2>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-aventurea-orange">
              Ofrecemos
            </p>
          </div>
          {/* Tres a la vista; el resto detrás del "Ver más". */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.slice(0, 3).map((f) => (
              <CardFeature key={f.titulo} {...f} />
            ))}
          </div>

          <details className="group/mas mt-3">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy [&::-webkit-details-marker]:hidden">
              Ver todo lo que incluye
              <IconChevronDown className="h-4 w-4 transition-transform group-open/mas:rotate-180" />
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.slice(3).map((f) => (
                <CardFeature key={f.titulo} {...f} />
              ))}
              <div className="flex items-center gap-3 rounded-2xl border border-aventurea-orange/25 bg-aventurea-orange/5 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-orange/15 text-aventurea-orange">
                  <IconWand className="h-4 w-4" />
                </span>
                <p className="text-[12.5px] font-bold leading-snug text-aventurea-ink">
                  Configurables según el paquete — vos decidís qué lleva la tuya.
                </p>
              </div>
            </div>
          </details>

          {/* Medios de pago: confianza antes de llegar a los precios. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-aventurea-navy/15 bg-aventurea-navy/5 p-4">
            <span className="flex items-center gap-2 text-[13px] font-extrabold text-aventurea-ink">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-navy/10 text-aventurea-navy [&_svg]:h-4 [&_svg]:w-4">
                <IconTarjeta />
              </span>
              Pagá como te quede mejor
            </span>
            <p className="text-[12.5px] leading-snug text-aventurea-ink-soft">
              Pasarela <strong className="text-aventurea-ink">Stripe</strong> para
              tarjetas de crédito y débito, con{" "}
              <strong className="inline-flex items-center gap-1 text-aventurea-ink">
                <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">
                  <IconApple />
                </span>
                Apple&nbsp;Pay
              </strong>
              . También SINPE Móvil y transferencia bancaria.
            </p>
          </div>
        </div>

        {/* ---------- Tres pasos + la escena animada, plegada ---------- */}
        <div
          data-reveal
          className="mt-4 rounded-3xl border border-aventurea-line bg-aventurea-surface px-6 py-7 sm:px-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="titulo text-[clamp(19px,3vw,24px)] text-aventurea-ink">
              De la idea al link en tres pasos
            </h2>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-aventurea-orange">
              Así de simple
            </p>
          </div>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            <Paso n="1" texto="Elegís tu paquete y nos contás del evento en el formulario." />
            <Paso n="2" texto="Bookea la diseña a tu medida y te la entrega lista en pocos días." />
            <Paso n="3" texto="La compartís y ves quién confirma, en vivo, desde tu cuenta." />
          </ol>
          <p className="mt-3 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            Cada invitación se diseña desde cero con tus colores, tus fotos y tu
            historia — y si querés algo único, lo creamos 100% personalizado.
          </p>

          {/* La escena animada vive plegada: es linda, pero no todos
              necesitan verla para decidir — y costaba media pantalla. */}
          <details
            className="group mt-4"
            style={{ "--inv-dur": "9s" } as React.CSSProperties}
          >
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy [&::-webkit-details-marker]:hidden">
              Ver cómo lo viven tus invitados
              <IconChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div
              aria-hidden
              className="mt-6 flex flex-col items-center justify-center gap-6 text-aventurea-orange md:flex-row md:gap-5"
            >
              <TelefonoInvitado />
              <ConectorViaje />
              <PanelAnfitrion />
            </div>
          </details>
        </div>

        {/* ---------- El catálogo: las generadas con IA que el cliente
            marcó para la vitrina, y luego las demos de la casa
            (src/lib/catalogo-invitaciones.ts) ---------- */}
        <div
          id="catalogo"
          data-reveal
          className="mt-4 scroll-mt-24 rounded-3xl border border-aventurea-line bg-aventurea-surface px-6 py-7 sm:px-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="titulo text-[clamp(19px,3vw,24px)] text-aventurea-ink">
              Catálogos de ejemplo
            </h2>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-aventurea-orange">
              Tocá cualquiera y vivila
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalogo.slice(0, 3).map((d) => (
              <CardDemo key={d.slug} demo={d} />
            ))}
          </div>

          {catalogo.length > 3 && (
            <details className="group/mas mt-3">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy [&::-webkit-details-marker]:hidden">
                Ver más diseños ({catalogo.length - 3})
                <IconChevronDown className="h-4 w-4 transition-transform group-open/mas:rotate-180" />
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalogo.slice(3).map((d) => (
                  <CardDemo key={d.slug} demo={d} />
                ))}
              </div>
            </details>
          )}
        </div>

        {/* ---------- Los paquetes: acá aterrizan todos los CTA ---------- */}
        <div
          id="paquetes"
          data-reveal
          className="mt-4 scroll-mt-24 rounded-3xl border border-aventurea-line bg-aventurea-surface px-6 py-8 sm:px-8"
        >
          <PaquetesInvitaciones titulo="Elegí tu invitación" />
        </div>
      </section>
    </div>
  );
}

/* ---------- Los mockups animados de "Así se vive" ----------
   Escena decorativa (aria-hidden en el contenedor): todo es CSS puro
   con los keyframes invitacion-* de globals.css, sincronizados por la
   misma --inv-dur y desfasados con --inv-delay. */

/** El teléfono del invitado: la invitación navy con scroll simulado
 *  hasta "¿Nos acompañás?" y el tap en "Sí asistiré". */
function TelefonoInvitado() {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div className="w-[248px] rounded-[40px] bg-aventurea-ink p-[9px] shadow-[0_24px_60px_-24px_rgba(16,26,44,0.5)]">
        <div className="relative h-[430px] overflow-hidden rounded-[32px] bg-[#16295e]">
          {/* El notch */}
          <div className="absolute left-1/2 top-2 z-10 h-[15px] w-[76px] -translate-x-1/2 rounded-full bg-aventurea-ink" />

          {/* El contenido que "scrollea" dentro de la pantalla */}
          <div
            className="anim-invitacion-scroll px-4 pb-6 pt-11 text-center text-white"
            style={{ "--inv-scroll": "-170px" } as React.CSSProperties}
          >
            <p className="text-[8.5px] font-bold uppercase tracking-[0.3em] text-[#f5b98a]">
              Nuestra boda
            </p>
            <p
              className="mt-2 text-[27px] italic leading-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Sofía &amp; Andrés
            </p>
            <div className="mx-auto mt-3 h-px w-12 bg-white/25" />
            <p className="mt-3 text-[11px] font-bold text-white/85">
              Sábado 14 de noviembre · 4:00 p.&nbsp;m.
            </p>
            <p className="mt-1 text-[9.5px] font-semibold text-white/60">
              Hacienda La Ceiba, Alajuela
            </p>

            {/* La cuenta regresiva, para que el scroll tenga camino */}
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {[
                ["108", "días"],
                ["06", "horas"],
                ["42", "min"],
              ].map(([n, u]) => (
                <div key={u} className="rounded-lg bg-white/10 py-1.5">
                  <p className="text-[13px] font-extrabold leading-tight">{n}</p>
                  <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-white/60">
                    {u}
                  </p>
                </div>
              ))}
            </div>

            {/* La "foto" de la pareja */}
            <div className="mt-4 flex h-[110px] items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(238,116,32,0.35)_0%,rgba(59,127,196,0.35)_100%)]">
              <span
                className="text-[22px] italic text-white/90"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                S <span className="text-[#f5b98a]">♥</span> A
              </span>
            </div>

            {/* El bloque al que llega el scroll: la confirmación */}
            <div className="mt-5 rounded-2xl bg-white/[0.07] p-4 [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.14)]">
              <p
                className="text-[18px] italic"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                ¿Nos acompañás?
              </p>
              <p className="mt-1 text-[9.5px] font-semibold text-white/70">
                Confirmá antes del 30 de octubre
              </p>

              <div className="relative mt-3">
                <div className="anim-invitacion-pulsar rounded-xl bg-aventurea-orange py-2.5 text-[12px] font-extrabold text-white">
                  Sí asistiré ✓
                </div>
                {/* El estado confirmado que cubre al botón tras el tap */}
                <div className="anim-invitacion-confirmar absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl bg-[#1f7a4d] text-[12px] font-extrabold text-white">
                  <IconCheck className="h-3.5 w-3.5 shrink-0" /> ¡Confirmado!
                </div>
                {/* El dedo que toca el botón */}
                <span className="anim-invitacion-dedo absolute -bottom-3 right-7 h-9 w-9 rounded-full border-2 border-white/80 bg-white/30 opacity-0 shadow-lg" />
              </div>

              <div className="mt-2 rounded-xl border border-white/25 py-2 text-[11px] font-bold text-white/80">
                No podré ir
              </div>
            </div>

            <p className="mt-4 text-[9px] font-semibold text-white/50">
              Con cariño, las familias Vargas y Solís
            </p>
          </div>
        </div>
      </div>
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
        Tu invitado confirma
      </p>
    </div>
  );
}

/** El conector entre aparatos: un puntito (con su caravana) que viaja
 *  del teléfono al panel justo después del tap. */
function ConectorViaje() {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2 self-center">
      <div className="flex items-center gap-1">
        <div className="relative h-2 w-16">
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current opacity-20" />
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="anim-invitacion-viaje absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-current opacity-0"
              style={
                {
                  "--inv-delay": `${i * 0.12}s`,
                  "--inv-viaje": "56px",
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
      <p className="max-w-[16ch] text-center text-[11px] font-bold leading-snug text-aventurea-ink-soft">
        la confirmación llega al instante
      </p>
    </div>
  );
}

/** La laptop del anfitrión: la lista de confirmaciones donde entra la
 *  fila nueva y el contador sube de 12 a 15 personas. */
function PanelAnfitrion() {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div className="w-[300px] sm:w-[340px]">
        {/* El bisel de la pantalla */}
        <div className="rounded-t-[18px] bg-aventurea-ink px-2.5 pt-2.5 shadow-[0_24px_60px_-24px_rgba(16,26,44,0.5)]">
          <div className="overflow-hidden rounded-t-[10px] bg-white">
            {/* La barra del navegador */}
            <div className="flex items-center gap-1.5 border-b border-aventurea-line bg-aventurea-cream-2 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-[#e35a4f]/70" />
              <span className="h-2 w-2 rounded-full bg-[#f0b429]/70" />
              <span className="h-2 w-2 rounded-full bg-[#1f7a4d]/60" />
              <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[8.5px] font-semibold text-aventurea-ink-soft">
                bookea.lat/cuenta · Invitación Sofía &amp; Andrés
              </span>
            </div>

            <div className="p-4">
              {/* El contador grande de personas */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
                    Personas confirmadas
                  </p>
                  <div className="titulo relative mt-1 h-9 w-[2.2ch] overflow-hidden text-[34px] leading-none">
                    <span className="anim-invitacion-num-sale absolute inset-0 text-aventurea-ink opacity-0">
                      12
                    </span>
                    <span className="anim-invitacion-num-entra absolute inset-0 text-[#1f7a4d]">
                      15
                    </span>
                  </div>
                </div>
                <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-[#e1f0e6] px-2.5 py-1 text-[8.5px] font-extrabold uppercase tracking-wide text-[#1f7a4d]">
                  <span className="anim-invitacion-latir h-1.5 w-1.5 rounded-full bg-[#1f7a4d]" />
                  En tiempo real
                </span>
              </div>

              {/* La lista de confirmaciones */}
              <p className="mt-3.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
                Confirmaciones
              </p>
              <div className="mt-1.5 space-y-1.5">
                <FilaConfirmacion nombre="Carlos Mora" detalle="1 acompañante" />
                <FilaConfirmacion nombre="Ana Chaves" detalle="sin acompañantes" />
                <FilaConfirmacion
                  nombre="María José"
                  detalle="2 acompañantes"
                  animada
                />
              </div>
            </div>
          </div>
        </div>
        {/* La base de la laptop */}
        <div className="relative h-[13px] rounded-b-[14px] bg-[#2a3242]">
          <span className="absolute left-1/2 top-0 h-[5px] w-16 -translate-x-1/2 rounded-b-md bg-[#1c2330]" />
        </div>
      </div>
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
        Vos lo ves al instante
      </p>
    </div>
  );
}

/** Una fila de la lista de confirmaciones del anfitrión; la `animada`
 *  entra en escena sincronizada con el tap del invitado. */
function FilaConfirmacion({
  nombre,
  detalle,
  animada,
}: {
  nombre: string;
  detalle: string;
  animada?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
        animada
          ? "anim-invitacion-entrar bg-[#e1f0e6]"
          : "bg-aventurea-cream-2"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${
          animada ? "bg-[#1f7a4d]" : "bg-aventurea-ink-soft/60"
        }`}
      >
        <IconCheck className="h-2.5 w-2.5" />
      </span>
      <span className="truncate text-[10.5px] font-extrabold text-aventurea-ink">
        {nombre}
      </span>
      <span className="ml-auto shrink-0 text-[9px] font-semibold text-aventurea-ink-soft">
        {detalle} ✓
      </span>
    </div>
  );
}

/** Una card de "lo que incluye". */
function CardFeature({
  icono,
  titulo,
  texto,
}: {
  icono: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-aventurea-line bg-white p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-navy/10 text-aventurea-navy [&_svg]:h-4 [&_svg]:w-4">
        {icono}
      </span>
      <div>
        <h3 className="text-[13.5px] font-extrabold tracking-[-0.2px] text-aventurea-ink">
          {titulo}
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-aventurea-ink-soft">{texto}</p>
      </div>
    </div>
  );
}

/** Una card del catálogo de ejemplos. */
function CardDemo({ demo: d }: { demo: EntradaCatalogo }) {
  return (
    <Link
      href={`/invitacion/${d.slug}`}
      title={d.descripcion}
      className="group flex items-center gap-3.5 rounded-2xl border border-aventurea-line bg-white p-3 shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)] transition-all hover:-translate-y-0.5 hover:border-aventurea-navy/40 hover:shadow-[0_16px_40px_-20px_rgba(22,41,94,0.4)]"
    >
      <div
        className={`flex h-14 w-18 shrink-0 items-center justify-center rounded-xl ${d.lienzo}`}
      >
        <span
          className={`transition-transform group-hover:scale-110 ${d.iconoClase} [&_svg]:h-6 [&_svg]:w-6`}
        >
          {ICONO_DEMO[d.icono]}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-aventurea-navy">
          {d.ocasion}
        </p>
        <p className="truncate text-[13.5px] font-extrabold text-aventurea-ink">
          {d.nombre}
        </p>
        <p className="mt-0.5 text-[11.5px] font-extrabold text-aventurea-orange">
          {d.generada ? "Ver la muestra →" : "Vivir la demo →"}
        </p>
      </div>
    </Link>
  );
}

/** Un paso numerado del "cómo funciona". */
function Paso({ n, texto }: { n: string; texto: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-aventurea-line bg-white p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[12.5px] font-extrabold text-white">
        {n}
      </span>
      <p className="text-[13px] leading-snug text-aventurea-ink">{texto}</p>
    </li>
  );
}
