import Link from "next/link";
import MegaMenu from "@/components/nav/mega-menu";
import CajonNavMovil from "@/components/nav/cajon-nav-movil";
import { PUERTAS } from "@/components/nav/taxonomia-navegacion";
import { leerCenso, puertasConInventario } from "@/lib/censo-rubros";

/**
 * EL HEADER DE LA PORTADA — logo, las cinco puertas, y las acciones.
 *
 * `SiteHeader` (el de siempre, montado en 33 pantallas) no se toca: este
 * es un componente aparte y solo lo usa la portada. Un rediseño del
 * header compartido habría tocado el directorio, los paneles de
 * proveedor, /cuenta y los legales de una sola vez.
 *
 * ── LAS CINCO PUERTAS, Y POR QUÉ NO SIEMPRE SON CINCO ───────────────
 *
 * La taxonomía tiene las cinco enteras con sus ~148 rubros
 * (`taxonomia-navegacion.ts`), pero lo que se PINTA lo decide el censo:
 * una puerta sin un solo negocio no se dibuja, y dentro de una puerta
 * que sí se dibuja, los rubros vacíos no se listan.
 *
 * Es la decisión del dueño y es la correcta para un directorio que
 * arranca: un mega menú enorme donde casi todo lleva a una lista vacía
 * se lee peor que uno chico donde todo lleva a algo. Y crece solo — el
 * día que entre la primera villa, Hospedaje aparece sin tocar código.
 *
 * ── SERVIDOR, NO CLIENTE ────────────────────────────────────────────
 *
 * El censo se resuelve acá, en el servidor, y viaja ya filtrado. El
 * navegador nunca consulta `ranchos` para saber qué dibujar: recibe la
 * lista lista. Eso además evita el parpadeo de un menú que primero
 * muestra cinco puertas y después borra tres.
 */
export default async function HeaderSimple() {
  const censo = await leerCenso();
  const puertas = puertasConInventario(PUERTAS, censo);

  return (
    // `relative` y SIN overflow: el panel del mega menú es hermano de la
    // fila de botones y cuelga de este contenedor. Un `overflow-hidden`
    // acá lo cortaría en seco — ya pasó dos veces en este repo.
    <header className="relative z-40 border-b border-aventurea-line bg-white">
      <div className="mx-auto flex h-[72px] w-full max-w-[1280px] items-center gap-6 px-4 lg:px-6">
        <Link
          href="/"
          className="titulo shrink-0 text-[22px] text-[color:var(--navy)]"
        >
          Bookea
        </Link>

        {/* Las puertas, al medio. Se esconden bajo `lg` y su lugar lo
            toma el cajón: a ese ancho cinco botones más el logo y las
            acciones no entran sin apretujarse, y un header apretado es
            lo primero que delata una plantilla. */}
        {puertas.length > 0 && (
          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <MegaMenu puertas={puertas} />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            href="/cuenta"
            className="hidden text-[13.5px] font-bold text-aventurea-ink transition-colors hover:text-[color:var(--navy)] sm:block"
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

          {puertas.length > 0 && <CajonNavMovil puertas={puertas} />}
        </div>
      </div>
    </header>
  );
}
