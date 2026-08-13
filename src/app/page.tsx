import Link from "next/link";
// La animación de "Reservar toma tres pasos" — hoja propia de esta
// ruta, como reel.css en /invitaciones: nadie más la descarga.
import "./home.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import MapaLatam from "@/components/mapa-latam";
import PortadaIntro from "./portada-intro";
import { IconWand } from "@/components/icons";

/**
 * El home de Bookea — el techo común de las verticales.
 *
 * En la PRIMERA visita de cada sesión es una ENTRADA a pantalla
 * completa (portada-intro.tsx): aparece el logo, se disuelve, entra el
 * mapa con sus targets encendiéndose, y a los cinco segundos el sitio
 * pasa solo a Eventos — o antes, si tocan la pantalla. Después de esa
 * primera vez el home se ve como esta página, para que el logo de la
 * cabecera no sea un botón que siempre tira a Eventos.
 *
 * Las dos tarjetas (Eventos / Citas) salieron: con la entrada llevando
 * a Eventos eran una decisión que ya nadie tomaba acá, y el pie del
 * sitio sigue llevando a las cuatro verticales.
 *
 * Sin consultas a la base: la puerta de entrada es la página más
 * liviana del sitio.
 */

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
    // overflow-x-clip: el mapa decorativo mide 560px y en un teléfono
    // de 390px se salía 85px por la derecha, haciendo que TODA la
    // portada se deslizara de lado. /eventos y /hospedajes ya lo tenían.
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white">
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
            className="pointer-events-none absolute left-1/2 top-1/2 h-[min(560px,92vw)] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 text-aventurea-navy sm:h-[680px] sm:w-[680px]"
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

          {/* La invitación a seguir bajando, discreta. */}
          <span
            aria-hidden
            className="home-entra mt-14 text-[18px] leading-none text-aventurea-ink-soft/40"
            style={{ "--paso": 4 } as React.CSSProperties}
          >
            ↓
          </span>

          {/* La entrada automática: cinco segundos de mapa y el sitio
              se va solo a Eventos (o antes, si tocan la pantalla).
              Va acá abajo y no envuelve nada: el home sigue llegando
              entero en el HTML, así que si el JavaScript no corre, la
              portada funciona como toda la vida. */}
          <PortadaIntro />
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
