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
 * ── POR QUÉ UNA TARJETA PROPIA Y NO `RanchoCard` ─────────────────
 * Dos razones, y la primera es dura: `RanchoCard` es `"use client"`
 * (useState, useTransition, useRouter y el import de `alternarFavorito`
 * para el corazón). Reusarla acá mandaría JavaScript a la PRIMERA
 * pantalla del sitio, que es justo lo que esta sección no hace.
 * La segunda es de composición: `RanchoCard` ya se ve seis veces más
 * abajo en los rieles de esta misma portada. Si esta tira también fuera
 * vertical, la página mostraría el mismo objeto tres veces seguidas y
 * la sección perdería registro propio. Es HORIZONTAL a propósito: dos
 * por fila, foto en el 42 % de la tarjeta, 176 px de alto — la sección
 * sigue asomando debajo del buscador con los negocios que hay hoy.
 * Lo que sí se comparte son las clases: radio, borde, sombra, hover,
 * insignias y pie con `border-t` son los LITERALES de `RanchoCard`.
 * Que las dos familias de tarjeta del sitio usen la misma elevación y
 * las mismas insignias es lo que se lee como profesional; el tamaño de
 * la foto viene después.
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

        {/* RIEL en teléfono, DOS POR FILA de `sm` para arriba. El `-mr-4`
            deja que la segunda tarjeta sangre contra el borde: es lo que
            dice «esto se desliza» sin poner una flecha de 32 px que en un
            dedo no se acierta.

            De `sm` para arriba NO es una grilla, es `flex-wrap` con base
            del 50 %. La grilla de columnas fijas era el problema que el
            dueño señaló: con 2 negocios, `grid-cols-3` reservaba una
            tercera columna que nadie ocupaba y las tarjetas no quedaban
            separadas entre sí, quedaban separadas de un hueco. Con
            `flex-wrap` entre tarjeta y tarjeta solo hay `gap`, y la regla
            vale igual para 1, 2, 3 o 4 — sin condicionales por conteo,
            que es lo que rompería el esqueleto (ver `EsqueletoDestacados`).

            `has-[>*:only-child]:justify-center`: con UN solo negocio
            (MIN_DESTACADOS es 1) media fila quedaría vacía; centrada se
            lee deliberada. Es CSS, no un branch de datos. */}
        <div
          className="-mr-4 mt-5 grid auto-cols-[88%] grid-flow-col gap-2.5 snap-x snap-mandatory overflow-x-auto pb-1.5 pt-0.5 sm:mr-0 sm:flex sm:flex-wrap sm:gap-5 sm:overflow-visible sm:has-[>*:only-child]:justify-center"
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

        {/* El «Ver todos» del encabezado está en `sm:inline-flex`: en
            teléfono no existe. Y el riel termina en la última tarjeta sin
            puerta a ningún lado. Esta es esa puerta, y solo en teléfono. */}
        <Link
          href={verTodoHref}
          className="mt-3.5 flex items-center justify-center gap-1.5 rounded-xl border border-aventurea-line bg-white py-2.5 text-[13px] font-bold text-aventurea-navy sm:hidden"
        >
          Ver todos los negocios
          <IconChevronRight className="h-3.5 w-3.5" />
        </Link>
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
  const destacado = negocio.destacado_orden != null;

  return (
    <Link
      href={rutaDeNegocio(negocio)}
      data-reveal
      style={estiloRevelado(indice, 70)}
      // La foto es el 42 % de la tarjeta a TODO ancho: una sola regla en
      // vez de columnas en píxeles que se descalibran por breakpoint. Da
      // 138×150 en un teléfono de 390, 194×168 en 1024 y 248×176 en 1280
      // — de 1,2 a 3,0 veces el área de la miniatura de 112×132 de antes,
      // y nunca menos que ella.
      // Sombra, hover y radio son los LITERALES de `RanchoCard`: las dos
      // familias de tarjeta se ven en la misma pantalla y hasta hoy
      // hablaban dos idiomas de elevación distintos.
      className="group grid h-[150px] w-full snap-start grid-cols-[42%_1fr] overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-aventurea-navy/50 hover:shadow-[0_20px_44px_-20px_rgba(22,41,94,0.4)] sm:h-[152px] sm:w-[calc(50%-10px)] lg:h-[168px] xl:h-[176px]"
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
            // La columna ya no mide 112 px: mide 42 % de media fila. El
            // `sizes="120px"` de antes serviría un candidato de 128
            // estirado a 248 y la foto LCP de la portada saldría lavada.
            sizes="(max-width: 640px) 37vw, (max-width: 1280px) 20vw, 248px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-10 [&_svg]:w-10 lg:[&_svg]:h-12 lg:[&_svg]:w-12">
            {categoriaIcono(vertical, negocio.categoria)}
          </span>
        )}

        {/* Una sola columna de insignias, arriba a la derecha, con las
            clases y el ORDEN de `RanchoCard`: Demo siempre (hay demos
            sembrados en producción que parecen negocios reales), y
            «★ Destacado» le gana el puesto a «Nuevo» — un negocio que el
            admin eligió a mano no necesita anunciar que es reciente.
            «★ Destacado» estaba en el pie de la tarjeta y se sube acá:
            ese hueco del pie ahora lo ocupa el CTA. */}
        <span className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5 lg:right-3 lg:top-3">
          {demo && (
            <span className="rounded-lg bg-amber-400 px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm lg:px-2.5">
              Demo
            </span>
          )}
          {destacado ? (
            <span className="rounded-lg bg-aventurea-sky px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-sm lg:px-2.5">
              ★ Destacado
            </span>
          ) : esNuevo ? (
            <span className="insignia-nueva rounded-lg bg-white/90 px-2 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-ink shadow-sm backdrop-blur lg:px-2.5">
              Nuevo
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex min-w-0 flex-col px-3.5 py-3 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4">
        {/* El rubro se queda de kicker en el cuerpo y NO se muda a un chip
            sobre la foto como en `RanchoCard`. Motivo medido: la columna
            de foto es el 42 % de media fila, o sea 122 px a 640 px de
            viewport — «Ranchos para fiestas» truncaría a la mitad justo
            en tablet. Acá tiene entre 169 y 342 px y entra siempre. De
            paso la tarjeta conserva el único color de marca que tiene. */}
        <span className="truncate text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-bookea-naranja-fuerte lg:text-[11px] lg:tracking-[0.09em]">
          {rubro}
        </span>

        {/* El nombre pasa de 13,5 px a 15-17: antes el nombre del negocio
            pesaba lo mismo que su precio y que su rubro —cuatro tamaños
            dentro de 3 px— y eso es lo que se leía como amateur. Ahora la
            distancia entre el dato más grande y el más chico es de 6,5 px.
            `line-clamp-2` y no `truncate`: con 169 px de columna a 768,
            «SILENCE BARBER SHOP» se cortaba. */}
        <h3 className="mt-0.5 line-clamp-2 text-[15px] font-extrabold leading-tight text-aventurea-ink lg:text-[16.5px] xl:text-[17px]">
          {negocio.nombre}
        </h3>

        {zona && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-aventurea-ink-soft lg:text-[12.5px]">
            <IconPin className="h-3.5 w-3.5 shrink-0 text-aventurea-navy" />
            <span className="truncate">{zona}</span>
          </p>
        )}

        {/* El `border-t` convierte esta línea en un pie de tarjeta de
            verdad, que es el recurso de `RanchoCard` y lo que más se lee
            como «catálogo serio» sin agregar ni un dato inventado. */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-aventurea-line/70 pt-2.5">
          {/* El precio SIN la unidad: esta tira mezcla verticales y
              `unidad_precio` arrastra el 'evento' por defecto de la
              0033, así que «desde ₡8.000 por evento» en una barbería
              sería falso. El monto sí es cierto; la unidad está en la
              ficha, donde el dueño la puede corregir. */}
          <span className="min-w-0 truncate text-[12px] text-aventurea-ink-soft lg:text-[12.5px]">
            {typeof negocio.precio_desde === "number" && negocio.precio_desde > 0 ? (
              <>
                Desde{" "}
                <strong className="text-[13.5px] font-extrabold text-aventurea-ink lg:text-[14.5px]">
                  {fmtColones(negocio.precio_desde)}
                </strong>
              </>
            ) : (
              "Consultar"
            )}
          </span>

          {/* Mismo lugar y mismo tono donde `RanchoCard` pone «Reservar →».
              Oculto en teléfono: en 329 px de tarjeta le pelearía el
              espacio al precio, y ahí la tarjeta entera ya es el botón. */}
          <span className="hidden shrink-0 text-[12.5px] font-extrabold text-bookea-naranja-fuerte sm:inline lg:text-[13px]">
            Ver negocio →
          </span>
        </div>
      </div>
    </Link>
  );
}
