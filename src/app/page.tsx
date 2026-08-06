import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  IconBalloons,
  IconCalendarLine,
  IconChatBubble,
  IconPalmera,
  IconStar,
  IconStopwatch,
  IconTagLine,
  IconWand,
} from "@/components/icons";

/**
 * El home de Bookea — el techo común de las verticales. Antes / era un
 * redirect directo a /eventos; ahora que son varios mundos (Eventos,
 * Citas y pronto Hospedajes), la portada los presenta como tres
 * puertas y deja que cada quien entre a la suya.
 *
 * Las puertas son rectángulos claros con marca de agua (globos, agenda,
 * palmera), en las mismas pieles azul/celeste alternadas del tablero
 * del panel — sin fotos, sin bloques navy (iterado con el dueño). Cero
 * JavaScript más allá del RevealOnScroll de siempre: la puerta de
 * entrada tiene que ser la página más liviana del sitio.
 */

const PUERTAS = [
  {
    href: "/eventos",
    nombre: "Eventos",
    Marca: IconBalloons,
    linea: "Lugares para fiestas, catering, música y decoración — todo tu evento en un solo lugar.",
    chips: ["Lugares", "Alimentación", "Animación", "Decoración"],
  },
  {
    href: "/citas",
    nombre: "Citas",
    Marca: IconCalendarLine,
    linea: "Belleza, barbería, uñas y spa: elegí el servicio, la hora y con quién.",
    chips: ["Belleza", "Barbería", "Uñas", "Spa"],
  },
] as const;

/** Las mismas dos pieles suaves del tablero del panel, alternadas. */
const PIELES_PUERTA = [
  { card: "border-aventurea-navy/10 bg-aventurea-blue-light", marca: "text-aventurea-navy/10" },
  { card: "border-aventurea-sky/30 bg-aventurea-sky/20", marca: "text-aventurea-sky-dark/20" },
] as const;

const PROMESAS = [
  { Icono: IconStopwatch, texto: "Confirmación al instante" },
  { Icono: IconTagLine, texto: "Precios claros, en colones" },
  { Icono: IconChatBubble, texto: "Chat directo con el negocio" },
  { Icono: IconStar, texto: "Reseñas de clientes reales" },
] as const;

const PASOS = [
  {
    numero: "01",
    titulo: "Elegí",
    texto:
      "Compará opciones reales: fotos, precios en colones y reseñas de gente que ya reservó ahí.",
  },
  {
    numero: "02",
    titulo: "Reservá",
    texto:
      "Escogé la fecha o la hora y confirmá al instante. El depósito va por SINPE, sin vueltas.",
  },
  {
    numero: "03",
    titulo: "Llegá",
    texto:
      "La confirmación te cae al correo con todos los detalles — y el chat queda abierto por si querés preguntar algo.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <RevealOnScroll />
      <SiteHeader />

      <main className="flex-1">
        {/* ---------- Hero: la pregunta y las tres puertas, sobre
            fondo claro — el navy queda para los velos de las fotos,
            no para el lienzo (pedido del dueño). ---------- */}
        <section className="mx-auto max-w-[1280px] px-4 pb-4 pt-12 sm:px-5 sm:pt-16">
          <div>
            <p className="flex items-center justify-center gap-2 text-[11px] font-light uppercase tracking-[0.18em] text-aventurea-orange">
              <span aria-hidden className="block h-[1.5px] w-[18px] bg-aventurea-sky" />
              Reservas en Costa Rica
              <span aria-hidden className="block h-[1.5px] w-[18px] bg-aventurea-sky" />
            </p>
            <h1 className="titulo mx-auto mt-4 max-w-[16ch] text-center text-[38px] text-aventurea-ink sm:text-[54px]">
              ¿Qué vas a reservar hoy?
            </h1>
            <p className="mx-auto mt-4 max-w-[52ch] text-center text-[14.5px] leading-relaxed text-aventurea-ink-soft sm:text-[15.5px]">
              El salón del evento, la cita de la semana o la próxima escapada:
              acá se compara con precios reales y se reserva al instante — sin
              cadenas de WhatsApp.
            </p>

            {/* Las puertas */}
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {PUERTAS.map(({ href, nombre, Marca, linea, chips }, i) => (
                <Link
                  key={href}
                  href={href}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgba(22,41,94,0.4)] sm:p-7 ${PIELES_PUERTA[i % PIELES_PUERTA.length].card}`}
                >
                  {/* La marca de agua, sangrando por la esquina como en
                      las cards del tablero del panel. */}
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute -right-5 -top-6 rotate-[14deg] ${PIELES_PUERTA[i % PIELES_PUERTA.length].marca} [&_svg]:h-36 [&_svg]:w-36`}
                  >
                    <Marca />
                  </span>
                  <span className="relative z-10 flex flex-col gap-2">
                    <span className="text-[21px] font-extrabold text-aventurea-ink">
                      {nombre}
                    </span>
                    <span className="text-[13px] leading-snug text-aventurea-ink-soft">
                      {linea}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-lg bg-aventurea-navy/10 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-navy"
                        >
                          {chip}
                        </span>
                      ))}
                    </span>
                    <span className="mt-2 text-[13px] font-extrabold text-aventurea-navy underline-offset-4 group-hover:underline">
                      Explorar →
                    </span>
                  </span>
                </Link>
              ))}

              {/* Hospedajes: la puerta que ya se ve pero todavía no se
                  abre — misma lógica que "En configuración". */}
              <div
                data-reveal
                style={{ "--reveal-delay": "180ms" } as React.CSSProperties}
                className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 sm:p-7 ${PIELES_PUERTA[0].card}`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -right-5 -top-6 rotate-[14deg] ${PIELES_PUERTA[0].marca} [&_svg]:h-36 [&_svg]:w-36`}
                >
                  <IconPalmera />
                </span>
                <span className="relative z-10 flex flex-col gap-2">
                  <span className="flex items-center gap-2.5 text-[21px] font-extrabold text-aventurea-ink">
                    Hospedajes
                    <span className="rounded-lg bg-aventurea-navy px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-white">
                      Muy pronto
                    </span>
                  </span>
                  <span className="text-[13px] leading-snug text-aventurea-ink-soft">
                    Escapadas y estadías frente al mar y la montaña — ya casi
                    están acá.
                  </span>
                </span>
              </div>
            </div>

            {/* La promesa de la casa */}
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-aventurea-line pt-6 sm:grid-cols-4">
              {PROMESAS.map(({ Icono, texto }) => (
                <p
                  key={texto}
                  className="flex items-center justify-center gap-2 text-center text-[12px] font-bold text-aventurea-ink-soft"
                >
                  <Icono className="h-4 w-4 shrink-0 text-aventurea-orange" />
                  {texto}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Así de simple ---------- */}
        <section className="mx-auto max-w-[1280px] px-5 py-14 sm:py-16">
          <div data-reveal className="text-center">
            <p className="text-[11px] font-light uppercase tracking-[0.18em] text-aventurea-orange">
              Así funciona
            </p>
            <h2 className="titulo mt-2 text-[27px] text-aventurea-ink sm:text-[34px]">
              Reservar toma tres pasos
            </h2>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {PASOS.map(({ numero, titulo, texto }, i) => (
              <div
                key={numero}
                data-reveal
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                className="bento bento-blanco p-6"
              >
                <p className="text-[13px] font-extrabold text-aventurea-orange">
                  {numero}
                </p>
                <h3 className="titulo mt-1.5 text-[19px] text-aventurea-ink">
                  {titulo}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {texto}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Los dos extras: invitaciones y publicar ---------- */}
        <section className="mx-auto grid max-w-[1280px] gap-3 px-5 pb-16 sm:grid-cols-2">
          <div data-reveal className="bento bento-azul flex flex-col items-start p-7 sm:p-9">
            <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              <IconWand className="h-4 w-4" /> El complemento del evento
            </p>
            <h2 className="titulo mt-3 text-[24px] text-aventurea-ink sm:text-[28px]">
              Invitaciones digitales
            </h2>
            <p className="mt-2.5 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Invitaciones animadas con confirmación de invitados, recordatorios
              automáticos y un álbum de fotos con QR para el gran día.
            </p>
            <Link href="/invitaciones" className="btn-contorno mt-6">
              Ver las invitaciones
            </Link>
          </div>

          <div
            data-reveal
            style={{ "--reveal-delay": "90ms" } as React.CSSProperties}
            className="bento bento-navy flex flex-col items-start p-7 sm:p-9"
          >
            <span aria-hidden className="bento-orbe -right-16 -top-20" />
            <p className="relative text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange">
              ¿Tenés un negocio?
            </p>
            <h2 className="titulo relative mt-3 text-[24px] text-white sm:text-[28px]">
              Publicalo gratis en Bookea
            </h2>
            <p className="relative mt-2.5 max-w-[44ch] text-[13.5px] leading-relaxed text-white/75">
              Tu agenda, tus reservas, tus cobros y tus clientes en un solo
              panel — y una página como las que acabás de ver, lista para
              compartir.
            </p>
            <Link href="/publicar" className="btn-blanco relative mt-6">
              Publicá tu negocio
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
