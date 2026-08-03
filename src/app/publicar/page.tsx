import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
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
  IconCloche,
  IconGlobe,
  IconHeart,
  IconHouse,
  IconMail,
  IconSparkles,
  IconStar,
  IconStore,
  IconUtensils,
  IconWand,
} from "@/components/icons";
import { CATEGORIA_ICONO } from "../mi-negocio/types";

export const metadata = {
  title: "Bookea para negocios — La plataforma de reservas para tu negocio",
  description:
    "Citas, eventos, restaurantes y hospedajes: tus clientes reservan en línea y vos administrás agenda, chat, correos y cobros en un solo lugar. Publicar es gratis.",
};

/**
 * La landing de ventas para dueños de negocio. Toda la página está
 * armada con la MISMA pieza que el hero: bloques bento de color plano
 * con esquinas de 32px sobre el lienzo gris. Nada de secciones sueltas
 * a página completa — el recorrido tiene que leerse de un tirón.
 *
 * Regla de copy: bloques cortos y muy explicados. Una frase de
 * contexto por bloque y el detalle en viñetas, no en párrafos largos.
 *
 * Los mockups de teléfono son CSS puro (keyframes publicar-* en
 * globals.css). Corren una sola vez y se quedan en su estado final: el
 * mockup se ve completo siempre, no se vacía en cada loop.
 * Todos los CTAs de alta van a /mi-negocio/nuevo.
 */

/** Escena Citas: el azul de la vertical, escena de 8 segundos. */
const VARS_CITAS = {
  "--pub-dur": "8s",
  "--pub-acento": "#3b7fc4",
  "--pub-fondo-acento": "#e8f0f9",
  "--pub-tinta-acento": "#16295e",
  "--pub-linea": "#dbe4f2",
} as React.CSSProperties;

/** Escena Eventos: naranja de la marca, escena de 9 segundos. */
const VARS_EVENTOS = {
  "--pub-dur": "9s",
  "--pub-acento": "#ee7420",
  "--pub-fondo-acento": "#fdeee1",
  "--pub-tinta-acento": "#9a4a10",
  "--pub-linea": "#e2e2e2",
} as React.CSSProperties;

type VerticalNegocio = "Citas" | "Eventos" | "Restaurantes" | "Hospedajes";

/** Los tipos de negocio agrupados por vertical: así el visitante se
 *  ubica de un vistazo en vez de leer doce etiquetas sueltas. */
const GRUPOS_NEGOCIO: {
  vertical: VerticalNegocio;
  pie: string;
  punto: string;
  burbuja: string;
  tipos: { label: string; icono: React.ReactNode }[];
}[] = [
  {
    vertical: "Citas",
    pie: "Reservan una hora",
    punto: "bg-aventurea-blue",
    burbuja: "bg-aventurea-blue-light text-aventurea-navy",
    tipos: [
      { label: "Salones de belleza", icono: <IconSparkles /> },
      { label: "Barberías", icono: <IconStore /> },
      { label: "Uñas", icono: <IconWand /> },
      { label: "Spa y bienestar", icono: <IconHeart /> },
      { label: "Consultorios", icono: <IconClipboard /> },
    ],
  },
  {
    vertical: "Eventos",
    pie: "Reservan una fecha",
    punto: "bg-aventurea-orange",
    burbuja: "bg-aventurea-orange-light text-aventurea-orange",
    tipos: [
      { label: "Salones de eventos", icono: CATEGORIA_ICONO.lugares },
      { label: "Catering", icono: CATEGORIA_ICONO.alimentacion },
      { label: "DJ y música", icono: CATEGORIA_ICONO.animacion },
      { label: "Decoración", icono: CATEGORIA_ICONO.decoracion },
      { label: "Organización", icono: CATEGORIA_ICONO.organizacion },
      { label: "Fotografía", icono: <IconCamera /> },
    ],
  },
  {
    vertical: "Restaurantes",
    pie: "Reservan una mesa",
    punto: "bg-aventurea-green",
    burbuja: "bg-aventurea-green-light text-aventurea-green",
    tipos: [
      { label: "Sodas y comida típica", icono: <IconUtensils /> },
      { label: "Restaurantes y mariscos", icono: <IconCloche /> },
      { label: "Cafeterías y bares", icono: <IconStore /> },
    ],
  },
  {
    vertical: "Hospedajes",
    pie: "Reservan una estadía",
    punto: "bg-aventurea-navy-3",
    burbuja: "bg-aventurea-blue-light text-aventurea-navy-3",
    tipos: [{ label: "Casas y villas", icono: <IconHouse /> }],
  },
];

export default function PublicarPage() {
  return (
    // Lienzo gris: los bloques bento de color viven encima.
    <div className="min-h-screen bg-aventurea-cream-2">
      <RevealOnScroll />
      <SiteHeader ancho="max-w-[1200px]" />

      {/* ---------- Hero bento: el collage de bloques de color ----------
          La línea de diseño de toda la página: bloques grandes de color
          plano con esquinas bien redondeadas sobre el lienzo gris —
          navy para el mensaje, naranja de acento, blanco para datos. */}
      <section className="px-4 pt-6 lg:px-10">
        <div className="mx-auto grid max-w-[1200px] gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* El bloque navy con el mensaje grande. */}
          <div
            data-reveal
            className="relative isolate overflow-hidden rounded-3xl bg-aventurea-navy p-8 sm:p-12"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-aventurea-navy-3/60 blur-2xl"
            />
            <span className="inline-flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-aventurea-orange">
              <IconSparkles className="h-3.5 w-3.5" />
              Bookea para negocios
            </span>
            <h1 className="titulo mt-5 max-w-[14ch] text-balance text-[38px] text-white sm:text-[54px]">
              La plataforma de reservas para tu negocio
            </h1>
            <p className="mt-5 max-w-[46ch] text-balance text-[15.5px] leading-relaxed text-white/80 sm:text-[17px]">
              Citas, eventos, restaurantes y hospedajes: tus clientes reservan
              en línea y vos administrás la agenda, el chat, los correos y los
              cobros — todo en un solo lugar.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/mi-negocio/nuevo"
                className="rounded-xl bg-aventurea-orange px-7 py-3.5 text-[14.5px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-orange-dark"
              >
                Publicar mi negocio gratis
              </Link>
              <Link
                href="/citas"
                className="rounded-xl bg-white px-7 py-3.5 text-[14.5px] font-bold text-aventurea-navy transition-colors hover:bg-white/90"
              >
                Ver cómo se ve mi página
              </Link>
            </div>
          </div>

          {/* La columna de acento: azulejo naranja + tarjeta de números. */}
          <div className="grid gap-4">
            <div
              data-reveal
              style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
              className="relative flex min-h-[190px] items-end overflow-hidden rounded-3xl bg-aventurea-orange p-7"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- logo estático */}
              <img
                src="/logo-bookea-blanco.png"
                alt=""
                aria-hidden
                className="absolute right-6 top-6 h-8 w-auto opacity-95"
              />
              <p className="max-w-[22ch] text-[18px] font-extrabold leading-snug text-white">
                Tus clientes reservan solos — la agenda se llena mientras
                trabajás.
              </p>
            </div>
            <div
              data-reveal
              style={{ "--reveal-delay": "160ms" } as React.CSSProperties}
              className="rounded-3xl border border-aventurea-line bg-white p-7"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-7">
                <Numero dato="4" texto="verticales: citas, eventos, restaurantes y hospedajes" />
                <Numero dato="7 días / 24 h" texto="la plataforma reserva por vos" />
                <Numero dato="0" texto="comisión por publicar tu negocio" />
                <Numero dato="100%" texto="en línea: sin llamadas ni papeleo" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Tipos de negocio: un solo bloque, no una pantalla
           entera de tarjetas. El título a la izquierda y los tipos
           agrupados por vertical a la derecha. ---------- */}
      <Bento className="border border-aventurea-line bg-white">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div data-reveal>
            <Eyebrow>Para quién es</Eyebrow>
            <h2 className="titulo mt-2.5 text-[27px] text-aventurea-ink sm:text-[32px]">
              ¿Qué tipo de negocio tenés?
            </h2>
            <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              Si tus clientes reservan una hora, una fecha, una mesa o una
              estadía, Bookea ya tiene una página lista para vos.
            </p>
          </div>

          <div
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
            className="grid gap-6 sm:grid-cols-2"
          >
            {GRUPOS_NEGOCIO.map((grupo) => (
              <div key={grupo.vertical}>
                <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink">
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${grupo.punto}`}
                  />
                  {grupo.vertical}
                </p>
                <p className="mt-1 text-[11.5px] font-semibold text-aventurea-ink-soft">
                  {grupo.pie}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {grupo.tipos.map((tipo) => (
                    <li
                      key={tipo.label}
                      className="flex items-center gap-2 text-[13px] font-bold text-aventurea-ink"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5 ${grupo.burbuja}`}
                      >
                        {tipo.icono}
                      </span>
                      {tipo.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Bento>

      {/* ---------- Producto: Citas — bento azul ---------- */}
      <Bento className="bg-aventurea-blue-light" style={VARS_CITAS}>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div data-reveal>
            <Eyebrow tono="text-aventurea-navy-3">
              <IconClock className="h-3.5 w-3.5" /> Citas y reservas
            </Eyebrow>
            <h2 className="titulo mt-2.5 text-[27px] text-aventurea-ink sm:text-[34px]">
              Tu agenda se llena sola
            </h2>
            <p className="mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              El cliente elige servicio y hora en tu página, y la cita cae
              confirmada en tu agenda. Sin llamadas ni idas y vueltas.
            </p>
            <ListaCheck
              tono="bg-aventurea-blue-light text-aventurea-navy"
              items={[
                "Servicios con su duración y su precio, como los cobrás vos",
                "Horario semanal y agenda propia para cada persona del equipo",
                "Confirmación y recordatorio por correo, automáticos",
              ]}
            />
            <Link
              href="/mi-negocio/nuevo"
              className="mt-6 inline-flex rounded-xl bg-aventurea-navy px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              Crear mi página de citas
            </Link>
          </div>

          {/* Mockup: el cliente reserva → le cae al dueño en la agenda.
              Sin data-reveal a propósito: tiene que verse siempre. */}
          <div className="flex flex-col items-center justify-center gap-5 text-aventurea-navy-3 md:flex-row md:gap-4">
            <Telefono etiqueta="Tu cliente reserva">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aventurea-navy text-[10.5px] font-extrabold text-white">
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

              <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-navy-3">
                Elegí tu servicio
              </p>
              <div className="mt-1.5 space-y-1.5">
                <div
                  className="anim-publicar-seleccionar flex items-center justify-between rounded-lg bg-aventurea-blue-light px-2.5 py-2 text-aventurea-navy [box-shadow:inset_0_0_0_2px_#16295e]"
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

              <p className="mt-3 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-navy-3">
                Elegí la hora
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                <ChipHora hora="10:00" />
                <span
                  className="anim-publicar-seleccionar rounded-lg bg-aventurea-blue-light py-1.5 text-center text-[10.5px] font-extrabold text-aventurea-navy [box-shadow:inset_0_0_0_2px_#16295e]"
                  style={{ "--pub-delay": "1.3s" } as React.CSSProperties}
                >
                  10:30
                </span>
                <ChipHora hora="11:00" />
              </div>

              <div
                className="anim-publicar-pulsar mt-3 rounded-lg bg-aventurea-navy py-2 text-center text-[11.5px] font-extrabold text-white"
                style={{ "--pub-delay": "0.2s" } as React.CSSProperties}
              >
                Reservar
              </div>

              <div
                className="anim-publicar-entrar mt-auto flex items-center gap-1.5 rounded-lg bg-aventurea-navy px-2.5 py-2 text-white"
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
                className="anim-publicar-entrar mt-2.5 flex items-center gap-1.5 rounded-lg bg-aventurea-blue-light px-2.5 py-1.5"
                style={{ "--pub-delay": "0.5s" } as React.CSSProperties}
              >
                <IconCalendarLine className="h-3 w-3 shrink-0 text-aventurea-blue" />
                <span className="text-[9.5px] font-extrabold text-aventurea-navy">
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
                    className="anim-publicar-entrar rounded-lg border-l-[3px] border-aventurea-navy bg-aventurea-blue-light px-2.5 py-2"
                    style={{ "--pub-delay": "0.7s" } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[10.5px] font-extrabold text-aventurea-ink">
                        María P.
                      </p>
                      <span className="rounded-lg bg-aventurea-navy px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide text-white">
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
      </Bento>

      {/* ---------- Producto: Eventos — bento naranja ---------- */}
      <Bento
        className="relative isolate bg-aventurea-orange-light"
        style={VARS_EVENTOS}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-[12%] top-[10%] h-[560px] w-[560px] rounded-full bg-aventurea-navy-3/[0.08]" />
          <div className="absolute -right-[10%] bottom-[0%] h-[460px] w-[460px] rounded-full bg-aventurea-orange/[0.07] blur-[80px]" />
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          {/* En desktop el mockup va a la izquierda, alternando con Citas.
              Tampoco lleva data-reveal: se ve desde el primer momento. */}
          <div className="order-2 flex flex-col items-center justify-center gap-5 text-aventurea-orange md:flex-row md:gap-4 lg:order-1">
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
                  <span className="rounded-lg bg-aventurea-green-light px-1.5 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide text-aventurea-green">
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
                <span className="rounded-lg bg-aventurea-orange-light px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-aventurea-orange">
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
            <Eyebrow tono="text-aventurea-orange">
              <IconCalendarLine className="h-3.5 w-3.5" /> Eventos
            </Eyebrow>
            <h2 className="titulo mt-2.5 text-[27px] text-aventurea-ink sm:text-[34px]">
              Fecha y depósito, resueltos
            </h2>
            <p className="mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              El cliente elige la fecha en tu calendario y la solicitud te
              llega completa. Vos la aprobás con un toque.
            </p>
            <ListaCheck
              tono="bg-aventurea-orange-light text-aventurea-orange"
              items={[
                "Calendario de disponibilidad que se bloquea solo",
                "Depósito con comprobante, directo a tu cuenta",
                "Chat integrado con el pedido del cliente ya armado",
              ]}
            />
            <Link
              href="/mi-negocio/nuevo"
              className="mt-6 inline-flex rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Publicar mi salón o servicio
            </Link>
          </div>
        </div>
      </Bento>

      {/* ---------- Lo que viene: hospedajes y la app, en una sola fila.
           Los dos son "muy pronto" — juntos ocupan un bloque en vez de
           dos pantallas. ---------- */}
      <section className="mx-4 my-4 lg:mx-auto lg:max-w-[1200px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            data-reveal
            className="rounded-3xl border border-aventurea-line bg-white p-8 sm:p-10"
          >
            <Eyebrow tono="text-aventurea-navy-3">
              <IconHouse className="h-3.5 w-3.5" /> Hospedajes
              <ChipPronto />
            </Eyebrow>
            <h2 className="titulo mt-2.5 text-[26px] text-aventurea-ink">
              Tu casa o villa, por noches
            </h2>
            <p className="mt-3 max-w-[44ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
              Calendario por noches, precios por temporada y cobro directo.
              Anotá tu propiedad ya y quedá de primero cuando abramos.
            </p>

            <div className="anim-publicar-flotar mt-7 overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_18px_44px_-22px_rgba(16,26,44,0.35)]">
              <div className="flex items-center gap-4 p-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-aventurea-blue-light text-aventurea-navy-3 [&_svg]:h-7 [&_svg]:w-7">
                  <IconHouse />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold text-aventurea-ink">
                    Casa del Lago
                  </p>
                  <p className="text-[11.5px] font-semibold text-aventurea-ink-soft">
                    Playa Hermosa · 12–15 set
                  </p>
                </div>
                <p className="shrink-0 text-right text-[13px] font-extrabold text-aventurea-ink">
                  ₡85 000
                  <span className="block text-[10px] font-semibold text-aventurea-ink-soft">
                    por noche
                  </span>
                </p>
              </div>
            </div>

            <Link
              href="/mi-negocio/nuevo"
              className="mt-6 inline-flex rounded-xl bg-aventurea-navy px-6 py-3 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
            >
              Anotar mi propiedad
            </Link>
          </div>

          <div
            data-reveal
            style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
            className="relative isolate overflow-hidden rounded-3xl bg-aventurea-navy p-8 sm:p-10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-aventurea-orange/20 blur-[70px]"
            />
            <Eyebrow tono="text-aventurea-orange">
              <IconSparkles className="h-3.5 w-3.5" /> La app de Bookea
              <ChipPronto />
            </Eyebrow>
            <h2 className="titulo mt-2.5 text-[26px] text-white">
              Llevalo en el bolsillo
            </h2>
            <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-white/75">
              Agenda, chat y aprobación de reservas desde el teléfono. La app
              ya existe — las tiendas vienen en camino.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <BadgeTienda tienda="apple" />
              <BadgeTienda tienda="google" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Todo incluido: un bloque, seis piezas cortas ------ */}
      <Bento className="border border-aventurea-line bg-white">
        <div data-reveal className="max-w-[52ch]">
          <Eyebrow>Todo incluido</Eyebrow>
          <h2 className="titulo mt-2.5 text-[27px] text-aventurea-ink sm:text-[32px]">
            Lo que tu negocio necesita, en un solo lugar
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-aventurea-ink-soft">
            Publicás una vez y ya tenés página, agenda, chat, correos y
            números. Nada que armar con piezas sueltas.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            index={0}
            icono={<IconGlobe />}
            titulo="Tu página con tu URL"
            texto="Fotos, servicios, precios, redes y mapa en un enlace propio para compartir."
          />
          <Feature
            index={1}
            icono={<IconCalendarLine />}
            titulo="Agenda y calendario"
            texto="Las reservas caen solas y la disponibilidad se bloquea: nadie reserva doble."
          />
          <Feature
            index={2}
            icono={<IconChatBubble />}
            titulo="Chat integrado"
            texto="El cliente te escribe dentro de Bookea, con su pedido ya armado."
          />
          <Feature
            index={3}
            icono={<IconMail />}
            titulo="Correos automáticos"
            texto="Confirmaciones, avisos y recordatorios salen solos. Vos no escribís ninguno."
          />
          <Feature
            index={4}
            icono={<IconStar />}
            titulo="Reseñas verificadas"
            texto="Solo opina quien reservó de verdad: tu reputación se construye con clientes reales."
          />
          <Feature
            index={5}
            icono={<IconChartBars />}
            titulo="Finanzas claras"
            texto="Cuánto entró, cuánto está por cobrar y qué reservas vienen, siempre a mano."
          />
        </div>
      </Bento>

      {/* ---------- FAQ ---------- */}
      <Bento className="border border-aventurea-line bg-white">
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-12">
          <div data-reveal>
            <Eyebrow>Antes de empezar</Eyebrow>
            <h2 className="titulo mt-2.5 text-[27px] text-aventurea-ink sm:text-[32px]">
              Preguntas frecuentes
            </h2>
          </div>

          <div data-reveal className="space-y-2.5">
            <PreguntaFaq pregunta="¿Cuánto cuesta publicar mi negocio?">
              Nada, y no pedimos tarjeta para empezar. Creás tu cuenta,
              cargás tu negocio y quedás en el directorio.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Cómo me pagan las reservas?">
              Directo a tu cuenta, sin intermediarios: el cliente te paga a
              vos y deja el comprobante en la plataforma. Bookea no toca tu
              plata.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Quién aprueba mi negocio?">
              El equipo de Bookea revisa que tu página esté completa —fotos,
              precios, ubicación— y la publica. Después los cambios los hacés
              vos al instante desde tu panel.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Puedo administrar todo desde el teléfono?">
              Sí: el panel funciona completo en el navegador del teléfono y la
              app de Bookea ya existe.
            </PreguntaFaq>
            <PreguntaFaq pregunta="¿Necesito saber de tecnología?">
              No: un formulario guiado te va pidiendo fotos, servicios y
              precios, y la página se arma sola. Si te trabás, te ayudamos por
              el chat.
            </PreguntaFaq>
          </div>
        </div>
      </Bento>

      {/* ---------- Cierre ---------- */}
      <section className="px-4 pb-10 pt-0 lg:px-10">
        <div
          data-reveal
          className="relative isolate mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-aventurea-navy px-6 py-14 text-center"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-[10%] -top-[40%] h-[420px] w-[420px] rounded-full bg-white/[0.05]" />
            <div className="absolute -bottom-[45%] -right-[8%] h-[460px] w-[460px] rounded-full bg-aventurea-orange/[0.18] blur-[70px]" />
          </div>
          <h2 className="titulo mx-auto max-w-[22ch] text-balance text-[30px] text-white sm:text-[38px]">
            Empezá a recibir reservas hoy
          </h2>
          <p className="mx-auto mt-3.5 max-w-[44ch] text-[14.5px] leading-relaxed text-white/70">
            Publicar es gratis y toma unos minutos. Tu página, tu agenda y tu
            chat quedan listos para el primer cliente.
          </p>
          <Link
            href="/mi-negocio/nuevo"
            className="mt-7 inline-flex rounded-xl bg-aventurea-orange px-9 py-4 text-[15.5px] font-bold text-white shadow-sm transition-colors hover:bg-aventurea-orange-dark"
          >
            Publicar mi negocio gratis
          </Link>
          <p className="mt-4 text-[12.5px] font-semibold text-white/50">
            Gratis · sin tarjeta · en línea en menos de un día
          </p>
        </div>
      </section>

      {/* El pie compartido, que además es donde viven los enlaces a los
          términos, las políticas y la privacidad. */}
      <SiteFooter />
    </div>
  );
}

/* ---------- Piezas de la página ---------- */

/**
 * El bloque bento: la única unidad de layout de la página. Mismo ancho,
 * mismas esquinas y mismo aire para todos, así el scroll tiene un ritmo
 * parejo en vez de secciones de alturas distintas.
 */
function Bento({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <section
      style={style}
      className={`mx-4 my-4 overflow-hidden rounded-3xl p-8 sm:p-10 lg:mx-auto lg:max-w-[1200px] lg:p-12 ${className}`}
    >
      {children}
    </section>
  );
}

/** El rótulo chiquito que encabeza cada bloque. */
function Eyebrow({
  tono = "text-aventurea-orange",
  children,
}: {
  tono?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] ${tono}`}
    >
      {children}
    </p>
  );
}

/** La etiqueta "muy pronto" de las verticales que aún no abren. */
function ChipPronto() {
  return (
    <span className="rounded-lg bg-aventurea-orange-light px-2.5 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-aventurea-orange">
      Muy pronto
    </span>
  );
}

/** Las viñetas con check que explican cada vertical. */
function ListaCheck({ tono, items }: { tono: string; items: string[] }) {
  return (
    <ul className="mt-5 space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-[13.5px] leading-snug text-aventurea-ink"
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tono}`}
          >
            <IconCheck className="h-3 w-3" />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Un dato de la tarjeta de números del hero. */
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
            className="absolute left-1/2 top-2 z-10 h-[15px] w-[76px] -translate-x-1/2 rounded-xl bg-aventurea-ink"
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
    <div className="flex items-center justify-between rounded-lg px-2.5 py-2 [box-shadow:inset_0_0_0_1.5px_#dbe4f2]">
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
    <span className="rounded-lg py-1.5 text-center text-[10.5px] font-bold text-aventurea-ink [box-shadow:inset_0_0_0_1.5px_#dbe4f2]">
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

/**
 * Una pieza del bloque "todo incluido". Sin tarjeta propia: dentro de
 * un bento, una tarjeta adentro de otra tarjeta es ruido.
 */
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
      style={{ "--reveal-delay": `${index * 60}ms` } as React.CSSProperties}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-aventurea-orange-light text-aventurea-orange [&_svg]:h-5 [&_svg]:w-5">
        {icono}
      </span>
      <h3 className="mt-3.5 text-[15.5px] font-extrabold text-aventurea-ink">
        {titulo}
      </h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        {texto}
      </p>
    </div>
  );
}

/**
 * Insignias de tienda dibujadas en HTML (sin imágenes externas): la
 * app existe, las tiendas vienen en camino.
 */
function BadgeTienda({ tienda }: { tienda: "apple" | "google" }) {
  return (
    <div className="flex w-[175px] items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left text-white [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.18)]">
      {tienda === "apple" ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor">
          <path d="M16.4 12.9c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.9-2.2-3Z" />
          <path d="M14.5 6.7c.5-.7.9-1.6.8-2.6-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.6-.8 2.5.9.1 1.8-.4 2.3-1.1Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0">
          <path fill="#69f0ae" d="M5.6 2.8c.3-.4.7-.5 1.1-.3l9.9 5.7-2.8 2.8L5.6 2.8Z" />
          <path fill="#40c4ff" d="M5 3.4v17.2L13.6 12 5 3.4Z" />
          <path fill="#ffd740" d="m13.8 12 2.8-2.8 3.2 1.8c.8.5.8 1.5 0 2l-3.2 1.8-2.8-2.8Z" />
          <path fill="#ff5252" d="m5.6 21.2 8.2-9.2 2.8 2.8-9.9 5.7c-.4.2-.8.1-1.1-.3Z" />
        </svg>
      )}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-white/60">
          {tienda === "apple" ? "Descargalo en el" : "Disponible en"}
        </p>
        <p className="text-[13.5px] font-extrabold leading-tight">
          {tienda === "apple" ? "App Store" : "Google Play"}
        </p>
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
    <details className="group rounded-2xl bg-aventurea-cream-2 px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-bold text-aventurea-ink [&::-webkit-details-marker]:hidden">
        {pregunta}
        <IconChevronDown className="h-4 w-4 shrink-0 text-aventurea-ink-soft transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        {children}
      </p>
    </details>
  );
}
