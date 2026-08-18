import Image from "next/image";
import Link from "next/link";
import { IconChevronRight, IconPin } from "@/components/icons";
import { estiloRevelado } from "@/components/revelar";
import { categoriaGradiente, categoriaIcono, categoriaLabel, esCategoriaValida } from "@/lib/categorias-vertical";
import { esDemo } from "@/lib/demo";
import { rutaDeNegocio } from "@/lib/ruta-negocio";
import { SUBCATEGORIA_LABEL, type Rancho } from "@/app/mi-negocio/types";

/**
 * ============================================================
 * «NEGOCIOS DESTACADOS» — LA VITRINA ASOMADA DE LA PORTADA
 * ============================================================
 *
 * La sección `business-peek` de la maqueta (referencia/bookeahome.html):
 * la tira de negocios que tiene que asomar apenas debajo del buscador,
 * sin scrollear. La maqueta comprime el héroe a propósito para que esto
 * entre en la primera pantalla — es su decisión de diseño más fuerte, y
 * acá se respeta.
 *
 * NO ES UN CARRUSEL: sin flechas, sin puntos, sin rotación y sin
 * filtros. Cuatro tarjetas quietas y un «Ver todos →». Todo lo demás de
 * la portada (los rieles) ya tiene controles; esta tira vive de que se
 * lea de un vistazo.
 *
 * ── POR QUÉ UNA TARJETA NUEVA Y NO `RanchoCard` ──────────────────
 * `RanchoCard` es vertical, con la foto en 4:3 arriba: cuatro de esas
 * en fila miden ~330 px de alto y empujan la sección fuera de la
 * primera pantalla, que es exactamente lo que esta sección viene a
 * evitar. Esta es HORIZONTAL —foto en una columna fija de 112 px— y
 * mide 132 px. Es otra forma, no otra versión: agregarle un modo
 * «horizontal» a un componente de 336 líneas con favoritos, cinco
 * insignias y velo de pausa lo haría peor para las dos.
 *
 * Lo que sí se comparte se IMPORTA, nunca se copia: `rutaDeNegocio`
 * (para no comerse el 307 de `/{slug}` en Citas y Restaurantes),
 * `esDemo`, y el trío `categoriaLabel/Gradiente/Icono`. Si mañana
 * cambia el criterio de «esto es un demo», cambia en las dos a la vez.
 *
 * ── LO QUE LA MAQUETA PINTA Y ACÁ NO ─────────────────────────────
 *  · `★ 4.9` — `resenas` tiene CERO filas en producción. Una estrella
 *    inventada en la primera pantalla del sitio es la mentira más cara
 *    que se puede contar.
 *  · `· 4,2 km` — no hay ubicación del visitante. La cabecera de Vercel
 *    da el país, y en Costa Rica el ruteo por Miami hace basura de la
 *    ciudad. «Cerca de vos» pasó a ser «Elegidos a mano», que es
 *    literalmente lo que `super_destacado` significa.
 *  · el chip verde `Hoy` — no hay consulta de disponibilidad que abarque
 *    el directorio entero; la portada no la hace y no la va a hacer.
 *  · el corazón de favorito — el de la maqueta flota en una esquina
 *    rarísima (sobre la foto, no sobre la tarjeta) y traerlo obligaría a
 *    convertir esta pieza en `"use client"` para mandar JavaScript a la
 *    primera pantalla. Los favoritos siguen a un dedo de distancia en
 *    cada tarjeta del riel de más abajo y en la ficha.
 *
 * Y las tipografías suben: la maqueta usa 9 px en el rubro y en la
 * zona. El sitio no baja de 10,5 px, y el kicker naranja va en
 * `naranja-fuerte` (#a83f00, 6,22:1) — el `#ff6b22` de la maqueta sobre
 * blanco da 2,6:1 y no pasa la auditoría que el sitio ya aprobó.
 *
 * Componente de SERVIDOR: son links, fotos y CSS. Cero bytes de JS.
 */

/** Cuántas tarjetas entran. Cuatro, como la maqueta. */
export const TOPE_DESTACADOS = 4;

/**
 * El piso para pintar la sección.
 *
 * Era 3 —el mismo umbral que los rieles de más abajo (MIN_CARRIL)—
 * bajo el argumento de que dos tarjetas sueltas en una fila de 1200 px
 * gritan que el directorio está vacío. Ese argumento no aplica ACÁ: a
 * diferencia de un riel, esta grilla usa `grid-cols-3` con columnas
 * fijas — con 1 o 2 tarjetas, cada una sigue midiendo 1/3 del ancho y
 * queda a la izquierda; no se estira ni una para llenar el resto.
 *
 * Y el dueño lo pidió explícito después de una limpia de la base que
 * dejó solo 2 negocios reales: quiere que el card de Rancho Las Torres
 * se vea SIEMPRE, aunque sea el único. La sección vacía por completo
 * —cero negocios— sigue ocultándose: no hay nada que mostrar ahí.
 */
export const MIN_DESTACADOS = 1;

/** ₡ con separador de miles costarricense — igual que las cards. */
function fmtColones(n: number) {
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default function NegociosDestacados({
  negocios,
  curado,
  verTodoHref,
}: {
  /**
   * Ya filtrados («en configuración» afuera), ya ordenados y ya
   * recortados por `leerDatosHome()`. Acá no se decide nada de datos.
   */
  negocios: Rancho[];
  /**
   * Si la lista sale de los súper destacados que el admin eligió a mano
   * (0169). Cambia el encabezado y nada más: decir «elegidos a mano» de
   * una lista que en realidad es «los últimos publicados» sería
   * afirmar una curaduría que no existe.
   */
  curado: boolean;
  verTodoHref: string;
}) {
  if (negocios.length < MIN_DESTACADOS) return null;

  const lista = negocios.slice(0, TOPE_DESTACADOS);

  // Con tres, tres columnas: cuatro columnas con una celda vacía se lee
  // como un error de carga.
  const columnas = lista.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";

  return (
    <section aria-labelledby="negocios-destacados" className="px-4 pb-10 pt-7 sm:px-6 sm:pb-12 sm:pt-9 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        {/* El encabezado de la maqueta, en chico: el `<h2>` de esta
            sección es de 23 px y no de los 26-40 px de las demás. Es
            una tira de asomo, no un capítulo. */}
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-bookea-naranja-fuerte">
              {curado ? "Elegidos a mano" : "Recién publicados"}
            </p>
            <h2
              id="negocios-destacados"
              className="titulo mt-1.5 text-[20px] text-aventurea-navy sm:text-[23px]"
            >
              {curado ? "Negocios destacados" : "Negocios en Bookea"}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-snug text-aventurea-ink-soft">
              Reservá directo con profesionales y espacios de todo el país.
            </p>
          </div>

          {/* Se esconde en teléfono, igual que en la maqueta: al lado de
              un título de 20 px se apretuja, y la tira entera es
              deslizable hasta el final. */}
          <Link
            href={verTodoHref}
            className="group hidden shrink-0 items-center gap-1.5 whitespace-nowrap pt-4 text-[13px] font-bold text-aventurea-navy underline underline-offset-4 hover:text-aventurea-orange sm:inline-flex"
          >
            Ver todos
            <IconChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Grilla en escritorio, RIEL en teléfono — las dos cosas, como
            la maqueta. El `-mr-4` deja que la segunda tarjeta sangre
            contra el borde: es lo que dice «esto se desliza» sin poner
            una flecha de 32 px que en un dedo no se acierta.

            `sm:justify-items-start`: con 1 o 2 negocios cada tarjeta
            sigue ocupando su columna de `grid-cols-3`, pero sin
            estirarse a llenarla — la tarjeta tiene su propio ancho fijo
            (ver `TarjetaDestacada`) y deja de arrastrar una franja
            blanca vacía a la derecha del precio. */}
        <div
          className={`mt-5 grid auto-cols-[84%] grid-flow-col gap-2.5 overflow-x-auto pb-1.5 pt-0.5 snap-x snap-mandatory -mr-4 sm:mr-0 sm:auto-cols-auto sm:grid-flow-row sm:justify-items-start sm:gap-3 sm:overflow-visible ${columnas}`}
          style={{ scrollbarWidth: "none" }}
        >
          {lista.map((negocio, i) => (
            <TarjetaDestacada
              key={negocio.id}
              negocio={negocio}
              indice={i}
              // La primera foto de esta tira es la primera imagen REAL
              // de la portada en cualquier pantalla: el héroe de arriba
              // es texto sobre degradado y su collage es decorativo y
              // solo de escritorio. Es la única de toda la página que
              // pide prioridad alta — el riel de más abajo la tiene
              // apagada a propósito (`prioridad={false}`).
              prioritaria={i === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TarjetaDestacada({
  negocio,
  indice,
  prioritaria,
}: {
  negocio: Rancho;
  indice: number;
  prioritaria: boolean;
}) {
  const vertical = negocio.vertical ?? "eventos";
  const zona = [negocio.canton, negocio.provincia].filter(Boolean).join(", ");
  const demo = esDemo(negocio.slug, negocio.detalles);
  // Mismo criterio que RanchoCard: la subcategoría dice más que la
  // categoría («Ranchos para fiestas» le gana a «Lugares»), y si la
  // categoría no es válida para esta vertical se muestra cruda antes
  // que en blanco.
  const rubro = negocio.subcategoria
    ? (SUBCATEGORIA_LABEL[negocio.subcategoria] ?? negocio.subcategoria)
    : esCategoriaValida(vertical, negocio.categoria)
      ? categoriaLabel(vertical, negocio.categoria)
      : negocio.categoria;

  // eslint-disable-next-line react-hooks/purity -- «nuevo» es una etiqueta de vitrina; no pasa nada si queda desactualizada un instante entre renders
  const esNuevo = Date.now() - new Date(negocio.created_at).getTime() < 1000 * 60 * 60 * 24 * 30;

  return (
    <Link
      href={rutaDeNegocio(negocio)}
      data-reveal
      style={estiloRevelado(indice, 70)}
      className="group grid h-[124px] snap-start grid-cols-[104px_1fr] overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_5px_18px_-6px_rgba(22,41,94,0.16)] transition-all hover:-translate-y-[3px] hover:border-aventurea-navy/40 hover:shadow-[0_14px_30px_-14px_rgba(22,41,94,0.35)] sm:h-[132px] sm:w-[280px] sm:grid-cols-[112px_1fr]"
    >
      <div
        className="relative overflow-hidden bg-aventurea-blue-light"
        style={
          !negocio.foto_url
            ? { backgroundImage: categoriaGradiente(vertical, negocio.categoria) }
            : undefined
        }
      >
        {negocio.foto_url ? (
          <Image
            src={negocio.foto_url}
            alt={negocio.nombre}
            fill
            // `eager` + prioridad alta sin `<link preload>`: es el mismo
            // criterio de RanchoCard, y los docs de Next 16 desaconsejan
            // el preload cuando hay varias listas en la página.
            loading={prioritaria ? "eager" : undefined}
            fetchPriority={prioritaria ? "high" : undefined}
            // La columna mide 104-112 px; con DPR2 el candidato útil es
            // el de 256. Sin este `sizes` el navegador se bajaría uno de
            // 640 para pintar 112.
            sizes="120px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-8 [&_svg]:w-8">
            {categoriaIcono(vertical, negocio.categoria)}
          </span>
        )}

        {/* El aviso de muestra va ENCIMA de la foto y no en una esquina
            del cuerpo: hay demos sembrados en producción que parecen
            negocios reales (Café Oscuro, SILENCE BARBER SHOP) y esta es
            la primera tira que se ve del sitio. */}
        {demo && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
            Demo
          </span>
        )}

        {/* «Nuevo» va sobre la foto y no en el cuerpo: es lo primero
            que se lee de la tarjeta, no algo que compite con el precio
            por una esquina de 11px. En la esquina opuesta a «Demo» —
            un negocio sembrado y uno recién publicado no chocan. */}
        {esNuevo && negocio.destacado_orden == null && (
          <span className="insignia-nueva absolute right-1.5 top-1.5 rounded-md bg-aventurea-blue px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">
            Nuevo
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col p-3">
        <span className="truncate text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-bookea-naranja-fuerte">
          {rubro}
        </span>

        <h3 className="mt-1 truncate text-[13.5px] font-extrabold leading-tight text-aventurea-ink">
          {negocio.nombre}
        </h3>

        {zona && (
          <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-aventurea-ink-soft">
            <IconPin className="h-3 w-3 shrink-0 text-aventurea-navy" />
            <span className="truncate">{zona}</span>
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {/* El precio SIN la unidad: esta tira mezcla verticales y
              `unidad_precio` arrastra el 'evento' por defecto de la
              0033, así que «desde ₡8.000 por evento» en una barbería
              sería falso. El monto sí es cierto; la unidad está en la
              ficha, donde el dueño la puede corregir. */}
          <span className="min-w-0 truncate text-[11.5px] text-aventurea-ink-soft">
            {typeof negocio.precio_desde === "number" && negocio.precio_desde > 0 ? (
              <>
                Desde{" "}
                <strong className="font-extrabold text-aventurea-ink">
                  {fmtColones(negocio.precio_desde)}
                </strong>
              </>
            ) : (
              "Consultar"
            )}
          </span>

          {/* En el lugar donde la maqueta pone `★ 4.9`. Acá va lo único
              que la base sostiene: la marca a mano del admin. «Nuevo»
              se mudó a la foto (ver arriba); si un día `resenas` deja
              de estar en cero, este es el hueco donde entra la nota. */}
          {negocio.destacado_orden != null && (
            <span className="shrink-0 rounded-md bg-aventurea-sky px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
              ★ Destacado
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
