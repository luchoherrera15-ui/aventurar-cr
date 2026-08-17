import Link from "next/link";
import { IconChevronRight } from "@/components/icons";

/**
 * La banda navy de arriba de todo del home: la frase de marca y el
 * único atajo que le interesa a quien tiene un negocio.
 *
 * ⚠️ NO ES STICKY, Y NO PUEDE SERLO.
 *
 * `SiteHeader` sí lo es (`sticky top-0` con una altura FIJA de `h-16`),
 * y media docena de barras del sitio se cuelgan de esa altura exacta
 * con `top-16` — la barra de filtros del directorio, la del panel del
 * negocio, la de Lealtad. Si esta banda se pegara arriba, el header
 * bajaría ~36 px y las seis quedarían metidas por debajo de él. Es
 * exactamente el bug que costó la auditoría responsive del commit
 * 6238c1d.
 *
 * Que scrollee y desaparezca además es lo correcto: es un aviso, no
 * navegación. Quien ya lo leyó no necesita seguir viéndolo.
 *
 * Va MONTADA ARRIBA del `SiteHeader`, no adentro: el header tiene su
 * propio contrato de altura y meterle una fila más lo rompe igual.
 */
export default function AvisoSuperior() {
  return (
    <div className="bg-aventurea-navy text-white">
      <div className="mx-auto flex min-h-9 max-w-[1200px] flex-wrap items-center justify-center gap-x-7 gap-y-0.5 px-4 py-1.5 text-[12px] sm:px-6 lg:px-10">
        {/* En 390 px la frase y el link no caben en una línea, y el
            aviso no merece dos: gana el link, que es lo accionable. La
            frase vuelve desde `sm`, igual que en la maqueta. */}
        <span className="hidden text-white/70 sm:inline">
          Todo empieza con una reserva.
        </span>
        <Link
          href="/publicar"
          className="presionable inline-flex items-center gap-1.5 font-bold text-white hover:underline"
        >
          Publicá tu negocio gratis
          {/* El naranja sobre el navy da 4,7:1 — de sobra para un ícono
              (el mínimo de un objeto gráfico es 3:1). */}
          <IconChevronRight className="h-3 w-3 text-aventurea-orange" />
        </Link>
      </div>
    </div>
  );
}
