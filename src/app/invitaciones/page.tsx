import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
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

/**
 * Lo que lleva la invitación. Cada cosa con UNA línea que explique
 * qué es: los títulos solos no vendían nada, y dos párrafos por ítem
 * se leían como pliego de condiciones. Una línea es el punto justo.
 */
const INCLUYE: { icono: React.ReactNode; titulo: string; texto: string }[] = [
  {
    icono: <IconMail />,
    titulo: "Link a pantalla completa",
    texto: "Se abre en cualquier teléfono, sin instalar nada.",
  },
  {
    icono: <IconCheck />,
    titulo: "Confirmación en tiempo real",
    texto: "Tus invitados confirman ahí mismo y la lista se actualiza sola.",
  },
  {
    icono: <IconChartBars />,
    titulo: "Panel de invitados",
    texto: "Quién asiste, quién no y el conteo de personas al día.",
  },
  {
    icono: <IconUsers />,
    titulo: "Personalizada por invitado",
    texto: "Cada persona la recibe con su nombre.",
  },
  {
    icono: <IconWhatsapp />,
    titulo: "Envíos ilimitados",
    texto: "Compartila por WhatsApp, correo o redes las veces que querás.",
  },
  {
    icono: <IconClipboard />,
    titulo: "PDF para imprimir",
    texto: "También en documento, para repartir o guardar de recuerdo.",
  },
  {
    icono: <IconGlobe />,
    titulo: "En el idioma que necesités",
    texto: "Español, inglés o bilingüe si tenés invitados de afuera.",
  },
  {
    icono: <IconWand />,
    titulo: "Diseño a tu medida",
    texto: "Tus colores, tus fotos y tu historia — o algo 100% exclusivo.",
  },
];

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

/** Para que las generadas no salgan todas con el mismo lienzo — azules
 *  sólidos de la paleta, igual que las del catálogo fijo. */
const LIENZOS_GENERADOS = [
  "bg-aventurea-navy",
  "bg-aventurea-navy-3",
  "bg-aventurea-blue",
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
 * La landing de venta de Invitaciones Digitales.
 *
 * Rehecha con el mismo lenguaje de /lealtad y /publicar: lienzo gris,
 * bloques bento de color plano con esquinas de 32px y botones píldora.
 * Nada de tarjetas dentro de tarjetas dentro de tarjetas.
 *
 * Dos decisiones de fondo:
 *
 * 1. La escena animada es LA pieza de la página, no un extra plegado.
 *    Antes vivía escondida tras un "Ver cómo lo viven tus invitados" —
 *    justo lo único que explica el producto sin que haya que leer. Ahora
 *    ocupa su propio bloque, corre sola y cada aparato lleva su paso
 *    numerado en texto de verdad (los mockups son decorativos).
 *
 * 2. Los paquetes van al final. El visitante primero entiende qué es y
 *    lo ve funcionando; el precio es lo último, cuando ya lo quiere.
 */
export default async function InvitacionesLanding() {
  const generadas = await catalogoGenerado();
  // Primero los diseños de la casa (los más pulidos) y después las
  // que hicieron clientes reales, como prueba social.
  const catalogo: EntradaCatalogo[] = [
    ...CATALOGO_INVITACIONES,
    ...generadas,
  ].slice(0, 6);

  return (
    // El mismo lienzo gris de /lealtad: los bloques bento encima.
    <div className="min-h-screen bg-aventurea-cream-2">
      <RevealOnScroll />
      <SiteHeader breadcrumb="Invitaciones digitales" ancho="max-w-[1200px]" />

      {/* ---------- Hero bento ---------- */}
      <section className="px-4 pb-2 pt-6 lg:px-10">
        <div className="mx-auto grid max-w-[1200px] gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div
            data-reveal
            className="relative isolate overflow-hidden rounded-3xl bg-aventurea-navy p-8 sm:p-12"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-aventurea-navy-3/60 blur-2xl"
            />
            <span className="inline-flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
              <IconMail className="h-3.5 w-3.5" />
              Invitaciones digitales
            </span>
            <h1 className="titulo mt-5 max-w-[15ch] text-balance text-[38px] text-white sm:text-[52px]">
              Un link que enamora y confirma solo
            </h1>
            <p className="mt-5 max-w-[46ch] text-balance text-[15.5px] leading-relaxed text-white/80 sm:text-[17px]">
              Bookea diseña la invitación de tu evento. Vos la compartís,
              tus invitados confirman ahí mismo y la lista se te arma sola —
              sin papel y sin cadenas de WhatsApp.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="#paquetes"
                className="rounded-xl bg-aventurea-orange px-7 py-3.5 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-orange-dark"
              >
                Pedí la tuya
              </Link>
              <a
                href="#como-funciona"
                className="rounded-xl bg-white px-7 py-3.5 text-[14.5px] font-bold text-aventurea-navy transition-colors hover:bg-white/90"
              >
                Ver cómo funciona
              </a>
            </div>
          </div>

          {/* El link viajando por WhatsApp: así es como el cliente
              reparte la invitación en Costa Rica. */}
          <div className="grid gap-4">
            <div
              data-reveal
              style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
              className="relative overflow-hidden rounded-3xl bg-aventurea-orange p-7"
            >
              <div
                aria-hidden
                className="anim-publicar-flotar mx-auto w-[270px] rounded-2xl bg-white p-3.5 shadow-[0_24px_50px_-18px_rgba(6,12,32,0.5)]"
              >
                <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#1f7a4d]">
                  <IconWhatsapp className="h-3.5 w-3.5" /> WhatsApp
                </p>
                {/* La burbuja con la vista previa del link */}
                <div className="mt-2.5 rounded-2xl rounded-tr-md bg-[#e1f0e6] p-2">
                  <div className="overflow-hidden rounded-xl bg-white">
                    <div className="flex h-[86px] flex-col items-center justify-center bg-aventurea-navy text-center">
                      <p className="text-[7.5px] font-bold uppercase tracking-[0.28em] text-[#f5b98a]">
                        Nuestra boda
                      </p>
                      <p
                        className="mt-1 text-[19px] italic leading-tight text-white"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        Sofía &amp; Andrés
                      </p>
                      <p className="mt-1 text-[8px] font-bold text-white/70">
                        14 de noviembre · 4:00 p.&nbsp;m.
                      </p>
                    </div>
                    <p className="truncate px-2.5 py-1.5 text-[8.5px] font-semibold text-aventurea-ink-soft">
                      bookea.lat/i/sofia-y-andres
                    </p>
                  </div>
                  <p className="mt-1.5 px-1 text-[10.5px] font-semibold leading-snug text-aventurea-ink">
                    ¡Nos casamos! Abrí el link y confirmanos 💛
                  </p>
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="rounded-lg bg-aventurea-cream-2 px-2.5 py-1 text-[9px] font-bold text-aventurea-ink-soft">
                    Enviado a 120 invitados
                  </span>
                </div>
              </div>
              <p className="mt-5 text-center text-[13px] font-extrabold text-white">
                Un solo link — lo mandás por WhatsApp, correo o redes
              </p>
            </div>
            <div
              data-reveal
              style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
              className="flex items-center gap-4 rounded-3xl border border-aventurea-line bg-white p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aventurea-blue-light text-aventurea-navy">
                <IconSparkles className="h-6 w-6" />
              </span>
              <p className="text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                <strong className="text-aventurea-ink">Sin instalar nada:</strong>{" "}
                se abre en el navegador de cualquier teléfono, aunque tu tía
                no sepa bajar apps.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- La escena animada — el corazón de la página -------
           Dos columnas: a la izquierda el relato en texto de verdad
           (los pasos), a la derecha los mockups en movimiento. Los tres
           aparatos (teléfono, aviso, panel) comparten una sola línea de
           tiempo (--inv-dur) así el toque del invitado, la notificación
           y la fila que le entra al anfitrión caen en el mismo compás. */}
      <section
        id="como-funciona"
        className="mx-4 my-4 max-w-[1200px] scroll-mt-24 overflow-hidden rounded-3xl bg-aventurea-blue-light py-14 lg:mx-auto"
      >
        <div className="mx-auto max-w-[1140px] px-6 lg:px-10">
          <div
            className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16"
            style={{ "--inv-dur": "9s" } as React.CSSProperties}
          >
            <div data-reveal>
              <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-navy">
                En vivo, ahora mismo
              </p>
              <h2 className="titulo mt-2 max-w-[16ch] text-[28px] text-aventurea-ink sm:text-[34px]">
                Del link de tu invitado a tu lista de confirmados
              </h2>
              <p className="mt-2.5 max-w-[46ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
                Esto no es un dibujo: es exactamente lo que ve tu invitado en
                su teléfono y lo que ves vos en tu cuenta, al mismo tiempo.
              </p>

              <div className="mt-8 flex flex-col gap-6">
                <FilaPaso
                  n="1"
                  titulo="Abre tu invitación"
                  texto="Pantalla completa y animada, con la cuenta regresiva y la ubicación en Maps y Waze."
                />
                <FilaPaso
                  n="2"
                  titulo="Confirma con un toque"
                  texto="Sin apps ni formularios eternos: toca «Sí asistiré» y dice cuántos van."
                />
                <FilaPaso
                  n="3"
                  titulo="A vos te entra al instante"
                  texto="Te llega la notificación, la fila aparece sola en tu panel y el conteo de personas sube solo."
                />
              </div>
            </div>

            <div data-reveal style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
              <EscenaMockups />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Qué ofrecemos — ficha técnica a dos columnas:
           el argumento a la izquierda, el desglose a la derecha en
           filas con línea fina. Explica sin verse como pliego. ------ */}
      <section className="px-4 py-12 lg:px-10">
        <div className="mx-auto grid max-w-[1100px] items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div data-reveal className="lg:sticky lg:top-24">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-orange">
              Qué ofrecemos
            </p>
            <h2 className="titulo mt-2 text-[28px] leading-tight text-aventurea-ink sm:text-[34px]">
              Todo lo que lleva tu invitación
            </h2>
            <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
              No es una imagen que se reenvía: es una página viva con la
              información del evento, la confirmación de tus invitados y el
              control de la lista en tu cuenta.
            </p>
            <Link
              href="#paquetes"
              className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-extrabold text-aventurea-navy hover:text-aventurea-orange"
            >
              Ver qué trae cada paquete →
            </Link>
          </div>

          {/* El desglose: dos columnas de filas con hairline arriba. */}
          <div className="grid sm:grid-cols-2 sm:gap-x-8">
            {INCLUYE.map((f, i) => (
              <div
                key={f.titulo}
                data-reveal
                style={{ "--reveal-delay": `${i * 50}ms` } as React.CSSProperties}
                className="flex items-start gap-3.5 border-t border-aventurea-line py-4 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-navy/10 text-aventurea-navy [&_svg]:h-[17px] [&_svg]:w-[17px]">
                  {f.icono}
                </span>
                <div>
                  <h3 className="text-[14.5px] font-extrabold leading-snug text-aventurea-ink">
                    {f.titulo}
                  </h3>
                  <p className="mt-1 text-[13px] leading-snug text-aventurea-ink-soft">
                    {f.texto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Cómo se pide — bloque blanco ---------- */}
      <section className="mx-4 my-4 max-w-[1200px] overflow-hidden rounded-3xl border border-aventurea-line bg-white py-14 lg:mx-auto">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
          <div data-reveal className="text-center">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-orange">
              Así de simple
            </p>
            <h2 className="titulo mt-2 text-[28px] text-aventurea-ink sm:text-[34px]">
              De la idea al link en tres pasos
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                paso: "1",
                titulo: "Elegís tu paquete",
                texto:
                  "Nos contás del evento en un formulario corto: fecha, lugar y cómo querés que se vea.",
              },
              {
                paso: "2",
                titulo: "Bookea la diseña",
                texto:
                  "Con tus colores, tus fotos y tu historia. En pocos días te llega lista — o 100% exclusiva si la querés así.",
              },
              {
                paso: "3",
                titulo: "La compartís",
                texto:
                  "Mandás el link y ves quién confirma, en vivo, desde tu cuenta de Bookea.",
              },
            ].map((p, i) => (
              <div
                key={p.paso}
                data-reveal
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                className="rounded-3xl bg-aventurea-cream-2 p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-aventurea-navy text-[16px] font-extrabold text-white">
                  {p.paso}
                </span>
                <h3 className="mt-4 text-[16.5px] font-extrabold text-aventurea-ink">
                  {p.titulo}
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {p.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- El catálogo: demos de la casa y las que hicieron
           clientes reales (src/lib/catalogo-invitaciones.ts) -------- */}
      <section
        id="catalogo"
        className="mx-4 my-4 max-w-[1200px] scroll-mt-24 overflow-hidden rounded-3xl border border-aventurea-line bg-white py-14 lg:mx-auto"
      >
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
          <div
            data-reveal
            className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3"
          >
            <div>
              <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-aventurea-orange">
                Catálogo
              </p>
              <h2 className="titulo mt-2 text-[28px] text-aventurea-ink sm:text-[34px]">
                Invitaciones que ya están andando
              </h2>
              <p className="mt-2 max-w-[54ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                Cada una es una invitación de verdad, abierta al público. Tocá
                la que te guste y vivila como la viviría tu invitado.
              </p>
            </div>
            <Link
              href="#paquetes"
              className="shrink-0 text-[13.5px] font-extrabold text-aventurea-navy hover:text-aventurea-orange"
            >
              Quiero la mía →
            </Link>
          </div>

          {/* Cuatro a la vista y el resto detrás del "Ver más": el
              catálogo es prueba, no el argumento — no puede comerse
              media pantalla antes de llegar a los precios. */}
          <div className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {catalogo.slice(0, 4).map((d, i) => (
              <CardDemo key={d.slug} demo={d} orden={i} />
            ))}
          </div>

          {catalogo.length > 4 && (
            <details className="group/mas mt-4">
              <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-xl border border-aventurea-line bg-white px-5 py-2.5 text-[13px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy [&::-webkit-details-marker]:hidden">
                Ver más diseños ({catalogo.length - 4})
                <IconChevronDown className="h-4 w-4 transition-transform group-open/mas:rotate-180" />
              </summary>
              <div className="mt-3.5 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                {catalogo.slice(4).map((d, i) => (
                  <CardDemo key={d.slug} demo={d} orden={i} />
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* ---------- Los paquetes: al final, cuando ya lo quiere ------- */}
      <section
        id="paquetes"
        className="mx-4 my-4 max-w-[1200px] scroll-mt-24 overflow-hidden rounded-3xl border border-aventurea-line bg-white py-14 lg:mx-auto"
      >
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
          <div data-reveal>
            <PaquetesInvitaciones titulo="Elegí tu invitación" />
          </div>

          {/* Medios de pago: la última duda antes de comprar, acá
              abajo de los precios que es donde aparece. */}
          <div
            data-reveal
            className="mt-9 flex flex-col items-center gap-4 rounded-2xl bg-aventurea-cream-2 px-6 py-6 sm:flex-row sm:gap-6"
          >
            <span className="flex shrink-0 items-center gap-3 text-[14px] font-extrabold text-aventurea-ink">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-aventurea-navy shadow-sm [&_svg]:h-5 [&_svg]:w-5">
                <IconTarjeta />
              </span>
              Pagá como te quede mejor
            </span>
            <p className="text-center text-[13px] leading-relaxed text-aventurea-ink-soft sm:text-left">
              Tarjeta de crédito o débito por la pasarela{" "}
              <strong className="text-aventurea-ink">Stripe</strong>, con{" "}
              <strong className="inline-flex items-baseline gap-1 text-aventurea-ink">
                <span className="translate-y-[2px] [&_svg]:h-[13px] [&_svg]:w-[13px]">
                  <IconApple />
                </span>
                Apple&nbsp;Pay
              </strong>
              , o en colones por{" "}
              <strong className="text-aventurea-ink">SINPE Móvil</strong> y
              transferencia bancaria.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- CTA final — bloque navy ---------- */}
      <section className="px-4 pb-16 pt-4 lg:px-10">
        <div
          data-reveal
          className="relative isolate mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-aventurea-navy px-6 py-14 text-center sm:py-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-aventurea-navy-3/60 blur-2xl"
          />
          <p className="flex items-center justify-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
            <IconSparkles className="h-3.5 w-3.5" /> Invitaciones digitales
          </p>
          <h2 className="titulo mx-auto mt-4 max-w-[22ch] text-balance text-[28px] text-white sm:text-[36px]">
            Dejá de perseguir invitados por WhatsApp
          </h2>
          <div className="mt-8">
            <Link
              href="#paquetes"
              className="inline-flex rounded-xl bg-aventurea-orange px-8 py-4 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Pedí tu invitación
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ---------- La escena animada ----------------------------------------
   Los mockups son decorativos (aria-hidden): quien no los ve igual se
   entera de todo por el número, el título y el texto de cada paso, que
   son texto de verdad. Todo el movimiento es CSS puro con los keyframes
   invitacion-* de globals.css, sincronizados por la misma --inv-dur y
   desfasados con --inv-delay. */

/** Una fila de la columna de texto: número, título y una línea que lo
 *  explica — sin mockup, ese vive aparte en la columna de la derecha. */
function FilaPaso({ n, titulo, texto }: { n: string; titulo: string; texto: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[15px] font-extrabold text-white">
        {n}
      </span>
      <div>
        <h3 className="text-[16px] font-extrabold text-aventurea-ink">{titulo}</h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          {texto}
        </p>
      </div>
    </div>
  );
}

/** La columna de la derecha: los tres aparatos apilados, en el mismo
 *  orden que cuentan los pasos de la izquierda — el teléfono que
 *  confirma, el aviso que le llega al anfitrión y el panel donde se
 *  acumulan las confirmaciones. */
function EscenaMockups() {
  return (
    <div aria-hidden className="flex flex-col items-center gap-6">
      <TelefonoInvitado />
      <ConectorViaje />
      {/* Mismo ancho que PanelAnfitrion (w-[300px] sm:w-[340px]): así el
          aviso, centrado con inset-x-0 + mx-auto, queda exactamente
          sobre el panel en cualquier tamaño de pantalla. */}
      <div className="relative w-[300px] sm:w-[340px]">
        <NotificacionConfirmacion />
        <PanelAnfitrion />
      </div>
    </div>
  );
}

/** El aviso flotante sobre el panel: lo que el anfitrión recibiría al
 *  confirmar un invitado. Entra en el mismo compás que la fila y el
 *  contador (invitacion-entrar / invitacion-num-entra), así los tres
 *  se leen como una sola cosa pasando. Se centra con inset-x-0 +
 *  mx-auto en vez de -translate-x-1/2: el transform lo maneja entero
 *  la animación, así no compiten dos transforms por la misma
 *  propiedad. */
function NotificacionConfirmacion() {
  return (
    <div className="anim-invitacion-notificacion absolute -top-5 inset-x-0 z-10 mx-auto w-[230px] rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_16px_32px_-12px_rgba(16,26,44,0.4)] ring-1 ring-black/5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aventurea-green text-white [&_svg]:h-3 [&_svg]:w-3">
          <IconCheck />
        </span>
        <div className="min-w-0 text-left">
          <p className="truncate text-[10.5px] font-extrabold text-aventurea-ink">
            Nueva confirmación
          </p>
          <p className="truncate text-[10px] text-aventurea-ink-soft">
            María José · 2 acompañantes
          </p>
        </div>
      </div>
    </div>
  );
}

/** El teléfono del invitado: la invitación navy con scroll simulado
 *  hasta "¿Nos acompañás?" y el tap en "Sí asistiré". */
function TelefonoInvitado() {
  return (
    <div
      aria-hidden
      className="w-[248px] rounded-[40px] bg-aventurea-ink p-[9px] shadow-[0_24px_60px_-24px_rgba(16,26,44,0.5)]"
    >
      <div className="relative h-[430px] overflow-hidden rounded-[32px] bg-aventurea-navy">
        {/* El notch */}
        <div className="absolute left-1/2 top-2 z-10 h-[15px] w-[76px] -translate-x-1/2 rounded-xl bg-aventurea-ink" />

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
              <div className="anim-invitacion-confirmar absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl bg-aventurea-green text-[12px] font-extrabold text-white">
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
  );
}

/** El conector entre aparatos: un puntito (con su caravana) que viaja
 *  del teléfono al panel justo después del tap. Siempre apilado (la
 *  columna de la derecha nunca los pone lado a lado), así que la
 *  flecha va girada y apunta hacia abajo. */
function ConectorViaje() {
  return (
    <div aria-hidden className="flex flex-col items-center gap-2">
      {/* La caja de 88px le da el alto que el rotate necesita
          (transform no reserva espacio por sí solo). */}
      <div className="flex h-[88px] w-[88px] items-center justify-center">
        <div className="flex rotate-90 items-center gap-1 text-aventurea-orange">
          <div className="relative h-2 w-16">
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current opacity-25" />
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
      </div>
      <p className="rounded-lg bg-white px-3.5 py-1.5 text-[11px] font-extrabold text-aventurea-navy">
        En menos de un segundo
      </p>
    </div>
  );
}

/** La laptop del anfitrión: la lista de confirmaciones donde entra la
 *  fila nueva y el contador sube de 12 a 15 personas. */
function PanelAnfitrion() {
  return (
    <div aria-hidden className="w-[300px] sm:w-[340px]">
      {/* El bisel de la pantalla */}
      <div className="rounded-t-[18px] bg-aventurea-ink px-2.5 pt-2.5 shadow-[0_24px_60px_-24px_rgba(16,26,44,0.5)]">
        <div className="overflow-hidden rounded-t-[10px] bg-white">
          {/* La barra del navegador */}
          <div className="flex items-center gap-1.5 border-b border-aventurea-line bg-aventurea-cream-2 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[#e35a4f]/70" />
            <span className="h-2 w-2 rounded-full bg-[#f0b429]/70" />
            <span className="h-2 w-2 rounded-full bg-aventurea-green/60" />
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
                  <span className="anim-invitacion-num-entra absolute inset-0 text-aventurea-green">
                    15
                  </span>
                </div>
              </div>
              <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg bg-aventurea-green-light px-2.5 py-1 text-[8.5px] font-extrabold uppercase tracking-wide text-aventurea-green">
                <span className="anim-invitacion-latir h-1.5 w-1.5 rounded-full bg-aventurea-green" />
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
        animada ? "anim-invitacion-entrar bg-aventurea-green-light" : "bg-aventurea-cream-2"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${
          animada ? "bg-aventurea-green" : "bg-aventurea-ink-soft/60"
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

/** Una card del catálogo: el lienzo manda y el texto acompaña. */
/**
 * Una invitación del catálogo, con forma de invitación: lienzo
 * vertical con su paleta, la ocasión en versalitas y el nombre en
 * serif — como se ve el diseño real al abrirlo. El ícono queda de
 * remate, no de protagonista.
 */
function CardDemo({ demo: d, orden }: { demo: EntradaCatalogo; orden: number }) {
  // Los lienzos claros llevan tinta navy; los oscuros, blanca. La
  // pista está en el color que el catálogo eligió para el ícono.
  const claro = d.iconoClase.includes("navy");
  const tinta = claro ? "text-aventurea-navy" : "text-white";
  const tintaSuave = claro ? "text-aventurea-navy/55" : "text-white/60";
  const linea = claro ? "bg-aventurea-navy/25" : "bg-white/30";

  return (
    <Link
      href={`/invitacion/${d.slug}`}
      title={d.descripcion}
      data-reveal
      style={{ "--reveal-delay": `${orden * 70}ms` } as React.CSSProperties}
      className="group block"
    >
      <div
        className={`relative flex aspect-[5/6] flex-col items-center justify-center overflow-hidden rounded-2xl px-4 text-center shadow-[0_14px_32px_-20px_rgba(16,26,44,0.5)] transition-transform duration-300 group-hover:-translate-y-1.5 ${d.lienzo}`}
      >
        {/* El brillo de esquina que llevan las invitaciones reales */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl"
        />

        <span
          className={`relative text-[8px] font-extrabold uppercase tracking-[0.22em] ${tintaSuave}`}
        >
          {d.ocasion}
        </span>
        <p
          className={`relative mt-2 text-balance text-[17px] italic leading-[1.15] sm:text-[18.5px] ${tinta}`}
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {d.nombre}
        </p>
        <span className={`relative mt-2.5 h-px w-7 ${linea}`} />
        <span
          className={`relative mt-2.5 transition-transform duration-300 group-hover:scale-110 ${d.iconoClase} [&_svg]:h-5 [&_svg]:w-5`}
        >
          {ICONO_DEMO[d.icono]}
        </span>

        {/* Al pasar el mouse, la invitación invita */}
        <span
          className={`absolute inset-x-0 bottom-0 translate-y-full bg-black/25 py-2.5 text-[11.5px] font-extrabold backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0 ${claro ? "text-aventurea-navy" : "text-white"}`}
        >
          {d.generada ? "Ver la muestra" : "Abrir la invitación"}
        </span>
      </div>

      <p className="mt-2.5 truncate text-[12.5px] font-extrabold text-aventurea-ink">
        {d.nombre}
      </p>
      <p className="text-[11.5px] font-extrabold text-aventurea-orange">
        {d.generada ? "Ver la muestra →" : "Vivir la demo →"}
      </p>
    </Link>
  );
}
