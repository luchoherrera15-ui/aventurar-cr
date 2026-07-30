import Link from "next/link";
import SiteHeader from "@/components/site-header";
import RevealOnScroll from "@/components/reveal-on-scroll";
import PaquetesInvitaciones from "@/components/paquetes-invitaciones";
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
                href="#paquetes"
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

        {/* ---------- Mockups animados: la confirmación en vivo ----------
            Una sola línea de tiempo CSS (--inv-dur) cuenta el cuento en
            loop: el invitado scrollea la invitación y toca "Sí asistiré",
            el puntito viaja y al anfitrión le entra la fila nueva con el
            contador subiendo. Keyframes invitacion-* en globals.css. */}
        <div
          data-reveal
          style={{ "--inv-dur": "9s" } as React.CSSProperties}
          className="mt-5 overflow-hidden rounded-3xl border border-aventurea-line bg-aventurea-surface px-6 py-10 sm:px-10 sm:py-12"
        >
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-aventurea-orange">
              Así se vive
            </p>
            <h2 className="titulo mx-auto mt-2 max-w-[24ch] text-[clamp(22px,3.5vw,30px)] text-aventurea-ink">
              Confirman en su teléfono — vos lo ves al instante
            </h2>
            <p className="mx-auto mt-2.5 max-w-[58ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
              Cada invitado abre el link y confirma desde su teléfono, sin
              instalar nada. Y vos ves la lista de confirmados y el conteo de
              personas actualizarse en tiempo real desde tu cuenta — en la
              compu o en el teléfono.
            </p>
          </div>

          <div
            aria-hidden
            className="mt-10 flex flex-col items-center justify-center gap-6 text-aventurea-orange md:flex-row md:gap-5"
          >
            <TelefonoInvitado />
            <ConectorViaje />
            <PanelAnfitrion />
          </div>
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
              href="#paquetes"
              className="mt-6 rounded-xl bg-aventurea-orange px-6 py-3 text-center text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Pedí la tuya
            </Link>
          </div>
        </div>

        {/* ---------- Los paquetes: acá aterrizan todos los CTA ---------- */}
        <div
          id="paquetes"
          data-reveal
          className="mt-5 scroll-mt-24 rounded-3xl border border-aventurea-line bg-aventurea-surface px-6 py-10 sm:px-10 sm:py-12"
        >
          <PaquetesInvitaciones titulo="Elegí tu paquete" />
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
            <span className="mx-auto mt-3 inline-flex items-center gap-1 rounded-full border border-white/30 px-3 py-1 text-[9.5px] font-bold">
              <IconPin className="h-2.5 w-2.5" /> Cómo llegar
            </span>

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
