import Link from "next/link";
import SiteHeader from "@/components/site-header";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  IconCalendarLine,
  IconCamera,
  IconChartBars,
  IconChatBubble,
  IconCheck,
  IconChevronDown,
  IconClipboard,
  IconClock,
  IconGlobe,
  IconHeart,
  IconHouse,
  IconMail,
  IconSparkles,
  IconStar,
  IconStore,
  IconWand,
} from "@/components/icons";
import { CATEGORIA_ICONO } from "../mi-rancho/types";

export const metadata = {
  title: "Bookea para negocios — La plataforma de reservas para tu negocio",
  description:
    "Citas, eventos y hospedajes: tus clientes reservan en línea y vos administrás agenda, chat, correos y cobros en un solo lugar. Publicar es gratis.",
};

/**
 * La landing de ventas para dueños de negocio (estilo "para negocios"
 * de Fresha, con identidad Bookea): mockups de teléfono animados en
 * CSS puro que muestran el flujo completo — el cliente reserva y al
 * dueño le cae la reserva. Los keyframes viven en globals.css
 * (publicar-* / .anim-publicar-*) y respetan prefers-reduced-motion.
 * Todos los CTAs de alta van a /mi-rancho/nuevo.
 */

/** Escena Citas: celeste de la vertical, loop de 8 segundos. */
const VARS_CITAS = {
  "--pub-dur": "8s",
  "--pub-acento": "#1f7a74",
  "--pub-fondo-acento": "#e6f6f5",
  "--pub-tinta-acento": "#0f5b56",
  "--pub-linea": "#dceeec",
} as React.CSSProperties;

/** Escena Eventos: naranja de la marca, loop de 9 segundos. */
const VARS_EVENTOS = {
  "--pub-dur": "9s",
  "--pub-acento": "#ee7420",
  "--pub-fondo-acento": "#fdeee1",
  "--pub-tinta-acento": "#9a4a10",
  "--pub-linea": "#e2e2e2",
} as React.CSSProperties;

type VerticalNegocio = "Citas" | "Eventos" | "Hospedajes";

const ESTILO_VERTICAL: Record<VerticalNegocio, { burbuja: string; tag: string }> = {
  Citas: { burbuja: "bg-[#e6f6f5] text-[#1f7a74]", tag: "text-[#2b8a84]" },
  Eventos: {
    burbuja: "bg-aventurea-orange-light text-aventurea-orange",
    tag: "text-aventurea-orange",
  },
  Hospedajes: {
    burbuja: "bg-aventurea-blue-light text-aventurea-navy",
    tag: "text-aventurea-navy-3",
  },
};

const TIPOS_NEGOCIO: {
  label: string;
  icono: React.ReactNode;
  vertical: VerticalNegocio;
}[] = [
  { label: "Salones de belleza", icono: <IconSparkles />, vertical: "Citas" },
  { label: "Barberías", icono: <IconStore />, vertical: "Citas" },
  { label: "Uñas", icono: <IconWand />, vertical: "Citas" },
  { label: "Spa y bienestar", icono: <IconHeart />, vertical: "Citas" },
  { label: "Consultorios", icono: <IconClipboard />, vertical: "Citas" },
  { label: "Salones de eventos", icono: CATEGORIA_ICONO.lugares, vertical: "Eventos" },
  { label: "Catering", icono: CATEGORIA_ICONO.alimentacion, vertical: "Eventos" },
  { label: "DJ y música", icono: CATEGORIA_ICONO.animacion, vertical: "Eventos" },
  { label: "Decoración", icono: CATEGORIA_ICONO.decoracion, vertical: "Eventos" },
  { label: "Organización", icono: CATEGORIA_ICONO.organizacion, vertical: "Eventos" },
  { label: "Fotografía", icono: <IconCamera />, vertical: "Eventos" },
  { label: "Casas y villas", icono: <IconHouse />, vertical: "Hospedajes" },
];

export default function PublicarPage() {
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <RevealOnScroll />
      <SiteHeader ancho="max-w-[1200px]" />

      {/* ---------- Hero ---------- */}
      <section className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-[18%] -top-[45%] h-[820px] w-[820px] rounded-full bg-aventurea-navy-3/[0.12]" />
          <div className="absolute -left-[22%] top-[25%] h-[680px] w-[680px] rounded-full bg-[#5dc4be]/[0.12] blur-[90px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-aventurea-navy-3/[0.06] to-transparent" />
        </div>

        <div className="mx-auto max-w-[1200px] px-6 pb-14 pt-20 text-center sm:pt-28 lg:px-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-aventurea-line bg-aventurea-surface px-4 py-1.5 text-[12px] font-bold text-aventurea-ink-soft">
            <IconSparkles className="h-3.5 w-3.5 text-aventurea-orange" />
            Bookea para negocios
          </span>

          <h1 className="titulo mx-auto mt-6 max-w-[18ch] text-balance text-[40px] text-aventurea-ink sm:text-[58px]">
            La plataforma de reservas para tu negocio
          </h1>
          <p className="mx-auto mt-5 max-w-[56ch] text-balance text-[16px] leading-relaxed text-aventurea-ink-soft sm:text-[18px]">
            Eventos, citas y hospedajes: tus clientes reservan en línea y vos
            administrás la agenda, el chat, los correos y los cobros — todo en
            un solo lugar.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/mi-rancho/nuevo"
              className="rounded-xl bg-aventurea-orange px-7 py-3.5 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-orange-dark"
            >
              Publicar mi negocio gratis
            </Link>
            <Link
              href="/citas"
              className="rounded-xl border border-aventurea-line bg-aventurea-surface px-7 py-3.5 text-[14.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-orange hover:text-aventurea-orange"
            >
              Ver cómo se ve mi página
            </Link>
          </div>

          {/* Franja de números, honestos y genéricos */}
          <div className="mx-auto mt-14 grid max-w-[900px] grid-cols-2 gap-y-8 border-t border-aventurea-line pt-10 lg:grid-cols-4">
            <Numero dato="3" texto="verticales: eventos, citas y hospedajes" />
            <Numero dato="7 días / 24 h" texto="la plataforma reserva por vos" />
            <Numero dato="0" texto="comisión por publicar tu negocio" />
            <Numero dato="100%" texto="en línea: sin llamadas ni papeleo" />
          </div>
        </div>
      </section>

      {/* ---------- Tipos de negocio ---------- */}
      <section className="py-20">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div data-reveal className="text-center">
            <p className="text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              Para todo negocio que vive de reservas
            </p>
            <h2 className="titulo mt-2 text-[30px] text-aventurea-ink sm:text-[36px]">
              ¿Qué tipo de negocio tenés?
            </h2>
            <p className="mx-auto mt-2.5 max-w-[52ch] text-[14.5px] text-aventurea-ink-soft">
              Si tus clientes reservan una hora, una fecha o una estadía,
              Bookea tiene una página lista para vos.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {TIPOS_NEGOCIO.map((tipo, i) => {
              const estilo = ESTILO_VERTICAL[tipo.vertical];
              return (
                <div
                  key={tipo.label}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 50}ms` } as React.CSSProperties}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl [&_svg]:h-6 [&_svg]:w-6 ${estilo.burbuja}`}
                  >
                    {tipo.icono}
                  </span>
                  <span className="text-[13px] font-bold leading-tight text-aventurea-ink">
                    {tipo.label}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wide ${estilo.tag}`}
                  >
                    {tipo.vertical}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Producto: Citas ---------- */}
      <section
        className="border-t border-[#dceeec] bg-[linear-gradient(175deg,#ffffff_0%,#f3fbfa_45%,#e9f6f5_100%)] py-20"
        style={VARS_CITAS}
      >
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:px-10">
          <div data-reveal>
            <p className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-[#2b8a84]">
              <IconClock className="h-3.5 w-3.5" /> Agendas · Citas y Reservas
            </p>
            <h2 className="titulo mt-3 text-[30px] text-aventurea-ink sm:text-[38px]">
              Tu agenda se llena sola
            </h2>
            <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              El cliente entra a tu página, elige el servicio, la hora y con
              quién — y la cita cae confirmada en tu agenda al instante. Sin
              llamadas ni idas y vueltas por mensajes.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Servicios con duración y precio, como los cobrás vos",
                "Horario semanal y agenda por persona del equipo",
                "Confirmación y recordatorios por correo, automáticos",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] text-aventurea-ink"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e6f6f5] text-[#1f7a74]">
                    <IconCheck className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/mi-rancho/nuevo"
              className="mt-7 inline-flex rounded-xl bg-[#1f7a74] px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#16605b]"
            >
              Crear mi página de citas
            </Link>
          </div>

          {/* Mockup animado: cliente reserva → cae en la agenda */}
          <div
            data-reveal
            className="flex flex-col items-center justify-center gap-5 text-[#1f7a74] md:flex-row md:gap-4"
          >
            <Telefono etiqueta="Tu cliente reserva">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f7a74] text-[10.5px] font-extrabold text-white">
                  UK
                </span>
                <div>
                  <p className="text-[12.5px] font-extrabold leading-tight text-aventurea-ink">
                    Uñas Kathy
                  </p>
                  <p className="flex items-center gap-1 text-[9.5px] font-semibold text-aventurea-ink-soft">
                    <IconStar className="h-2.5 w-2.5 text-aventurea-orange" />
                    4.9 · Uñas · San José
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-[#2b8a84]">
                Elegí tu servicio
              </p>
              <div className="mt-1.5 space-y-1.5">
                <div
                  className="anim-publicar-seleccionar flex items-center justify-between rounded-lg bg-[#e6f6f5] px-2.5 py-2 text-[#0f5b56] [box-shadow:inset_0_0_0_2px_#1f7a74]"
                  style={{ "--pub-delay": "0.2s" } as React.CSSProperties}
                >
                  <span className="text-[11px] font-extrabold">Manicura</span>
                  <span className="text-[9.5px] font-semibold">
                    45 min · ₡12 000
                  </span>
                </div>
                <FilaServicio nombre="Pedicura" detalle="60 min · ₡15 000" />
                <FilaServicio nombre="Uñas acrílicas" detalle="90 min · ₡22 000" />
              </div>

              <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-[#2b8a84]">
                Elegí la hora
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <ChipHora hora="10:00" />
                <span
                  className="anim-publicar-seleccionar rounded-lg bg-[#e6f6f5] py-1.5 text-center text-[10.5px] font-extrabold text-[#0f5b56] [box-shadow:inset_0_0_0_2px_#1f7a74]"
                  style={{ "--pub-delay": "1.3s" } as React.CSSProperties}
                >
                  10:30
                </span>
                <ChipHora hora="11:00" />
              </div>

              <div
                className="anim-publicar-pulsar mt-3 rounded-lg bg-[#1f7a74] py-2 text-center text-[11.5px] font-extrabold text-white"
                style={{ "--pub-delay": "0.2s" } as React.CSSProperties}
              >
                Reservar
              </div>

              <div
                className="anim-publicar-entrar mt-auto flex items-center gap-1.5 rounded-lg bg-[#0f5b56] px-2.5 py-2 text-white"
                style={{ "--pub-delay": "0.3s" } as React.CSSProperties}
              >
                <IconCheck className="h-3 w-3 shrink-0" />
                <span className="text-[10.5px] font-extrabold">
                  ¡Cita confirmada!
                </span>
                <span className="ml-auto text-[9px] opacity-80">Hoy · 10:30</span>
              </div>
            </Telefono>

            <ConectorFlujo texto="y le llega al instante al dueño" />

            <Telefono etiqueta="Y a vos te llega">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-extrabold text-aventurea-ink">
                  Tu agenda
                </p>
                <span className="text-[9.5px] font-bold text-aventurea-ink-soft">
                  Hoy · martes
                </span>
              </div>

              <div
                className="anim-publicar-entrar mt-2.5 flex items-center gap-1.5 rounded-lg bg-[#e6f6f5] px-2.5 py-1.5"
                style={{ "--pub-delay": "0.5s" } as React.CSSProperties}
              >
                <IconCalendarLine className="h-3 w-3 shrink-0 text-[#1f7a74]" />
                <span className="text-[9.5px] font-extrabold text-[#0f5b56]">
                  Nueva reserva de María P.
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <FilaAgenda hora="9:00">
                  <div className="rounded-lg border-l-[3px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2">
                    <p className="text-[10.5px] font-extrabold text-aventurea-ink">
                      Ana R.
                    </p>
                    <p className="text-[9px] font-semibold text-aventurea-ink-soft">
                      Pedicura · 60 min
                    </p>
                  </div>
                </FilaAgenda>
                <FilaAgenda hora="10:00">
                  <div className="rounded-lg border border-dashed border-aventurea-line px-2.5 py-2 text-[9px] font-semibold text-aventurea-ink-soft">
                    Libre
                  </div>
                </FilaAgenda>
                <FilaAgenda hora="10:30">
                  <div
                    className="anim-publicar-entrar rounded-lg border-l-[3px] border-[#1f7a74] bg-[#e6f6f5] px-2.5 py-2"
                    style={{ "--pub-delay": "0.7s" } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[10.5px] font-extrabold text-aventurea-ink">
                        María P.
                      </p>
                      <span className="rounded-full bg-[#1f7a74] px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide text-white">
                        Cita confirmada
                      </span>
                    </div>
                    <p className="mt-0.5 text-[9px] font-semibold text-aventurea-ink-soft">
                      Manicura · 45 min · ₡12 000
                    </p>
                  </div>
                </FilaAgenda>
                <FilaAgenda hora="11:30">
                  <div className="rounded-lg border-l-[3px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2">
                    <p className="text-[10.5px] font-extrabold text-aventurea-ink">
                      Sofía M.
                    </p>
                    <p className="text-[9px] font-semibold text-aventurea-ink-soft">
                      Uñas acrílicas · 90 min
                    </p>
                  </div>
                </FilaAgenda>
              </div>
            </Telefono>
          </div>
        </div>
      </section>

      {/* ---------- Producto: Eventos ---------- */}
      <section
        className="relative isolate overflow-hidden border-t border-aventurea-line py-20"
        style={VARS_EVENTOS}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-[12%] top-[10%] h-[560px] w-[560px] rounded-full bg-aventurea-navy-3/[0.08]" />
          <div className="absolute -right-[10%] bottom-[0%] h-[460px] w-[460px] rounded-full bg-aventurea-orange/[0.07] blur-[80px]" />
        </div>

        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:px-10">
          {/* En desktop el mockup va a la izquierda, alternando con Citas */}
          <div
            data-reveal
            className="order-2 flex flex-col items-center justify-center gap-5 text-aventurea-orange md:flex-row md:gap-4 lg:order-1"
          >
            <Telefono etiqueta="Tu cliente elige la fecha">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[10.5px] font-extrabold text-white">
                  RT
                </span>
                <div>
                  <p className="text-[12.5px] font-extrabold leading-tight text-aventurea-ink">
                    Rancho Las Torres
                  </p>
                  <p className="flex items-center gap-1 text-[9.5px] font-semibold text-aventurea-ink-soft">
                    <IconStar className="h-2.5 w-2.5 text-aventurea-orange" />
                    4.8 · Lugares · Alajuela
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange">
                Agosto
              </p>
              <div className="mt-1.5 grid grid-cols-7 gap-1 text-center">
                {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                  <span
                    key={`${d}-${i}`}
                    className="text-[8px] font-extrabold text-aventurea-ink-soft"
                  >
                    {d}
                  </span>
                ))}
                {Array.from({ length: 14 }, (_, i) => i + 1).map((dia) =>
                  dia === 3 ? (
                    <span
                      key={dia}
                      className="anim-publicar-seleccionar flex h-6 items-center justify-center rounded-md bg-aventurea-orange-light text-[9.5px] font-extrabold text-[#9a4a10] [box-shadow:inset_0_0_0_2px_#ee7420]"
                      style={{ "--pub-delay": "0.2s" } as React.CSSProperties}
                    >
                      {dia}
                    </span>
                  ) : (
                    <span
                      key={dia}
                      className="flex h-6 items-center justify-center rounded-md text-[9.5px] font-bold text-aventurea-ink"
                    >
                      {dia}
                    </span>
                  ),
                )}
              </div>

              <div className="mt-3 rounded-lg bg-aventurea-cream-2 px-2.5 py-2">
                <p className="text-[10px] font-extrabold text-aventurea-ink">
                  Lunes 3 de agosto
                </p>
                <p className="text-[9px] font-semibold text-aventurea-ink-soft">
                  Fiesta · 80 personas
                </p>
              </div>

              <div
                className="anim-publicar-pulsar mt-3 rounded-lg bg-aventurea-orange py-2 text-center text-[11.5px] font-extrabold text-white"
                style={{ "--pub-delay": "0.3s" } as React.CSSProperties}
              >
                Reservar
              </div>

              <div
                className="anim-publicar-entrar mt-auto flex items-center gap-1.5 rounded-lg bg-aventurea-navy px-2.5 py-2 text-white"
                style={{ "--pub-delay": "0.5s" } as React.CSSProperties}
              >
                <IconCheck className="h-3 w-3 shrink-0" />
                <span className="text-[10.5px] font-extrabold">
                  Reserva enviada
                </span>
              </div>
            </Telefono>

            <ConectorFlujo texto="y vos la aprobás con un toque" />

            <Telefono etiqueta="Y vos la aprobás">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-extrabold text-aventurea-ink">
                  Panel de reservas
                </p>
                <span className="text-[9.5px] font-bold text-aventurea-ink-soft">
                  Rancho Las Torres
                </span>
              </div>

              <div className="mt-2.5 rounded-lg border-l-[3px] border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10.5px] font-extrabold text-aventurea-ink">
                    Boda de Laura
                  </p>
                  <span className="rounded-full bg-aventurea-green-light px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide text-aventurea-green">
                    Aprobada
                  </span>
                </div>
                <p className="mt-0.5 text-[9px] font-semibold text-aventurea-ink-soft">
                  12 de julio · 120 personas
                </p>
              </div>

              <div
                className="anim-publicar-entrar mt-2 rounded-xl border border-aventurea-orange/40 bg-white p-2.5 shadow-sm"
                style={{ "--pub-delay": "0.4s" } as React.CSSProperties}
              >
                <span className="rounded-full bg-aventurea-orange-light px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-aventurea-orange">
                  Nueva reserva
                </span>
                <p className="mt-1.5 text-[11px] font-extrabold text-aventurea-ink">
                  Rancho Las Torres · 3 de agosto
                </p>
                <p className="mt-0.5 text-[9px] font-semibold text-aventurea-ink-soft">
                  María J. · 80 personas · Depósito ₡75 000
                </p>
                <div className="mt-2 flex gap-1.5">
                  <span
                    className="anim-publicar-pulsar flex-1 rounded-lg bg-aventurea-green py-1.5 text-center text-[10px] font-extrabold text-white"
                    style={{ "--pub-delay": "1.8s" } as React.CSSProperties}
                  >
                    Aprobar
                  </span>
                  <span className="flex-1 rounded-lg border border-aventurea-line py-1.5 text-center text-[10px] font-bold text-aventurea-ink-soft">
                    Ver detalle
                  </span>
                </div>
              </div>

              <div
                className="anim-publicar-entrar mt-auto flex items-center gap-1.5 rounded-lg bg-aventurea-green px-2.5 py-2 text-white"
                style={{ "--pub-delay": "1.4s" } as React.CSSProperties}
              >
                <IconCheck className="h-3 w-3 shrink-0" />
                <span className="text-[10.5px] font-extrabold">
                  Reserva aprobada
                </span>
                <span className="ml-auto text-[9px] opacity-80">
                  Se le avisó al cliente
                </span>
              </div>
            </Telefono>
          </div>

          <div data-reveal className="order-1 lg:order-2">
            <p className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
              <IconCalendarLine className="h-3.5 w-3.5" /> Eventos
            </p>
            <h2 className="titulo mt-3 text-[30px] text-aventurea-ink sm:text-[38px]">
              Reservas de eventos con fecha y depósito
            </h2>
            <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              El cliente elige la fecha en tu calendario y la solicitud te
              llega completa: fecha, personas y depósito. Vos la aprobás con
              un toque y el cliente recibe el aviso al momento.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Calendario de disponibilidad que se bloquea solo",
                "Depósito con comprobante, directo a tu cuenta",
                "Chat integrado con el pedido del cliente ya armado",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] text-aventurea-ink"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aventurea-orange-light text-aventurea-orange">
                    <IconCheck className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/mi-rancho/nuevo"
              className="mt-7 inline-flex rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Publicar mi salón o servicio
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Producto: Hospedajes (muy pronto) ---------- */}
      <section className="border-t border-aventurea-line bg-aventurea-cream-2 py-20">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:px-10">
          <div data-reveal>
            <p className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-navy-3">
              <IconHouse className="h-3.5 w-3.5" /> Hospedajes
              <span className="rounded-full bg-aventurea-blue-light px-2.5 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-aventurea-navy">
                Muy pronto
              </span>
            </p>
            <h2 className="titulo mt-3 text-[30px] text-aventurea-ink sm:text-[38px]">
              Tu casa o villa, reservada por noches
            </h2>
            <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-aventurea-ink-soft">
              Estamos abriendo la vertical de hospedajes: calendario por
              noches, precios por temporada y cobro directo con quien te
              visita. Publicá tu propiedad desde ya y quedá de primero cuando
              abramos las reservas.
            </p>
            <Link
              href="/mi-rancho/nuevo"
              className="mt-7 inline-flex rounded-xl bg-aventurea-navy px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              Anotar mi propiedad
            </Link>
          </div>

          <div data-reveal className="flex justify-center">
            <div className="anim-publicar-flotar relative w-[300px] overflow-hidden rounded-3xl border border-aventurea-line bg-white shadow-[0_24px_60px_-24px_rgba(16,26,44,0.35)]">
              <span className="absolute right-4 top-4 z-10 rounded-full bg-aventurea-navy px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
                Muy pronto
              </span>
              <div className="flex h-[130px] items-center justify-center bg-[linear-gradient(135deg,#e8f0f9_0%,#dceeec_100%)] text-aventurea-navy-3">
                <IconHouse className="h-12 w-12" />
              </div>
              <div className="p-5">
                <p className="text-[15.5px] font-extrabold text-aventurea-ink">
                  Casa del Lago
                </p>
                <p className="mt-0.5 text-[12px] font-semibold text-aventurea-ink-soft">
                  Playa Hermosa, Guanacaste
                </p>
                <div className="mt-3 grid grid-cols-2 divide-x divide-aventurea-line rounded-xl border border-aventurea-line text-center">
                  <div className="px-3 py-2">
                    <p className="text-[9px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                      Llegada
                    </p>
                    <p className="text-[12px] font-bold text-aventurea-ink">
                      12 set
                    </p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[9px] font-extrabold uppercase tracking-wide text-aventurea-ink-soft">
                      Salida
                    </p>
                    <p className="text-[12px] font-bold text-aventurea-ink">
                      15 set
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-[13px] font-extrabold text-aventurea-ink">
                    ₡85 000{" "}
                    <span className="font-semibold text-aventurea-ink-soft">
                      / noche
                    </span>
                  </p>
                  <span className="rounded-lg bg-aventurea-navy px-4 py-2 text-[12px] font-extrabold text-white">
                    Reservar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Todo incluido ---------- */}
      <section className="border-t border-aventurea-line py-20">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-10">
          <div data-reveal className="text-center">
            <p className="text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              Todo incluido
            </p>
            <h2 className="titulo mt-2 text-[30px] text-aventurea-ink sm:text-[36px]">
              Lo que tu negocio necesita, en un solo lugar
            </h2>
            <p className="mx-auto mt-2.5 max-w-[52ch] text-[14.5px] text-aventurea-ink-soft">
              Sin armar nada con piezas sueltas: publicás y ya tenés página,
              agenda, chat, correos y números.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              index={0}
              icono={<IconGlobe />}
              titulo="Tu página con tu URL"
              texto="Fotos, servicios, precios, redes y mapa — una página profesional con tu propio enlace para compartir."
            />
            <Feature
              index={1}
              icono={<IconCalendarLine />}
              titulo="Agenda y calendario"
              texto="Las reservas caen solas en tu agenda y la disponibilidad se bloquea para que nadie reserve doble."
            />
            <Feature
              index={2}
              icono={<IconChatBubble />}
              titulo="Chat integrado"
              texto="El cliente te escribe dentro de Bookea, con su pedido ya armado. Nada se pierde en conversaciones externas."
            />
            <Feature
              index={3}
              icono={<IconMail />}
              titulo="Correos automáticos"
              texto="Confirmaciones, avisos y recordatorios salen solos — vos no tenés que escribir ni uno."
            />
            <Feature
              index={4}
              icono={<IconStar />}
              titulo="Reseñas verificadas"
              texto="Solo puede opinar quien reservó de verdad. Tu reputación se construye con clientes reales."
            />
            <Feature
              index={5}
              icono={<IconChartBars />}
              titulo="Finanzas claras"
              texto="Cuánto entró, cuánto está por cobrar y qué reservas vienen — tus números siempre a mano."
            />
          </div>
        </div>
      </section>

      {/* ---------- Apps ---------- */}
      <section className="border-t border-aventurea-line bg-aventurea-surface py-20">
        <div className="mx-auto max-w-[1200px] px-6 text-center lg:px-10">
          <div data-reveal>
            <p className="text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              La app de Bookea
            </p>
            <h2 className="titulo mt-2 text-[30px] text-aventurea-ink sm:text-[36px]">
              Llevalo en el bolsillo
            </h2>
            <p className="mx-auto mt-2.5 max-w-[52ch] text-[14.5px] text-aventurea-ink-soft">
              Administrá tu agenda, respondé el chat y aprobá reservas desde
              el teléfono. La app ya existe — las tiendas vienen en camino.
            </p>
          </div>

          <div
            data-reveal
            style={{ "--reveal-delay": "120ms" } as React.CSSProperties}
            className="mt-9 flex flex-wrap items-center justify-center gap-4"
          >
            <BadgeTienda tienda="apple" />
            <BadgeTienda tienda="google" />
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="border-t border-aventurea-line py-20">
        <div className="mx-auto max-w-[760px] px-6">
          <div data-reveal className="text-center">
            <h2 className="titulo text-[30px] text-aventurea-ink sm:text-[36px]">
              Preguntas frecuentes
            </h2>
          </div>

          <div data-reveal className="mt-10 space-y-3">
            <PreguntaFaq pregunta="¿Cuánto cuesta publicar mi negocio?">
              Nada: publicar es gratis y no pedimos tarjeta para empezar.
              Creás tu cuenta, cargás tu negocio y quedás en el directorio.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Cómo me pagan las reservas?">
              Directo y sin intermediarios: el cliente te paga a vos, a tu
              cuenta, con el comprobante dentro de la plataforma. Bookea no
              toca tu plata.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Quién aprueba mi negocio?">
              El equipo de Bookea revisa que tu página esté completa — fotos,
              precios, ubicación — y la publica. Después de eso, todos los
              cambios los hacés vos al instante desde tu panel.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Puedo administrar todo desde el teléfono?">
              Sí: el panel funciona completo en el navegador del teléfono y
              la app de Bookea ya existe — las tiendas vienen en camino.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Necesito saber de tecnología?">
              No: un formulario guiado te va pidiendo fotos, servicios y
              precios, y la página se arma sola. Si te trabás, nos escribís
              por el chat y te ayudamos.
            </PreguntaFaq>
          </div>
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className="px-6 pb-20 lg:px-10">
        <div
          data-reveal
          className="relative isolate mx-auto max-w-[1200px] overflow-hidden rounded-[32px] bg-aventurea-navy px-6 py-16 text-center sm:py-20"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-[10%] -top-[40%] h-[420px] w-[420px] rounded-full bg-white/[0.05]" />
            <div className="absolute -bottom-[45%] -right-[8%] h-[460px] w-[460px] rounded-full bg-aventurea-orange/[0.18] blur-[70px]" />
          </div>
          <h2 className="titulo mx-auto max-w-[22ch] text-balance text-[30px] text-white sm:text-[40px]">
            Empezá a recibir reservas hoy
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/70">
            Publicar es gratis y toma unos minutos. Tu página, tu agenda y tu
            chat quedan listos para que el primer cliente reserve.
          </p>
          <Link
            href="/mi-rancho/nuevo"
            className="mt-8 inline-flex rounded-xl bg-aventurea-orange px-9 py-4 text-[15.5px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-orange-dark"
          >
            Publicar mi negocio gratis
          </Link>
          <p className="mt-4 text-[12.5px] font-semibold text-white/50">
            Gratis · sin tarjeta · en línea en menos de un día
          </p>
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-500">
          BOOKEA — Costa Rica ·{" "}
          <Link href="/eventos" className="font-bold text-aventurea-orange">
            Ver el directorio
          </Link>
        </p>
      </footer>
    </div>
  );
}

/* ---------- Piezas de la página ---------- */

/** Un dato de la franja de números del hero, estilo Fresha. */
function Numero({ dato, texto }: { dato: string; texto: string }) {
  return (
    <div className="px-4">
      <p className="titulo text-[28px] text-aventurea-ink sm:text-[34px]">
        {dato}
      </p>
      <p className="mx-auto mt-1.5 max-w-[20ch] text-[12.5px] leading-snug text-aventurea-ink-soft">
        {texto}
      </p>
    </div>
  );
}

/**
 * El marco de teléfono de los mockups: bisel oscuro, notch y pantalla
 * blanca. Todo el contenido animado vive adentro, en CSS puro.
 */
function Telefono({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      <div className="w-[248px] rounded-[36px] bg-aventurea-ink p-[9px] shadow-[0_24px_60px_-24px_rgba(16,26,44,0.5)]">
        <div className="relative h-[430px] overflow-hidden rounded-[28px] bg-white">
          <div
            aria-hidden
            className="absolute left-1/2 top-2 z-10 h-[15px] w-[76px] -translate-x-1/2 rounded-full bg-aventurea-ink"
          />
          <div className="flex h-full flex-col px-3 pb-3 pt-8">{children}</div>
        </div>
      </div>
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
        {etiqueta}
      </p>
    </div>
  );
}

/** El conector entre los dos teléfonos: puntitos que laten en secuencia. */
function ConectorFlujo({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-2 self-center">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="anim-publicar-punto h-2 w-2 rounded-full bg-current"
            style={{ "--pub-delay": `${i * 0.3}s` } as React.CSSProperties}
          />
        ))}
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
        {texto}
      </p>
    </div>
  );
}

/** Fila de servicio en reposo del mockup de Citas. */
function FilaServicio({ nombre, detalle }: { nombre: string; detalle: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-2.5 py-2 [box-shadow:inset_0_0_0_1.5px_#dceeec]">
      <span className="text-[11px] font-bold text-aventurea-ink">{nombre}</span>
      <span className="text-[9.5px] font-semibold text-aventurea-ink-soft">
        {detalle}
      </span>
    </div>
  );
}

/** Chip de hora en reposo del mockup de Citas. */
function ChipHora({ hora }: { hora: string }) {
  return (
    <span className="rounded-lg py-1.5 text-center text-[10.5px] font-bold text-aventurea-ink [box-shadow:inset_0_0_0_1.5px_#dceeec]">
      {hora}
    </span>
  );
}

/** Fila de la agenda del dueño: la hora al margen y la tarjeta al lado. */
function FilaAgenda({
  hora,
  children,
}: {
  hora: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span className="w-8 shrink-0 pt-1.5 text-right text-[8.5px] font-bold text-aventurea-ink-soft">
        {hora}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Una tarjeta del grid "todo incluido". */
function Feature({
  index,
  icono,
  titulo,
  texto,
}: {
  index: number;
  icono: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div
      data-reveal
      style={{ "--reveal-delay": `${index * 70}ms` } as React.CSSProperties}
      className="rounded-[22px] bg-aventurea-surface p-7 shadow-[0_2px_16px_rgba(16,26,44,0.06)]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-aventurea-orange-light text-aventurea-orange [&_svg]:h-6 [&_svg]:w-6">
        {icono}
      </span>
      <h3 className="titulo mt-5 text-[18px] text-aventurea-ink">{titulo}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-aventurea-ink-soft">
        {texto}
      </p>
    </div>
  );
}

/**
 * Insignias de tienda dibujadas en HTML (sin imágenes externas): la
 * app existe, las tiendas vienen en camino — por eso el "Muy pronto".
 */
function BadgeTienda({ tienda }: { tienda: "apple" | "google" }) {
  return (
    <div className="relative">
      <span className="absolute -right-2 -top-2 z-10 rounded-full bg-aventurea-orange px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
        Muy pronto
      </span>
      <div className="flex w-[190px] items-center gap-3 rounded-2xl bg-aventurea-ink px-5 py-3 text-left text-white opacity-90">
        {tienda === "apple" ? (
          <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="currentColor">
            <path d="M16.4 12.9c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.9-2.2-3Z" />
            <path d="M14.5 6.7c.5-.7.9-1.6.8-2.6-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.6-.8 2.5.9.1 1.8-.4 2.3-1.1Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0">
            <path fill="#69f0ae" d="M5.6 2.8c.3-.4.7-.5 1.1-.3l9.9 5.7-2.8 2.8L5.6 2.8Z" />
            <path fill="#40c4ff" d="M5 3.4v17.2L13.6 12 5 3.4Z" />
            <path fill="#ffd740" d="m13.8 12 2.8-2.8 3.2 1.8c.8.5.8 1.5 0 2l-3.2 1.8-2.8-2.8Z" />
            <path fill="#ff5252" d="m5.6 21.2 8.2-9.2 2.8 2.8-9.9 5.7c-.4.2-.8.1-1.1-.3Z" />
          </svg>
        )}
        <div>
          <p className="text-[9.5px] font-semibold uppercase tracking-wide text-white/60">
            {tienda === "apple" ? "Descargalo en el" : "Disponible en"}
          </p>
          <p className="text-[15px] font-extrabold leading-tight">
            {tienda === "apple" ? "App Store" : "Google Play"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Una pregunta del FAQ con <details>, sin JavaScript. */
function PreguntaFaq({
  pregunta,
  children,
}: {
  pregunta: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-bold text-aventurea-ink [&::-webkit-details-marker]:hidden">
        {pregunta}
        <IconChevronDown className="h-4 w-4 shrink-0 text-aventurea-ink-soft transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        {children}
      </p>
    </details>
  );
}
