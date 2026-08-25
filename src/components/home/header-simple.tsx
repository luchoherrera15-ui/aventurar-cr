import Link from "next/link";
import AccionesPortada from "@/components/home/acciones-portada";
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
 * ── Y SE FUE LA BARRA BLANCA, EN DOS PASADAS ────────────────────────
 *
 * El header era una franja blanca con borde inferior, y contra la aurora
 * del héroe se leía como una tapa pegada encima. Se le quitaron el borde
 * y el fondo… y ahí apareció el problema de verdad: transparente dejaba
 * ver el BLANCO DE LA PÁGINA entre la banda navy de arriba y el punto
 * donde arranca el degradado del héroe. Una franja blanca igual, solo
 * que por otro motivo.
 *
 * Lo que quedó es que el header lleve el mismo color con el que abre el
 * degradado. Ver el comentario del `style`, abajo.
 */
export default async function HeaderSimple() {
  return (
    /* ⚠️ EL FONDO NO ES `transparent`, Y ESA ES LA CORRECCIÓN.
       Transparente dejaba ver el blanco de la página entre la banda
       navy de arriba y el punto donde arranca el degradado del héroe:
       una franja blanca cruzando la pantalla, justo debajo del navy.

       Lleva el MISMO color con el que abre el degradado del héroe
       (`#fff4e6`, la parada del 0 %), así que los dos se empalman sin
       costura y la página arranca en color. Si algún día cambia esa
       primera parada en `hero-busqueda.tsx`, tiene que cambiar acá:
       son los dos extremos del mismo empalme. */
    <header className="relative z-40" style={{ background: "#fff4e6" }}>
      <div className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center gap-6 px-4 lg:px-6">
        <Link href="/" className="titulo shrink-0 text-[22px] text-[color:var(--navy)]">
          Bookea
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {/* ⚠️ ACÁ ESTABA EL MENÚ «MÁS SERVICIOS», con Lealtad e
              Invitaciones adentro. Se fue (pedido del dueño, ago 2026):
              escondidos detrás de un desplegable casi nadie los abría, y
              son dos de los productos que más le importan.

              Ahora viven en la fila de íconos del héroe
              (`rubros-icono.tsx`), a la derecha de una línea divisoria
              que los separa de los rubros que un visitante reserva. Se
              ven de entrada en vez de esperar un clic. */}
          {/* ── CON SESIÓN, EL HEADER LO DICE ────────────────────────
              Antes acá había un «Iniciar sesión» fijo que decía lo
              mismo con sesión y sin ella: quien ya había entrado veía
              una invitación a entrar otra vez, y no tenía por dónde
              salir. `AccionesPortada` resuelve la sesión en el servidor
              y pinta el nombre con su menú, o el par de siempre. */}
          <AccionesPortada />

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
