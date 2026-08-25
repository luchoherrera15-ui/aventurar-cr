import type { Metadata } from "next";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import AvisoSuperior from "@/components/home/aviso-superior";
import HeaderSimple from "@/components/home/header-simple";
import HeroBusqueda from "@/components/home/hero-busqueda";
import RielesCatalogo from "@/components/home/rieles-catalogo";
import { DATOS_ORGANIZACION } from "@/lib/seo-organizacion";
import { leerCatalogoPortada } from "./home-datos";
import { urlSitio } from "@/lib/sitio";
import { rubroDeParametro } from "@/lib/rubros-portada";

/**
 * ============================================================
 * LA PORTADA DE BOOKEA — `bookea.lat`
 * ============================================================
 *
 * ── CUARTA VUELTA (pedido del dueño, ago 2026) ────────────────────
 *
 * La portada quedó en TRES cosas y nada más:
 *
 *   1. `AvisoSuperior`   — la franja de arriba de todo.
 *   2. `HeaderSimple`    — logo, las cinco puertas en el mega menú, y
 *                          las acciones. El buscador NO vive acá.
 *   3. `HeroBusqueda`    — el título, el buscador grande y la aurora.
 *   4. `RielesCatalogo`  — el marketplace: un riel por vertical, con
 *                          los negocios que de verdad existen.
 *   5. `SiteFooter`.
 *
 * ── POR QUÉ SE FUERON LAS DOS FRANJAS DE CATEGORÍAS ───────────────
 *
 * Debajo de los rieles vivían «Explorá Bookea» (cinco cards grandes) y
 * «Explorá por rubro» (36 tiles). Las dos listaban lo MISMO que ahora
 * está en el mega menú del header, así que la portada decía tres veces
 * la misma cosa y empujaba los negocios reales —lo único que esta
 * página tiene de verdad— tan abajo que había que scrollear para
 * encontrarlos.
 *
 * Los componentes NO se borraron: `explora-bookea.tsx` y
 * `explorar-rubros.tsx` siguen enteros en `src/components/home/`, solo
 * dejaron de importarse acá. Lo mismo pasó antes con `CarruselServicios`,
 * `CtaLlamada`, `MarketplaceVidriera` y `BloqueNegocios`.
 *
 * ── LA REGLA QUE NO SE NEGOCIA ────────────────────────────────────
 * Ni estrellas, ni cifras inventadas, ni negocios de mentira. Los
 * rieles consultan la base — ver `rieles-catalogo.tsx`.
 */

export const metadata: Metadata = {
  title: {
    absolute: "Bookea — Reservá servicios y encontrá proveedores para eventos",
  },
  description:
    "Reservá citas de belleza, barbería, spa y salud, y encontrá lugares, catering, música y decoración para tu evento en todo Costa Rica. Precios en colones, a la vista, y reserva directa sin cadenas de WhatsApp.",
  alternates: { canonical: urlSitio("/") },
};

/**
 * ── EL FILTRO EN LA MISMA PÁGINA (`?rubro=`) ────────────────────────
 *
 * Pedido del dueño (ago 2026): los nueve íconos del héroe dejaron de
 * mandar a `/citas` y `/eventos` — «la idea es que TODO se encuentre
 * acá mismo». Ahora escriben `?rubro=` y el catálogo de abajo se
 * recorta sin salir de la portada.
 *
 * ⚠️ ESTA PÁGINA PASA A SER DINÁMICA. Leer `searchParams` se lo dice a
 * Next solo: ya no se puede prerenderizar una única versión estática
 * porque hay diez (sin filtro + nueve rubros). No es un descuido; es el
 * precio de que el filtro viva en la URL — y vivir en la URL es lo que
 * hace que el filtro se pueda compartir, marcar y volver atrás con el
 * botón del navegador, que es lo que un visitante espera.
 *
 * El canónico NO lleva el parámetro y eso es a propósito: las diez
 * versiones muestran el mismo catálogo recortado de distinta forma, no
 * diez páginas distintas. Sin eso, Google indexaría nueve duplicados de
 * la portada compitiendo entre sí.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const [catalogo, params] = await Promise.all([
    leerCatalogoPortada(),
    searchParams,
  ]);
  const rubro = rubroDeParametro(params.rubro, params.sub);

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

          El degradado arranca en `#fff4e6` y toca el blanco recién al
          final: con tres paradas el empalme con el catálogo es continuo
          y no se lee como un corte. */}
      <div
        className="relative isolate"
        style={{
          background:
            "linear-gradient(180deg,#fff4e6 0%,#fff6ea 22%,#fffaf3 58%,#fffdfa 82%,#ffffff 100%)",
        }}
      >
        <div aria-hidden className="aurora-caja -z-10">
          {/* Las LENTAS, no las del héroe original: recorren 18-26 % en
              48-67 s en vez de 6-9 % en 23-31 s. Ahora la aurora cruza
              una superficie más alta (header + héroe), y con el viaje
              corto el movimiento se perdía contra ese tamaño. */}
          <div className="aurora-mancha-lenta aurora-lenta-1" />
          <div className="aurora-mancha-lenta aurora-lenta-2" />
          <div className="aurora-mancha-lenta aurora-lenta-3" />
        </div>

        <HeaderSimple />
        <HeroBusqueda rubroActivo={rubro ? `${rubro.vertical}-${rubro.categoria}` : null} />
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
            <RielesCatalogo {...catalogo} rubro={rubro} />
          </div>
        </div>
      </main>

      <SiteFooter />
      <RevealOnScroll />
    </div>
  );
}
