import Link from "next/link";
import MasServicios from "@/components/nav/mas-servicios";
import CajonNavMovil from "@/components/nav/cajon-nav-movil";
import { PUERTAS } from "@/components/nav/taxonomia-navegacion";

/**
 * EL HEADER DE LA PORTADA — logo, acciones, y nada más.
 *
 * `SiteHeader` (el de siempre, montado en 33 pantallas) no se toca: este
 * es un componente aparte y solo lo usa la portada.
 *
 * ── SE FUERON LAS PUERTAS DEL CENTRO ────────────────────────────────
 *
 * Acá vivían «Citas» y «Eventos» con su mega menú. Los sacó el dueño
 * (ago 2026) por dos razones que se suman:
 *
 *   1. «Citas» y «Eventos» son NUESTRA arquitectura, no la de quien
 *      entra a reservar. Nadie piensa «necesito un servicio de la
 *      vertical Citas»: piensa «necesito que me hagan las uñas». La
 *      navegación por rubro vive ahora en la fila de íconos del héroe
 *      (`rubros-icono.tsx`), que es lo que se mira primero.
 *   2. Partir la portada en dos verticales dejaba a la vista una
 *      división que el resto del producto ya no hace.
 *
 * El cajón de categorías del teléfono SÍ se queda: ahí no hay lugar para
 * una fila de íconos con paneles, y sigue siendo la única forma de
 * recorrer la taxonomía completa con el pulgar.
 *
 * ── Y SE FUE LA BARRA BLANCA ────────────────────────────────────────
 *
 * El header era una franja blanca con borde inferior, y contra la aurora
 * del héroe se leía como una tapa pegada encima. Ahora es TRANSPARENTE y
 * se apoya sobre el mismo degradado: la página arranca en el color, no
 * en una barra. Por eso el héroe lleva su padding superior — el header
 * flota sobre él en vez de empujarlo.
 */
export default function HeaderSimple() {
  return (
    <header className="relative z-40">
      <div className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center gap-6 px-4 lg:px-6">
        <Link href="/" className="titulo shrink-0 text-[22px] text-[color:var(--navy)]">
          Bookea
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Lealtad e Invitaciones son productos que Bookea le vende AL
              NEGOCIO, no cosas que un visitante reserva. Por eso viven
              acá, junto a las acciones de cuenta, y no con los rubros. */}
          <div className="hidden md:block">
            <MasServicios />
          </div>

          <Link
            href="/cuenta"
            className="hidden whitespace-nowrap px-2 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:text-[color:var(--navy)] sm:block"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/publicar"
            className="presionable hidden items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-colors sm:inline-flex"
            style={{ background: "var(--orange)" }}
          >
            Publicá tu negocio
            <span aria-hidden>→</span>
          </Link>

          {/* El cajón lleva la taxonomía COMPLETA, sin podar por censo:
              en el teléfono es la única puerta a explorar rubros, y
              esconder los que todavía no tienen negocios dejaría a la
              persona sin saber que Bookea los cubre. */}
          <CajonNavMovil puertas={PUERTAS} />
        </div>
      </div>
    </header>
  );
}
