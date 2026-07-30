import Link from "next/link";
import SiteHeader from "@/components/site-header";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  IconCheck,
  IconMail,
  IconPin,
  IconSparkles,
  IconUsers,
  IconWand,
} from "@/components/icons";

export const metadata = {
  title: "Invitaciones digitales que enamoran",
  description:
    "Bookea diseña la invitación digital de tu evento: ubicación con un toque, confirmación de invitados en línea y diseño a tu medida.",
};

/**
 * La landing de venta de Invitaciones Digitales — el producto que
 * Bookea diseña y entrega llave en mano: el cliente comparte un link
 * y los invitados confirman ahí mismo. Estilo bento del sitio, con el
 * hero en navy como probadita del lienzo real (/i/demo-invitacion).
 */
export default function InvitacionesLanding() {
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <SiteHeader breadcrumb="Invitaciones digitales" />
      <RevealOnScroll />

      <section className="mx-auto max-w-[1080px] px-6 py-10 sm:py-14">
        {/* ---------- Hero navy: se ve como la invitación real ---------- */}
        <div
          data-reveal
          className="relative overflow-hidden rounded-3xl bg-[#16295e] px-7 py-14 text-center text-white sm:px-12 sm:py-20"
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
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.18em] text-[#f5b98a]">
              <IconMail className="h-3.5 w-3.5" /> Nuevo de Bookea
            </p>
            <h1 className="titulo mx-auto mt-5 max-w-[18ch] text-[clamp(32px,6vw,54px)]">
              Invitaciones digitales que enamoran
            </h1>
            <p className="mx-auto mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-white/80">
              Para bodas, quince años, baby showers y todo lo que se celebre: un
              link precioso que tus invitados abren, admiran y confirman en un
              minuto — sin papel, sin cadenas de WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/cuenta"
                className="rounded-xl bg-aventurea-orange px-7 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
              >
                Pedí la tuya
              </Link>
              <Link
                href="/i/demo-invitacion"
                className="rounded-xl border border-white/30 px-7 py-3.5 text-[15px] font-bold text-white transition-colors hover:border-white hover:bg-white/10"
              >
                Ver una de ejemplo
              </Link>
            </div>
          </div>
        </div>

        {/* ---------- Los tres porqués, en bento ---------- */}
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Bento
            delay="80ms"
            icono={<IconPin className="h-5 w-5" />}
            titulo="Ubicación con un toque"
            texto="La invitación trae el lugar con botones directos a Google Maps y Waze — nadie llama a preguntar cómo llegar."
          />
          <Bento
            delay="160ms"
            icono={<IconUsers className="h-5 w-5" />}
            titulo="Confirmación digital de invitados"
            texto="Cada invitado confirma en el mismo link (con acompañantes y un mensajito) y vos ves la lista al día desde tu cuenta."
          />
          <Bento
            delay="240ms"
            icono={<IconWand className="h-5 w-5" />}
            titulo="Diseño a tu medida"
            texto="El equipo de Bookea la diseña con tus colores, tu foto y tu historia. ¿Querés algo único? También hacemos diseños 100% personalizados."
          />
        </div>

        {/* ---------- Cómo funciona + CTA final ---------- */}
        <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <div
            data-reveal
            className="rounded-3xl border border-aventurea-line bg-aventurea-surface p-7 sm:p-9"
          >
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-orange">
              <IconSparkles className="h-4 w-4" /> Así de simple
            </p>
            <h2 className="titulo mt-2 text-[clamp(22px,3.5vw,30px)] text-aventurea-ink">
              De la idea al link en tres pasos
            </h2>
            <ol className="mt-5 grid gap-4">
              <Paso n="1" texto="Nos contás del evento: fecha, lugar, anfitriones y el estilo que soñás." />
              <Paso n="2" texto="Bookea diseña tu invitación y te entrega un link corto listo para compartir." />
              <Paso n="3" texto="La compartís por WhatsApp y ves quién confirma, en tiempo real, desde tu cuenta." />
            </ol>
          </div>
          <div
            data-reveal
            style={{ "--reveal-delay": "120ms" } as React.CSSProperties}
            className="flex flex-col justify-between rounded-3xl border border-aventurea-orange/25 bg-aventurea-orange/5 p-7 sm:p-9"
          >
            <div>
              <h2 className="titulo text-[clamp(20px,3vw,26px)] text-aventurea-ink">
                ¿Celebrás pronto?
              </h2>
              <p className="mt-2.5 text-[14px] leading-relaxed text-aventurea-ink-soft">
                Escribinos desde tu cuenta y te cotizamos la invitación de tu
                evento — la entregamos lista en pocos días.
              </p>
              <ul className="mt-4 grid gap-2 text-[13.5px] font-semibold text-aventurea-ink">
                {["Link propio y elegante", "Lista de confirmados al día", "Sin apps que instalar"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2">
                      <IconCheck className="h-4 w-4 shrink-0 text-aventurea-green" /> {t}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <Link
              href="/cuenta"
              className="mt-6 rounded-xl bg-aventurea-orange px-6 py-3 text-center text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Pedí la tuya
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Una tarjeta del bento de beneficios. */
function Bento({
  icono,
  titulo,
  texto,
  delay,
}: {
  icono: React.ReactNode;
  titulo: string;
  texto: string;
  delay: string;
}) {
  return (
    <div
      data-reveal
      style={{ "--reveal-delay": delay } as React.CSSProperties}
      className="rounded-3xl border border-aventurea-line bg-aventurea-surface p-7"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-aventurea-navy/10 text-aventurea-navy">
        {icono}
      </span>
      <h2 className="mt-3.5 text-[17px] font-extrabold tracking-[-0.3px] text-aventurea-ink">
        {titulo}
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">{texto}</p>
    </div>
  );
}

/** Un paso numerado del "cómo funciona". */
function Paso({ n, texto }: { n: string; texto: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[13.5px] font-extrabold text-white">
        {n}
      </span>
      <p className="pt-1 text-[14px] leading-relaxed text-aventurea-ink">{texto}</p>
    </li>
  );
}
