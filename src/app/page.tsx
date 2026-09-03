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
  demo = false,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
  /**
   * ⚠️ EL MODO DEMOSTRACIÓN: LA MISMA PORTADA, CON EL OTRO CATÁLOGO.
   *
   * Pedido del dueño (27 ago 2026): «necesito el MISMO MISMO sitio de
   * Bookea, solamente que lleno de demos, con los cards iguales a los
   * de Bookea normal, todo igual».
   *
   * Primero le hice una página aparte y estaba mal: por más que reusara
   * las mismas piezas, era OTRA pantalla — con su encabezado, su franja
   * y su propio armado. Lo que se enseña en una demo tiene que ser el
   * producto, no una imitación del producto.
   *
   * Así que la portada es UNA sola y este bandera cambia únicamente de
   * dónde salen los negocios. Todo lo demás —el héroe, el buscador, los
   * íconos de rubro, los carriles, la tarjeta— es literalmente el mismo
   * código. Si mañana cambia la tarjeta, cambia en los dos a la vez,
   * que es la única forma de que la demo no se despegue del producto.
   */
  demo?: boolean;
}) {
  /**
   * ⚠️ ACÁ SE PRE-CALENTABA `leerCenso()` (dos viajes a Supabase en
   * paralelo en vez de en fila; llegó a medirse en 480 ms el servidor
   * de `/`). Se quitó el 28 ago 2026: la grilla de rubros de dos
   * carriles tiene orden CURADO y ya no consulta el censo, así que la
   * llamada calentaba una promesa que nadie esperaba — una ida a la
   * base por visita, de regalo. Si algún componente de la portada
   * vuelve a necesitar el censo, este es el lugar donde arrancarlo.
   */
  const [catalogo, params] = await Promise.all([
    leerCatalogoPortada(demo),
    searchParams,
  ]);
  const rubro = rubroDeParametro(params.rubro, params.sub);

  /**
   * ── LA BÚSQUEDA DEL HÉROE (`?q=` y `?lugar=`) ────────────────────
   * El buscador grande ya no manda a /citas ni /eventos — esos
   * directorios se borraron y sus redirects traen a la gente ACÁ con
   * el query intacto — así que la portada es quien filtra.
   * `?provincia=` se acepta como sinónimo de `?lugar=`: es el nombre
   * que llevaban los enlaces de los directorios viejos, y esos siguen
   * vivos en historiales y chats compartidos.
   */
  const uno = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const busqueda = {
    q: uno(params.q),
    lugar: uno(params.lugar) || uno(params.provincia),
  };

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
