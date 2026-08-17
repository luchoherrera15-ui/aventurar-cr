/**
 * Las piezas de las pantallas de carga (los `loading.tsx` de cada ruta).
 *
 * ¿Por qué existen? Medido en producción: en las páginas dinámicas el
 * navegador pasaba entre 176 y 685 ms SIN SABER todavía qué CSS ni qué
 * JS pedir, porque Next no puede mandar el `<head>` hasta que el
 * componente de la página termina de renderizar — y eso incluye
 * esperar a Supabase. En /citas/[slug] eran 685 ms de pantalla en
 * blanco puramente por eso; en /rancholastorres, 597 ms.
 *
 * Un `loading.tsx` crea un límite de Suspense en la ruta: Next manda
 * de inmediato el armazón (html + head con los preloads de CSS/JS + este
 * esqueleto) y va transmitiendo el contenido real cuando la base
 * contesta. El TTFB pasa a ser el del armazón, no el de las consultas.
 *
 * Regla de diseño: el esqueleto CALCA la forma de la página (el lugar de
 * la foto, del título y del precio). No un spinner centrado — un hueco
 * con la forma correcta hace que la misma espera se sienta la mitad, y
 * además evita que la página salte cuando llega el contenido.
 *
 * ⚠️ POR QUÉ CASI NO HAY `loading.tsx` ACÁ, Y SÍ `<Suspense>`
 *
 * Un `loading.tsx` no cubre solo su página: cubre TODO el segmento,
 * hijos incluidos. Lo probé contra el servidor de producción local y
 * rompía los 404: con `src/app/citas/loading.tsx` puesto,
 * `/citas/no-existe-este-negocio` respondía **200** en vez de 404, y
 * `/eventos/<uuid inexistente>` igual — porque el armazón sale por el
 * cable ANTES de que la página corra su `notFound()`, y para entonces
 * la cabecera HTTP ya se mandó. Para Google eso son páginas basura
 * indexables.
 *
 * Por eso las rutas públicas con hijos dinámicos usan un `<Suspense>`
 * DENTRO de la página, puesto después de lo que decide el estado HTTP.
 * Se gana lo mismo (el `<head>` con los preloads sale de una) sin
 * mentir con el código de respuesta. Verificado después del cambio:
 * `/zzz-no-existe` → 404, `/citas/no-existe` → 404.
 *
 * `loading.tsx` sí queda donde no hay hijos con `notFound()` público:
 * /hospedajes y /mi-negocio/[id] (panel privado, detrás de sesión).
 */

/** Un bloque gris que respira. La forma la pone quien lo usa. */
export function Bloque({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-aventurea-navy/[0.07] ${className}`}
    />
  );
}

/**
 * La barra de arriba del sitio, del alto exacto del SiteHeader real
 * (64px) para que el contenido no salte cuando llega el header de
 * verdad.
 */
export function EsqueletoHeader({ ancho = "max-w-[1600px]" }: { ancho?: string }) {
  return (
    <div className="h-16 border-b border-aventurea-line bg-white">
      <div className={`mx-auto flex h-full ${ancho} items-center gap-4 px-4 lg:px-6`}>
        <Bloque className="h-7 w-[130px]" />
        <div className="flex-1" />
        <Bloque className="hidden h-8 w-[120px] sm:block" />
        <Bloque className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

/**
 * La tarjeta de un negocio: foto 16/10, nombre, ubicación y la línea de
 * precio abajo — el mismo esquema de rancho-card / CardNegocio.
 */
export function EsqueletoCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-aventurea-line bg-white ${className}`}
    >
      <Bloque className="aspect-[16/10] w-full rounded-none" />
      <div className="p-4">
        <Bloque className="h-4 w-3/4" />
        <Bloque className="mt-2 h-3 w-1/2" />
        <div className="mt-3 flex items-center justify-between border-t border-[#e8eef8] pt-3">
          <Bloque className="h-3.5 w-24" />
          <Bloque className="h-3.5 w-16" />
        </div>
      </div>
    </div>
  );
}

/** La grilla de tarjetas de un directorio. */
export function EsqueletoGrilla({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cantidad }, (_, i) => (
        <EsqueletoCard key={i} />
      ))}
    </div>
  );
}

/** El carrusel de Súper destacados de arriba de la portada (0169). */
export function EsqueletoCarrusel() {
  return <Bloque className="mb-5 h-[280px] w-full rounded-3xl sm:h-[340px] lg:h-[420px]" />;
}

/**
 * La vitrina del héroe de la PORTADA mientras la base contesta.
 *
 * No usa `Bloque` a propósito: ese gris es `bg-aventurea-navy/[0.07]`,
 * calibrado para el lienzo crema, y sobre el navy del hero desaparece
 * — el hueco se leería como un agujero en la página, que es justo lo
 * que un esqueleto viene a evitar. Acá el relleno es blanco
 * translúcido.
 *
 * Las alturas son las MISMAS que las de la diapositiva del carrusel
 * (carrusel-super-destacados.tsx) y las de los tres niveles de la
 * vitrina (home-secciones.tsx). Si midieran distinto, el hero saltaría
 * de alto al llegar los datos, que es la peor forma de estrenar la URL
 * más visitada del sitio.
 */
export function EsqueletoVitrinaHome() {
  return (
    <div
      aria-hidden
      className="h-[280px] w-full animate-pulse rounded-3xl bg-white/10 sm:h-[340px] lg:h-[420px]"
    />
  );
}

/**
 * Una grilla de categorías de la portada: el encabezado y las seis
 * tarjetas. Calca `grilla-categorias.tsx` — mismas columnas por
 * ancho y mismos `min-h`, o la página se movería al llegar los
 * conteos.
 */
export function EsqueletoGrillaCategorias() {
  return (
    <div>
      <Bloque className="h-3 w-32" />
      <Bloque className="mt-3 h-8 w-[min(420px,80%)]" />
      <Bloque className="mt-3 h-3.5 w-[min(560px,90%)]" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Bloque
            key={i}
            className="min-h-[150px] rounded-2xl sm:min-h-[180px] lg:min-h-[210px]"
          />
        ))}
      </div>
    </div>
  );
}

/**
 * El riel horizontal de negocios (RielProveedores): el título y la
 * fila de tarjetas. El ancho de cada una es el mismo `clamp` del riel
 * real, y la fila va con `overflow-hidden` porque el riel de verdad se
 * sale de la pantalla a propósito.
 */
export function EsqueletoRiel({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div>
      <Bloque className="h-3 w-28" />
      <Bloque className="mt-3 h-7 w-[min(320px,70%)]" />
      <div className="mt-5 flex gap-4 overflow-hidden">
        {Array.from({ length: cantidad }, (_, i) => (
          <EsqueletoCard key={i} className="w-[clamp(240px,70vw,330px)] shrink-0" />
        ))}
      </div>
    </div>
  );
}

/**
 * EL PANEL DE UNA PESTAÑA DE LA PORTADA mientras la base contesta.
 *
 * Calca la forma final (src/app/home-carriles.tsx): la grilla de
 * categorías arriba y los carriles por rubro debajo. No es un
 * rectángulo genérico a propósito — el CLS del sitio es 0,000 y la
 * regla del archivo es que el esqueleto tenga la forma de lo que viene,
 * no el tamaño de un spinner.
 *
 * Dos carriles y no seis: cuántas filas salen depende de cuántos rubros
 * lleguen al mínimo, así que un número exacto no existe. Dos es lo que
 * garantiza el nivel A, o sea el piso de lo que se va a ver; si llegan
 * más, la página crece hacia abajo, que es donde todavía no hay nada
 * pintado y por lo tanto nada que empujar.
 */
export function EsqueletoPanelVertical() {
  return (
    <div className="flex flex-col gap-14">
      <EsqueletoGrillaCategorias />
      <div className="flex flex-col gap-6">
        <EsqueletoRiel />
        <EsqueletoRiel />
      </div>
    </div>
  );
}

/**
 * LA TIRA «NEGOCIOS DESTACADOS» de la portada mientras la base
 * contesta (src/components/negocios-destacados.tsx).
 *
 * Mide EXACTAMENTE lo mismo que la tira real —124 px en teléfono, 132
 * en el resto, mismas columnas por ancho, mismos `gap`— porque esta
 * sección es lo primero que se ve debajo del buscador: si el esqueleto
 * midiera distinto, la portada daría un salto justo en el momento que
 * Google mide, con el CLS del sitio hoy en 0,000.
 *
 * En teléfono va con `overflow-hidden` y no con scroll: la tira real se
 * sale de la pantalla a propósito, pero un esqueleto deslizable no
 * tiene a dónde ir.
 */
export function EsqueletoDestacados({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div>
      <Bloque className="h-3 w-28" />
      <Bloque className="mt-2.5 h-6 w-[min(260px,60%)]" />
      <Bloque className="mt-2.5 h-3 w-[min(380px,80%)]" />
      <div className="-mr-4 mt-5 grid auto-cols-[84%] grid-flow-col gap-2.5 overflow-hidden pb-1.5 pt-0.5 sm:mr-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: cantidad }, (_, i) => (
          <Bloque key={i} className="h-[124px] rounded-2xl sm:h-[132px]" />
        ))}
      </div>
    </div>
  );
}

/** El buscador + la fila de chips de categoría de los directorios. */
export function EsqueletoFiltros() {
  return (
    <>
      <Bloque className="h-12 w-full rounded-xl" />
      <div className="mt-3 flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <Bloque key={i} className="h-9 w-[104px] shrink-0 rounded-full" />
        ))}
      </div>
    </>
  );
}
