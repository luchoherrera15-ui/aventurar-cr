import Link from "next/link";
// La animación de "Reservar toma tres pasos" — hoja propia de esta
// ruta, como reel.css en /invitaciones: nadie más la descarga.
import "./home.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import MapaLatam from "@/components/mapa-latam";
import { IconBalloons, IconCalendarLine, IconWand } from "@/components/icons";

/**
 * El home de Bookea — el techo común de las verticales. Antes / era un
 * redirect directo a /eventos; hoy es una portada MINIMALISTA a
 * pantalla completa: un punto late en el centro y, en menos de un
 * segundo, se abre en las dos puertas (Eventos · Citas y servicios).
 *
 * La coreografía es 100% CSS con animation-delay (home.css) — no hay
 * estado "cargando" ni JavaScript: el contenido real está en el HTML
 * desde el primer byte, así que Google lo lee igual y nadie espera de
 * verdad. Con prefers-reduced-motion todo aparece de una.
 *
 * Sin consultas a la base: la puerta de entrada es la página más
 * liviana del sitio.
 */

const PUERTAS = [
  {
    href: "/eventos",
    nombre: "Eventos",
    linea: "Lugares, catering, música y decoración.",
    Marca: IconBalloons,
    piel: "border-aventurea-navy/10 bg-aventurea-blue-light hover:border-aventurea-navy/30",
    marca: "text-aventurea-navy/10",
  },
  {
    href: "/citas",
    nombre: "Citas y servicios",
    linea: "Belleza, barbería, uñas y spa.",
    Marca: IconCalendarLine,
    piel: "border-aventurea-sky/30 bg-aventurea-sky/15 hover:border-aventurea-sky/60",
    marca: "text-aventurea-sky-dark/20",
  },
] as const;

// La franja de "promesas" (confirmación al instante, precios claros...)
// salió del home: lo mismo lo dicen los tres pasos de abajo, y la
// portada minimalista no quiere nada compitiendo con la decisión.

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
        {/* ---------- La portada: el punto que se abre en dos puertas.
            Ocupa la pantalla menos el header (64px) y centra todo. ---------- */}
        <section className="relative flex min-h-[calc(100svh-64px)] flex-col items-center justify-center px-5 py-16">
          {/* El mapa de fondo: Latinoamérica con los pines
              encendiéndose en ciclo (Costa Rica primero, en naranja).
              Decorativo puro — detrás del contenido y sin tocar el
              flujo del texto. */}
          <MapaLatam
            className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 text-aventurea-navy sm:h-[680px] sm:w-[680px]"
          />

          {/* z-10: el mapa es `absolute` y, sin esto, se pintaría
              encima del texto (los posicionados ganan a los que no lo
              están dentro del mismo contexto). */}
          <p
            className="home-entra relative z-10 text-[10.5px] font-light uppercase tracking-[0.22em] text-aventurea-orange"
            style={{ "--paso": 0 } as React.CSSProperties}
          >
            Bookea · Costa Rica
          </p>
          <h1
            className="home-entra titulo relative z-10 mt-4 max-w-[14ch] text-center text-[34px] leading-[1.05] text-aventurea-ink sm:text-[46px]"
            style={{ "--paso": 1 } as React.CSSProperties}
          >
            ¿Qué vas a reservar?
          </h1>

          {/* Las dos puertas: compactas y centradas — la pantalla
              entera es la decisión, nada más compite. */}
          <div className="relative z-10 mt-10 grid w-full max-w-[620px] gap-3 sm:grid-cols-2">
            {PUERTAS.map(({ href, nombre, linea, Marca, piel, marca }, i) => (
              <Link
                key={href}
                href={href}
                className={`home-entra group relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-22px_rgba(22,41,94,0.45)] ${piel}`}
                style={{ "--paso": 2 + i } as React.CSSProperties}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute -right-4 -top-5 rotate-[14deg] ${marca} [&_svg]:h-28 [&_svg]:w-28`}
                >
                  <Marca />
                </span>
                <span className="relative z-10">
                  <span className="titulo block text-[21px] text-aventurea-ink">
                    {nombre}
                  </span>
                  <span className="mt-1.5 block text-[12.5px] leading-snug text-aventurea-ink-soft">
                    {linea}
                  </span>
                  <span className="mt-4 block text-[12.5px] font-extrabold text-aventurea-navy">
                    Explorar →
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {/* La invitación a seguir bajando, discreta. */}
          <span
            aria-hidden
            className="home-entra mt-14 text-[18px] leading-none text-aventurea-ink-soft/40"
            style={{ "--paso": 4 } as React.CSSProperties}
          >
            ↓
          </span>
        </section>

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
