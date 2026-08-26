import type { Metadata } from "next";
import Link from "next/link";
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
import EscenaCitas from "./escena-citas";
import EscenaEventos from "./escena-eventos";
import LogoGooglePlay from "@/components/logo-google-play";

/**
 * /publicar — rediseño completo con la misma línea que /lealtad e
 * /invitaciones: navy de punta a punta, tipografía grande, sin el
 * header/footer del sitio (landing inmersiva), y los dos mockups de
 * teléfono (Citas y Eventos) vestidos de oscuro — ver escena-citas.tsx
 * y escena-eventos.tsx, que reusan las keyframes `publicar-*` que ya
 * existían en globals.css (no se tocaron, solo se vistieron distinto).
 *
 * El bento claro que había antes queda documentado en el historial de
 * git si hace falta volver a mirarlo.
 */

const NAVY_PROFUNDO = "#0a1226";
const NAVY = "#16295e";
const NARANJA = "#ee7420";

export const metadata: Metadata = {
  title: "Bookea para negocios",
  description:
    "Citas, eventos, restaurantes y hospedajes: tus clientes reservan en línea y vos administrás agenda, chat, correos y cobros en un solo lugar. Publicar es gratis.",
};

type VerticalNegocio = "Citas" | "Eventos" | "Restaurantes" | "Hospedajes";

const GRUPOS_NEGOCIO: {
  vertical: VerticalNegocio;
  pie: string;
  punto: string;
  tipos: { label: string; icono: React.ReactNode }[];
}[] = [
  {
    vertical: "Citas",
    pie: "Reservan una hora",
    punto: "#3b7fc4",
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
    punto: NARANJA,
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
    punto: "#5fd39a",
    tipos: [
      { label: "Sodas y comida típica", icono: <IconUtensils /> },
      { label: "Restaurantes y mariscos", icono: <IconCloche /> },
      { label: "Cafeterías y bares", icono: <IconStore /> },
    ],
  },
  {
    vertical: "Hospedajes",
    pie: "Reservan una estadía",
    punto: "#8aa0d6",
    tipos: [{ label: "Casas y villas", icono: <IconHouse /> }],
  },
];

export default function PublicarPage() {
  return (
    <main className="min-h-svh" style={{ background: NAVY_PROFUNDO, color: "#ffffff" }}>
      <RevealOnScroll />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden px-5 py-24 sm:px-8 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[22%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-[130px]"
          style={{ background: NARANJA }}
        />
        <div className="relative mx-auto w-full max-w-[1080px] text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
            Bookea para negocios
          </p>
          <h1 className="titulo mx-auto mt-5 max-w-[16ch] text-balance text-[clamp(38px,7vw,76px)] leading-[1.04]">
            La plataforma de reservas para tu negocio
          </h1>
          <p className="mx-auto mt-6 max-w-[52ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/60">
            Citas, eventos, restaurantes y hospedajes: tus clientes reservan
            en línea y vos administrás la agenda, el chat, los correos y los
            cobros — todo en un solo lugar.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/mi-negocio/nuevo"
              className="rounded-full px-7 py-3.5 text-[14.5px] font-bold text-white transition-transform hover:scale-[1.03]"
              style={{ background: NARANJA }}
            >
              Publicar mi negocio gratis
            </Link>
            <Link
              href="/publicar/ejemplos"
              className="rounded-full border border-white/25 px-7 py-3.5 text-[14.5px] font-bold text-white/90 transition-colors hover:border-white/60"
            >
              Ver cómo se ve mi página
            </Link>
          </div>

          {/* La fila de números — antes vivía en una tarjeta bento
              aparte; acá es una barra minimalista, sin cajas. */}
          <div className="mx-auto mt-16 grid max-w-[720px] grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            <Dato numero="4" texto="verticales en una cuenta" />
            <Dato numero="0" texto="comisión por publicar" />
            <Dato numero="24/7" texto="la plataforma reserva por vos" />
            <Dato numero="100%" texto="en línea, sin papeleo" />
          </div>
        </div>
      </section>

      {/* ================= QUÉ TIPO DE NEGOCIO ================= */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto w-full max-w-[1080px]">
          <div data-reveal className="mx-auto max-w-[52ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Para quién es
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(28px,4.6vw,46px)] leading-[1.08]">
              ¿Qué tipo de negocio tenés?
            </h2>
            <p className="mx-auto mt-4 text-[15px] leading-relaxed text-white/55">
              Si tus clientes reservan una hora, una fecha, una mesa o una
              estadía, Bookea ya tiene una página lista para vos.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GRUPOS_NEGOCIO.map((grupo, i) => (
              <div
                key={grupo.vertical}
                data-reveal
                style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
                className="rounded-3xl border border-white/12 p-6"
              >
                <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: grupo.punto }} />
                  {grupo.vertical}
                </p>
                <p className="mt-1 text-[11.5px] font-semibold text-white/45">{grupo.pie}</p>
                <ul className="mt-4 space-y-2">
                  {grupo.tipos.map((tipo) => (
                    <li key={tipo.label} className="flex items-center gap-2.5 text-[13px] font-bold text-white/85">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
                        style={{ background: "rgba(255,255,255,.08)" }}
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
      </section>

      {/* ================= PRODUCTO: CITAS ================= */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-24" style={{ background: NAVY }}>
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: "#3b7fc4" }}
        />
        <div className="relative mx-auto w-full max-w-[1120px]">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
            <div data-reveal>
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: "#7fb1e8" }}>
                <IconClock className="h-3.5 w-3.5" /> Citas y reservas
              </p>
              <h2 className="titulo mt-4 max-w-[17ch] text-[clamp(28px,4.4vw,46px)] leading-[1.1]">
                Tu agenda se llena sola
              </h2>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/55">
                El cliente elige servicio y hora en tu página, y la cita cae
                confirmada en tu agenda. Sin llamadas ni idas y vueltas.
              </p>

              <ul className="mt-7 flex flex-col gap-3">
                {[
                  "Servicios con su duración y su precio, como los cobrás vos",
                  "Horario semanal y agenda propia para cada persona del equipo",
                  "Confirmación y recordatorio por correo, automáticos",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-white/80">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(59,127,196,.22)", color: "#7fb1e8" }}
                    >
                      <IconCheck className="h-3 w-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/mi-negocio/nuevo"
                className="mt-8 inline-flex rounded-full px-7 py-3.5 text-[14px] font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ background: "#3b7fc4" }}
              >
                Crear mi página de citas
              </Link>
            </div>

            <div data-reveal style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
              <EscenaCitas />
            </div>
          </div>
        </div>
      </section>

      {/* ================= PRODUCTO: EVENTOS ================= */}
      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div data-reveal className="order-2 lg:order-1">
              <EscenaEventos />
            </div>

            <div data-reveal className="order-1 lg:order-2">
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
                <IconCalendarLine className="h-3.5 w-3.5" /> Eventos
              </p>
              <h2 className="titulo mt-4 max-w-[17ch] text-[clamp(28px,4.4vw,46px)] leading-[1.1]">
                Fecha y depósito, resueltos
              </h2>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/55">
                El cliente elige la fecha en tu calendario y la solicitud te
                llega completa. Vos la aprobás con un toque.
              </p>

              <ul className="mt-7 flex flex-col gap-3">
                {[
                  "Calendario de disponibilidad que se bloquea solo",
                  "Depósito con comprobante, directo a tu cuenta",
                  "Chat integrado con el pedido del cliente ya armado",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-white/80">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(238,116,32,.18)", color: NARANJA }}
                    >
                      <IconCheck className="h-3 w-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href="/mi-negocio/nuevo"
                className="mt-8 inline-flex rounded-full px-7 py-3.5 text-[14px] font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ background: NARANJA }}
              >
                Publicar mi salón o servicio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOSPEDAJES + APP (muy pronto) ================= */}
      <section className="px-5 py-20 sm:px-8" style={{ background: NAVY }}>
        <div className="mx-auto grid w-full max-w-[1120px] gap-4 lg:grid-cols-2">
          <div data-reveal className="rounded-3xl border border-white/12 p-8 sm:p-10">
            <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: "#8aa0d6" }}>
              <IconHouse className="h-3.5 w-3.5" /> Hospedajes
              <ChipPronto />
            </p>
            <h2 className="titulo mt-3 text-[26px] leading-tight">Tu casa o villa, por noches</h2>
            <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-white/55">
              Calendario por noches, precios por temporada y cobro directo.
              Anotá tu propiedad ya y quedá de primero cuando abramos.
            </p>

            <div
              className="anim-publicar-flotar mt-7 flex items-center gap-4 rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}
            >
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl [&_svg]:h-7 [&_svg]:w-7"
                style={{ background: "rgba(138,160,214,.18)", color: "#8aa0d6" }}
              >
                <IconHouse />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold text-white">Casa del Lago</p>
                <p className="text-[11.5px] font-semibold text-white/50">Playa Hermosa · 12–15 set</p>
              </div>
              <p className="shrink-0 text-right text-[13px] font-extrabold text-white">
                ₡85 000
                <span className="block text-[10px] font-semibold text-white/45">por noche</span>
              </p>
            </div>

            <Link
              href="/mi-negocio/nuevo"
              className="mt-7 inline-flex rounded-full border border-white/25 px-6 py-3 text-[13.5px] font-bold text-white/90 transition-colors hover:border-white/60"
            >
              Anotar mi propiedad
            </Link>
          </div>

          <div data-reveal style={{ "--reveal-delay": "80ms" } as React.CSSProperties} className="rounded-3xl border border-white/12 p-8 sm:p-10">
            <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: NARANJA }}>
              <IconSparkles className="h-3.5 w-3.5" /> La app de Bookea
              <ChipPronto />
            </p>
            <h2 className="titulo mt-3 text-[26px] leading-tight">Llevalo en el bolsillo</h2>
            <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-white/55">
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

      {/* ================= TODO INCLUIDO ================= */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto w-full max-w-[1080px]">
          <div data-reveal className="mx-auto max-w-[54ch] text-center">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
              Todo incluido
            </p>
            <h2 className="titulo mx-auto mt-4 max-w-[22ch] text-[clamp(28px,4.6vw,46px)] leading-[1.08]">
              Lo que tu negocio necesita, en un solo lugar
            </h2>
            <p className="mx-auto mt-4 text-[15px] leading-relaxed text-white/55">
              Publicás una vez y ya tenés página, agenda, chat, correos y
              números. Nada que armar con piezas sueltas.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            <Feature index={0} icono={<IconGlobe />} titulo="Tu página con tu URL" texto="Fotos, servicios, precios, redes y mapa en un enlace propio para compartir." />
            <Feature index={1} icono={<IconCalendarLine />} titulo="Agenda y calendario" texto="Las reservas caen solas y la disponibilidad se bloquea: nadie reserva doble." />
            <Feature index={2} icono={<IconChatBubble />} titulo="Chat integrado" texto="El cliente te escribe dentro de Bookea, con su pedido ya armado." />
            <Feature index={3} icono={<IconMail />} titulo="Correos automáticos" texto="Confirmaciones, avisos y recordatorios salen solos. Vos no escribís ninguno." />
            <Feature index={4} icono={<IconStar />} titulo="Reseñas verificadas" texto="Solo opina quien reservó de verdad: tu reputación se construye con clientes reales." />
            <Feature index={5} icono={<IconChartBars />} titulo="Finanzas claras" texto="Cuánto entró, cuánto está por cobrar y qué reservas vienen, siempre a mano." />
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="px-5 py-20 sm:px-8" style={{ background: NAVY }}>
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14">
            <div data-reveal>
              <p className="text-[12px] font-bold uppercase tracking-[0.22em]" style={{ color: NARANJA }}>
                Antes de empezar
              </p>
              <h2 className="titulo mt-4 text-[clamp(26px,4vw,38px)] leading-[1.1]">Preguntas frecuentes</h2>
            </div>

            <div data-reveal className="flex flex-col gap-2.5">
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
                El equipo de Bookea revisa que tu página esté completa
                —fotos, precios, ubicación— y la publica. Después los
                cambios los hacés vos al instante desde tu panel.
              </PreguntaFaq>
              <PreguntaFaq pregunta="¿Puedo administrar todo desde el teléfono?">
                Sí: el panel funciona completo en el navegador del teléfono y
                la app de Bookea ya existe.
              </PreguntaFaq>
              <PreguntaFaq pregunta="¿Necesito saber de tecnología?">
                No: un formulario guiado te va pidiendo fotos, servicios y
                precios, y la página se arma sola. Si te trabás, te ayudamos
                por el chat.
              </PreguntaFaq>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CIERRE ================= */}
      <section className="px-5 py-28 text-center sm:px-8">
        <div data-reveal className="mx-auto w-full max-w-[760px]">
          <h2 className="titulo text-[clamp(32px,5.6vw,64px)] leading-[1.04]">
            Empezá a recibir reservas hoy.
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[clamp(15px,1.8vw,19px)] leading-relaxed text-white/60">
            Publicar es gratis y toma unos minutos. Tu página, tu agenda y tu
            chat quedan listos para el primer cliente.
          </p>
          <Link
            href="/mi-negocio/nuevo"
            className="mt-9 inline-block rounded-full px-9 py-4 text-[15px] font-bold text-white transition-transform hover:scale-[1.03]"
            style={{ background: NARANJA }}
          >
            Publicar mi negocio gratis
          </Link>
          <p className="mt-4 text-[12.5px] font-semibold text-white/40">
            Gratis · sin tarjeta · en línea en menos de un día
          </p>
        </div>
      </section>
    </main>
  );
}

/* ---------- Piezas de la página ---------- */

function Dato({ numero, texto }: { numero: string; texto: string }) {
  return (
    <div>
      <p className="titulo text-[26px] leading-none sm:text-[30px]">{numero}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-white/45">{texto}</p>
    </div>
  );
}

function ChipPronto() {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold normal-case tracking-normal"
      style={{ background: "rgba(238,116,32,.18)", color: NARANJA }}
    >
      Muy pronto
    </span>
  );
}

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
    <div data-reveal style={{ "--reveal-delay": `${index * 60}ms` } as React.CSSProperties}>
      <span
        className="flex h-11 w-11 items-center justify-center rounded-2xl [&_svg]:h-5 [&_svg]:w-5"
        style={{ background: "rgba(238,116,32,.16)", color: NARANJA }}
      >
        {icono}
      </span>
      <h3 className="mt-4 text-[15.5px] font-extrabold text-white">{titulo}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">{texto}</p>
    </div>
  );
}

function BadgeTienda({ tienda }: { tienda: "apple" | "google" }) {
  return (
    <div
      className="flex w-[175px] items-center gap-3 rounded-2xl px-4 py-3 text-left text-white"
      style={{ background: "rgba(255,255,255,.06)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}
    >
      {tienda === "apple" ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="currentColor">
          <path d="M16.4 12.9c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1 0 1.4-.6 2.6-.6 1.2 0 1.5.6 2.6.6 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.9-2.2-3Z" />
          <path d="M14.5 6.7c.5-.7.9-1.6.8-2.6-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.6-.8 2.5.9.1 1.8-.4 2.3-1.1Z" />
        </svg>
      ) : (
        <LogoGooglePlay />
      )}
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-white/50">
          {tienda === "apple" ? "Descargalo en el" : "Disponible en"}
        </p>
        <p className="text-[13.5px] font-extrabold leading-tight">
          {tienda === "apple" ? "App Store" : "Google Play"}
        </p>
      </div>
    </div>
  );
}

function PreguntaFaq({ pregunta, children }: { pregunta: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl px-5 py-4" style={{ background: "rgba(255,255,255,.05)" }}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-bold text-white [&::-webkit-details-marker]:hidden">
        {pregunta}
        <IconChevronDown className="h-4 w-4 shrink-0 text-white/45 transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-[13.5px] leading-relaxed text-white/60">{children}</p>
    </details>
  );
}
