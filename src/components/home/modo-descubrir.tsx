import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import AvisoSuperior from "@/components/home/aviso-superior";
import HeaderSimple from "@/components/home/header-simple";
import HeroBusqueda from "@/components/home/hero-busqueda";
import RielesCatalogo from "@/components/home/rieles-catalogo";
import { DATOS_ORGANIZACION } from "@/lib/seo-organizacion";
import type { CatalogoPortada } from "@/app/home-datos";
import type { BusquedaPortada } from "@/lib/carriles-home";
import type { RubroPortada } from "@/lib/rubros-portada";

/**
 * ════════════════════════════════════════════════════════════════════
 *  MODO DESCUBRIR — la portada de siempre
 * ════════════════════════════════════════════════════════════════════
 *
 * Esto es, literalmente, lo que `/` renderizó desde agosto de 2026. Se
 * movió acá sin cambiarle una línea cuando el home pasó a tener dos
 * modos (ver `src/lib/home-modo.ts`): el archivo cambió, el árbol no.
 *
 * ── POR QUÉ ES ZONA DELICADA ────────────────────────────────────────
 *
 * Acá caen los 301 de `/citas`, `/eventos` y `/ranchos-eventos` con su
 * query intacto, y también el buscador del héroe, que navega a `/` con
 * los parámetros puestos. O sea: esta pantalla es la PÁGINA DE
 * RESULTADOS del sitio, y del otro lado hay links compartidos por
 * WhatsApp, favoritos y resultados de Google todavía indexados.
 *
 * El arnés `scripts/verificar-home.mjs` existe para esto: correrlo
 * después de cada cambio que toque el home.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ──────────────────────────────────────
 * Ni estrellas, ni cifras inventadas, ni negocios de mentira. Los
 * rieles consultan la base — ver `rieles-catalogo.tsx`, que además
 * degrada solo (niveles A/B/C) cuando una vertical tiene poco o nada.
 */
export default function ModoDescubrir({
  catalogo,
  rubro,
  busqueda,
}: {
  catalogo: CatalogoPortada;
  rubro: RubroPortada | null;
  busqueda: BusquedaPortada;
}) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ORGANIZACION) }}
      />

      <AvisoSuperior />

      {/* ════════════════════════════════════════════════════════════
          LA ATMÓSFERA: EL HEADER Y EL HÉROE, BAJO LA MISMA LUZ
          ════════════════════════════════════════════════════════════

          Pedido del dueño (ago 2026): «el blur naranja es estático,
          hacé que se mueva lentamente por todo el header».

          No se movía por el header por una razón estructural, no de
          animación: la aurora vivía DENTRO de `<HeroBusqueda>`, que
          empieza debajo del header. Y su caja lleva `overflow: hidden`
          —lo necesita para recortar las manchas—, así que no podía
          pintar ni un pixel fuera de esa sección.

          Ahora el degradado y la aurora envuelven a los dos. El header
          deja de llevar su propio `#fff4e6` y se vuelve transparente:
          ese color existía justo para tapar la franja blanca que se
          veía entre la banda navy y el arranque del héroe, y ahora esa
          franja es la MISMA superficie que el héroe.

          ⚠️ `isolate` NO ES DECORATIVO. Crea el contexto de apilado que
          hace que el `-z-10` de la aurora se quede ADENTRO. Sin él, un
          z-index negativo se escapa al contexto del documento y la
          aurora termina pintada detrás del fondo de este mismo div —
          invisible. Es exactamente el bug que tuvo /lealtad/ingresar.

          El degradado toca el blanco recién al final: con cinco paradas
          el empalme con el catálogo es continuo y no se lee como un
          corte.

          ── DE CREMA A AZUL (dueño, 2 sep 2026) ──────────────────────
          «Ese header necesito que sea más azul, un poco más fuerte, que
          se vea más azul que naranja».

          El 2 de septiembre las manchas ya habían pasado a azul, pero
          el header se seguía viendo tibio: el degradado de ABAJO seguía
          arrancando en `#fff4e6`, un crema anaranjado. Tres manchas
          azules translúcidas sobre una base cálida dan un resultado
          cálido — la base manda. Cambiarla es lo que de verdad vuelve
          azul la zona, no subirle opacidad a la aurora.

          El azul de arranque (`#d8e6fb`) se eligió medido, no a ojo: el
          navy del titular queda en 10,99:1 y hasta el gris descriptor
          —el texto más débil que se apoya acá— da 4,70:1, así que pasa
          AA sin depender de dónde caiga la mancha en su recorrido. */}
      <div
        className="relative isolate"
        style={{
          background:
            "linear-gradient(180deg,#d8e6fb 0%,#e3edfc 22%,#eff5fd 58%,#f8fbfe 82%,#ffffff 100%)",
        }}
      >
        <div aria-hidden className="aurora-caja -z-10">
          {/* El viaje LARGO (18-26 %) porque la aurora cruza header +
              héroe — con el viaje corto del héroe original (6-9 %) el
              movimiento se perdía contra ese tamaño. Y desde el 2 sep
              2026 es AZUL y un tercio más rápida (pedido del dueño):
              la variante `aurora-azul-*` de globals.css, 31/41/47 s.
              La lenta naranja sigue viva para el login de Lealtad y
              /negocios, que la pidieron lenta a propósito. */}
          <div className="aurora-mancha-lenta aurora-azul-1" />
          <div className="aurora-mancha-lenta aurora-azul-2" />
          <div className="aurora-mancha-lenta aurora-azul-3" />
        </div>

        <HeaderSimple />
        {/* La clave lleva `|sub` cuando el filtro trae subcategoría: es la
            MISMA forma que arma `claveDe` en rubros-icono.tsx, para que el
            disco fino (Peinados, Masajes…) también sepa marcarse activo. */}
        <HeroBusqueda
          rubroActivo={
            rubro
              ? `${rubro.vertical}-${rubro.categoria}${rubro.subcategoria ? `|${rubro.subcategoria}` : ""}`
              : null
          }
        />
      </div>

      <main className="flex-1">
        {/* Debajo del héroe queda SOLO el marketplace (pedido del dueño,
            ago 2026). Se sacaron las cards de «Explorá Bookea» y la
            franja de rubros del final: las cinco puertas ya viven en el
            mega menú del header, y repetirlas dos veces más abajo
            empujaba los negocios reales —lo único que la portada tiene
            de verdad— tan abajo que había que scrollear para verlos.
            Los dos componentes siguen enteros en el repo, solo dejaron
            de importarse acá. */}
        {/* El `id` es el destino del `#catalogo` que llevan los íconos
            del héroe: filtrar sin bajar hasta el resultado dejaría al
            visitante mirando el mismo héroe, convencido de que el clic
            no hizo nada. El `scroll-mt` despeja el header flotante. */}
        <div id="catalogo" className="scroll-mt-24 px-5 pb-12 pt-2 sm:px-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <RielesCatalogo {...catalogo} rubro={rubro} busqueda={busqueda} />
          </div>
        </div>
      </main>

      <SiteFooter />
      <RevealOnScroll />
    </div>
  );
}
