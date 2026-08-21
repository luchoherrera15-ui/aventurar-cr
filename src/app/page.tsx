import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import AvisoSuperior from "@/components/home/aviso-superior";
import NavHome from "@/components/home/nav-home";
import NavCategorias from "@/components/home/nav-categorias";
import RielesCatalogo from "@/components/home/rieles-catalogo";
import ExplorarRubros from "@/components/home/explorar-rubros";
import BloqueNegocios from "@/components/home/bloque-negocios";
import { leerCatalogoPortada } from "@/app/home-datos";
import { DATOS_ORGANIZACION } from "@/lib/seo-organizacion";
import { urlSitio } from "@/lib/sitio";

/**
 * ============================================================
 * LA PORTADA DE BOOKEA — `bookea.lat`
 * ============================================================
 *
 * ── LA PASADA DE AGOSTO 2026: LA PORTADA VUELVE A SER UN CATÁLOGO ──
 *
 * Pedido textual del dueño:
 *
 *   «Necesito un marketplace de todos los lugares que tenemos
 *    registrados. Que abarque toda la página. Solo la parte de arriba
 *    con íconos pequeñitos y una barra de buscar pequeñita. Todo el
 *    resto: los negocios que tenemos registrados, POR CARRIL. Un carril
 *    que diga Eventos y salga todo en general. Un carril que diga Salud
 *    y belleza y salgan barberías, uñas, estilistas, todo en el mismo
 *    riel.»
 *
 * La pasada anterior había dejado la portada en DOS controles (un
 * héroe grande con el buscador y cuatro grupos desplegables) y cero
 * consultas a la base. Esta la da vuelta: el héroe se comprime a una
 * barra de ~89 px de alto (contra los ~450 del héroe) y el cuerpo se
 * llena de rieles con los negocios reales del directorio.
 *
 * ── EL ORDEN DE LA PÁGINA, Y POR QUÉ ESE ─────────────────────────
 *
 *   1. `AvisoSuperior`   — arriba del header, nunca adentro.
 *   2. `SiteHeader`      — con `NavHome` («Cómo funciona» → /publicar).
 *   3. LA BARRA COMPACTA — el h1 en una línea + `NavCategorias`
 *      (buscador chico, cuatro grupos con íconos chicos, botón IA).
 *      Va en una franja blanca con borde: separa el mando del catálogo
 *      sin gastar media pantalla en un héroe.
 *   4. `RielesCatalogo`  — EL PROTAGONISTA. Un riel por vertical, con
 *      los negocios aprobados. Es lo único que consulta la base.
 *   5. `ExplorarRubros`  — los 36 rubros reales como puertas al
 *      directorio. Es lo que sostiene la página mientras el catálogo
 *      esté chico, y sigue siendo útil cuando esté lleno.
 *   6. `BloqueNegocios`  — «Tu talento merece ser encontrado» → el otro
 *      lado del marketplace: publicar es gratis. Ya existía y no lleva
 *      una sola cifra inventada; se reusa tal cual.
 *   7. `SiteFooter`.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ───────────────────────────────────
 *
 * Ni estrellas, ni «4,2 km», ni «Hoy 3:30 p.m.», ni «+500 negocios», ni
 * un solo negocio de mentira para rellenar. En producción `resenas`
 * tiene CERO filas y hoy hay DOS negocios aprobados. La portada tiene
 * que verse digna con esos dos y llenarse sola cuando entren más — de
 * ahí que las filas vacías no se dibujen (`agruparPorVertical`), que
 * las tarjetas lleven ancho fijo (una fila corta queda corta, no
 * deforme) y que el hueco de abajo lo llenen rubros que EXISTEN, no
 * inventario que no.
 *
 * ── EL COSTO EN LA URL MÁS VISITADA DEL SITIO ────────────────────
 *
 * `leerCatalogoPortada()` hace UNA consulta a `ranchos` (más
 * `auth.getUser`, que para un visitante anónimo ni sale a la red) y el
 * reparto en cuatro rieles se hace en memoria. Se lee con `await`
 * directo y no dentro de un `<Suspense>`: un esqueleto con una altura
 * distinta a la del riel real mueve la página cuando llegan los datos,
 * y el CLS de esta pantalla es exactamente lo que Google mide.
 *
 * ── LA BIENVENIDA ANIMADA SE FUE, Y NO ES UN DESCUIDO ────────────
 *
 * Los cuatro archivos del velo blanco con el logo (`portada-intro.tsx`,
 * `intro.css`, `intro-visita.ts` y su prueba) están BORRADOS, no
 * comentados: tapaban justo la primera pantalla, que es lo que Google
 * mide. Ya revivieron una vez por accidente. No vuelven.
 */

export const metadata: Metadata = {
  // `absolute` y no un string suelto: el layout raíz declara el
  // template "%s | Bookea", así que un título normal saldría como
  // "Bookea — … | Bookea".
  title: {
    absolute: "Bookea — Reservá servicios y encontrá proveedores para eventos",
  },
  description:
    "Reservá citas de belleza, barbería, spa y salud, y encontrá lugares, catering, música y decoración para tu evento en todo Costa Rica. Precios en colones, a la vista, y reserva directa sin cadenas de WhatsApp.",
  // Acá SÍ se puede usar la Metadata API —y no un <link> en el JSX
  // como hace el directorio— porque el archivo y la ruta coinciden:
  // esta metadata cubre `/` y nada más.
  alternates: { canonical: urlSitio("/") },
};

export default async function Home() {
  const catalogo = await leerCatalogoPortada();

  return (
    // `overflow-x-clip`: protege contra cualquier desborde horizontal
    // (los rieles scrollean adentro de su propia caja) sin romper el
    // `position: sticky` del header — `clip` no crea contexto de
    // scroll; `hidden` sí lo haría.
    <div className="flex min-h-screen flex-col overflow-x-clip bg-aventurea-cream-2">
      {/* Quién es Bookea, en el idioma que leen los buscadores. Se
          declara UNA vez en todo el sitio y es acá: la recomendación de
          Google es la portada, no cada pantalla. JSON serializado por
          nosotros, sin nada que venga de la base: no hay entrada de
          usuario que escapar. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ORGANIZACION) }}
      />

      {/* Arriba del header, nunca adentro: el header tiene una altura
          fija de 64px de la que se cuelgan media docena de barras
          `top-16` del sitio. */}
      <AvisoSuperior />

      {/* `conPublicar={false}` a propósito: `NavHome` ya trae «Cómo
          funciona» → /publicar, y «Publicá tu espacio» al lado sería la
          misma puerta dos veces. De paso se salta la consulta
          `tieneNegocioPropio()` — una ida menos a la base en la URL más
          visitada del sitio. */}
      <SiteHeader
        ancho="max-w-[1200px]"
        extra={<NavHome />}
        conPublicar={false}
      />

      {/* ── LA BARRA COMPACTA ────────────────────────────────────────
          Todo el mando de la portada en una franja. El h1 va acá, en el
          SERVIDOR, y no adentro de `NavCategorias`, que es un
          componente cliente: el encabezado principal de la URL más
          indexada del sitio no puede depender de que hidrate nada. */}
      <section className="border-b border-aventurea-line bg-white">
        {/* ── POR QUÉ EL h1 VA ARRIBA Y NO AL LADO ──────────────────
            La pasada anterior metía el h1, el buscador y los cuatro
            chips en UNA fila de 1200 px. No entraban: los chips miden
            ~680 px, el h1 se lleva ~166 y el buscador ~280, así que
            entre 1024 y 1240 px de ancho el último chip («IA») salía
            cortado a cuchillo en toda pantalla de escritorio normal —
            está documentado en el propio comentario que había acá, y
            el paliativo era un degradado que avisa que la fila se
            desliza.

            Con el h1 en su renglón, el buscador y los chips disponen
            de los 1152 px enteros: nunca más se corta un chip, y hay
            lugar para el selector de directorio del buscador. El costo
            son ~25 px de alto en escritorio (la franja pasa de 64 a
            ~89), que sigue siendo una BARRA y no un héroe — que es lo
            que pidió el dueño. En teléfono no cuesta nada: ahí el h1
            ya iba en su propia línea. */}
        <div className="mx-auto w-full max-w-[1200px] px-4 py-3 lg:px-6">
          {/* El h1 viaja como prop a la barra (`titulo`): la barra lo
              coloca en la columna izquierda de su grilla para que el
              buscador quede en el centro real de la franja. Se queda
              declarado ACÁ, y no dentro del componente, porque es el
              encabezado del documento: quien lea esta página tiene que
              ver de qué habla sin abrir un componente de navegación. */}
          <NavCategorias
            titulo={
              <h1 className="text-[13.5px] font-extrabold leading-tight text-aventurea-navy lg:text-[14px]">
                Reservá servicios y lugares en Costa Rica
              </h1>
            }
          />
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-6 lg:py-8">
          <RielesCatalogo {...catalogo} />

          {/* `mt-0` cuando no hay ni un riel: sin negocios publicados,
              `RielesCatalogo` devuelve null y esta franja pasa a ser lo
              primero del cuerpo. */}
          <div className={catalogo.pintables.length > 0 ? "mt-11" : ""}>
            <ExplorarRubros />
          </div>
        </div>

        {/* Trae su propio `px`/`py` y su propio `max-w-[1200px]`. */}
        <BloqueNegocios />
      </main>

      {/* El pie va en CLARO aunque la sección de arriba también lo sea:
          es decisión propia de SiteFooter («dos navys pegados se leen
          como uno solo») y no se toca desde acá. */}
      <SiteFooter />

      {/* La animación de entrada de las tarjetas. Va al final y es
          puro adorno: el estado por defecto de `[data-reveal]` es
          VISIBLE, así que si el JS tarda, falla o no corre, la portada
          se ve igual (ver el comentario de globals.css). */}
      <RevealOnScroll />
    </div>
  );
}
