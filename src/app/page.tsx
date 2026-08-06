import Link from "next/link";
// La animación de "Reservar toma tres pasos" — hoja propia de esta
// ruta, como reel.css en /invitaciones: nadie más la descarga.
import "./home.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import {
  IconBalloons,
  IconCalendarLine,
  IconChatBubble,
  IconStar,
  IconStopwatch,
  IconTagLine,
  IconWand,
} from "@/components/icons";

/**
 * El home de Bookea — el techo común de las verticales. Antes / era un
 * redirect directo a /eventos; la portada presenta las verticales como
 * DOS bandas rectangulares apiladas (Eventos y Citas). Se probó
 * mostrar rieles con negocios reales acá y el dueño lo descartó: hacía
 * enredo — los negocios viven en sus directorios, el home solo abre
 * las puertas. Hospedajes tampoco se anuncia acá hasta que exista.
 *
 * Sin consultas a la base: la puerta de entrada es la página más
 * liviana del sitio.
 */

const PUERTAS = [
  {
    href: "/eventos",
    nombre: "Todo para tus eventos",
    Marca: IconBalloons,
    linea:
      "Lugares para fiestas, catering, música y decoración — reservá cada pieza en un solo lugar.",
    chips: ["Lugares", "Alimentación", "Animación", "Decoración"],
  },
  {
    href: "/citas",
    nombre: "¿Qué deseás agendar?",
    Marca: IconCalendarLine,
    linea:
      "Belleza, barbería, uñas y spa: elegí el servicio, la hora y con quién.",
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
    texto: "Fotos, precios en colones y reseñas reales para comparar.",
  },
  {
    numero: "02",
    titulo: "Reservá",
    texto: "La fecha o la hora, confirmada al instante — con SINPE.",
  },
  {
    numero: "03",
    titulo: "Llegá",
    texto: "Todo queda por escrito en tu correo. Solo falta disfrutar.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <RevealOnScroll />
      <SiteHeader />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="mx-auto max-w-[1280px] px-4 pt-12 sm:px-5 sm:pt-14">
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
        </section>

        {/* ---------- Las dos puertas ---------- */}
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pt-9 sm:px-5">
          {/* Una sobre otra, a todo el ancho — cada puerta es una
              banda propia (pedido del dueño), no dos columnas. */}
          <div className="flex flex-col gap-3">
            {PUERTAS.map(({ href, nombre, Marca, linea, chips }, i) => (
              <Link
                key={href}
                href={href}
                data-reveal
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border p-7 transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgba(22,41,94,0.4)] sm:p-9 ${PIELES_PUERTA[i % PIELES_PUERTA.length].card}`}
              >
                {/* La marca de agua, sangrando por la esquina como en
                    las cards del tablero del panel. Más grande acá: la
                    banda es ancha y la aguanta sin estorbar al texto. */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -right-6 -top-10 rotate-[14deg] ${PIELES_PUERTA[i % PIELES_PUERTA.length].marca} [&_svg]:h-48 [&_svg]:w-48`}
                >
                  <Marca />
                </span>
                <span className="relative z-10 flex flex-col gap-2">
                  <span className="titulo text-[25px] text-aventurea-ink sm:text-[30px]">
                    {nombre}
                  </span>
                  <span className="max-w-[52ch] text-[14px] leading-snug text-aventurea-ink-soft">
                    {linea}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-lg bg-aventurea-navy/10 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-navy"
                      >
                        {chip}
                      </span>
                    ))}
                  </span>
                  <span className="mt-2.5 text-[13.5px] font-extrabold text-aventurea-navy underline-offset-4 group-hover:underline">
                    Explorar →
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {/* La promesa de la casa */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-aventurea-line pt-6 sm:grid-cols-4">
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

        {/* ---------- Así de simple: la banda oscura INMERSIVA, de
            borde a borde. En Chrome/Edge desktop el scroll dirige la
            escena (sticky + scroll-driven animations en home.css):
            el título, cada paso y la línea aparecen al ritmo del
            scroll. En el resto de navegadores/móvil, la misma banda
            se ve completa y estática. ---------- */}
        <section className="pasos-lienzo mt-14 w-full sm:mt-16">
          <div className="pasos-pin flex flex-col items-center justify-center px-5 py-20 sm:py-24">
            <div className="w-full max-w-[1100px]">
              <div className="pasos-encabezado text-center">
                <p className="text-[11px] font-light uppercase tracking-[0.2em] text-aventurea-orange">
                  Así funciona
                </p>
                <h2 className="titulo mt-3 text-[32px] text-white sm:text-[52px]">
                  Reservar toma tres pasos
                </h2>
              </div>

              <div className="relative mt-14 grid gap-12 sm:mt-20 sm:grid-cols-3 sm:gap-8">
                {/* La línea que une los tres números: se dibuja de
                    izquierda a derecha al ritmo del scroll. */}
                <span
                  aria-hidden
                  className="pasos-linea absolute left-[16.6%] right-[16.6%] top-7 hidden h-px bg-gradient-to-r from-aventurea-sky/70 via-white/30 to-aventurea-sky/70 sm:block"
                />

                {PASOS.map(({ numero, titulo, texto }, i) => (
                  <div
                    key={numero}
                    className={`pasos-item-${i + 1} relative flex flex-col items-center text-center`}
                  >
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-aventurea-sky/70 bg-[#0e1a38] text-[16px] font-extrabold text-aventurea-orange shadow-[0_0_0_8px_rgba(47,124,190,0.12)]">
                      {numero}
                    </span>
                    <h3 className="titulo mt-5 text-[24px] text-white sm:text-[27px]">
                      {titulo}
                    </h3>
                    <p className="mt-2.5 max-w-[30ch] text-[14px] leading-relaxed text-white/65 sm:text-[15px]">
                      {texto}
                    </p>
                  </div>
                ))}
              </div>

              <p className="pasos-cierre mt-14 text-center text-[15px] font-bold text-white/85 sm:mt-20 sm:text-[17px]">
                Y listo — sin llamadas, sin &quot;¿tiene disponible?&quot;, sin
                esperar respuesta.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Los dos extras: invitaciones y publicar ---------- */}
        <section className="mx-auto grid max-w-[1280px] gap-3 px-5 py-14 sm:grid-cols-2 sm:py-16">
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
