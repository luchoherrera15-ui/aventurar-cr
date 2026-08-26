import Image from "next/image";
import Link from "next/link";
import CarruselSuperDestacados from "@/components/carrusel-super-destacados";
import RielProveedores from "@/components/riel-proveedores";
import InsigniaVerificado from "@/components/insignia-verificado";
import type { Calificacion } from "@/components/rancho-card";
import { IconPin } from "@/components/icons";
import { categoriaGradiente, categoriaIcono, categoriaLabel } from "@/lib/categorias-vertical";
import { esDemo } from "@/lib/demo";
import { MIN_CARRIL } from "@/lib/carriles-home";
import type { Rancho } from "@/app/mi-negocio/types";
import { rutaDeNegocio, verticalDe, type DatosHome } from "./home-datos";

/**
 * ============================================================
 * LAS SECCIONES DE LA PORTADA QUE MUESTRAN NEGOCIOS REALES
 * ============================================================
 *
 * Dos piezas, las dos de SERVIDOR (sin "use client"): componen
 * componentes que ya existen y les pasan los datos que salieron de
 * `leerDatosHome()`. No hay estado ni efectos acá.
 *
 * ── LA REGLA QUE ORDENA TODO ESTE ARCHIVO ────────────────────────
 * Hoy hay 8 negocios aprobados, 5 son de muestra y 1 no se puede
 * abrir. Con esos números, una sección que se pinta "como sea" queda
 * peor que una sección ausente: un riel con una sola tarjeta grita que
 * el directorio está vacío. Por eso hay umbrales, y por eso la vitrina
 * tiene tres niveles de degradado en vez de un hueco.
 *
 * ── LO QUE ACÁ NO SE MUESTRA, Y POR QUÉ ──────────────────────────
 * Ni estrellas, ni "negocio verificado", ni "+2k personas reservando".
 * En producción `resenas` tiene CERO filas, `calificaciones_rancho`
 * devuelve cero, `favoritos` cero, y van 125 reservas en toda la
 * historia de la plataforma. La maqueta de referencia prometía las tres
 * cosas: las tres serían inventadas. Se muestran solo el rubro, la
 * zona, el aviso «Nuevo», el aviso «Demo» y el «Desde ₡X» — que salen
 * de columnas que el dueño del negocio llenó.
 *
 * Por eso también la sección se llama «Lo nuevo en Bookea» y no
 * «Favoritos en Costa Rica»: `created_at desc` es el único orden que
 * los datos sostienen.
 */

/**
 * El mínimo para que un riel se vea deliberado y no vacío.
 *
 * Vive en @/lib/carriles-home y no acá: los carriles por rubro de la
 * portada aplican EXACTAMENTE el mismo umbral, y con dos copias del
 * número la portada podría terminar escondiendo una fila de dos
 * tarjetas en un lado y mostrándola en el otro. La constante va allá
 * porque aquel módulo es neutro y este es de servidor — la dependencia
 * solo puede ir en esa dirección.
 */
const MINIMO_RIEL = MIN_CARRIL;

/**
 * La altura reservada de la vitrina, IDÉNTICA en los tres niveles del
 * degradado (§3.2 del plan). Si cada nivel midiera distinto, caer al
 * nivel B o C movería el héroe entero hacia arriba o hacia abajo. Son
 * las mismas medidas que usa la diapositiva de
 * carrusel-super-destacados.tsx: cambiar una obliga a cambiar la otra.
 */
const ALTO_VITRINA = "h-[280px] sm:h-[340px] lg:h-[420px]";

/**
 * Cuánto dura «recién publicado». Es EL MISMO umbral que usa
 * `RanchoCard` para su insignia «Nuevo» (rancho-card.tsx): la portada y
 * la tarjeta no pueden discrepar sobre qué es nuevo, porque el mismo
 * negocio aparece en las dos a la vez.
 */
const DIAS_NUEVO = 30 * 24 * 60 * 60 * 1000;

/**
 * ============================================================
 * LA VITRINA DEL HÉROE, CON SU DEGRADADO DE TRES NIVELES
 * ============================================================
 *
 * NIVEL A · hay súper destacados → el carrusel de siempre.
 * NIVEL B · no hay ninguno, pero sí un negocio pintable con foto → una
 *           sola tarjeta estática, sin flechas, sin puntos y sin
 *           rotación, con el negocio más nuevo.
 * NIVEL C · no hay nada que pintar → bloque de marca. Ocupa el mismo
 *           espacio y no deja un hueco.
 *
 * POR QUÉ EL NIVEL B EXISTE. `super_destacado` la trajo la migración
 * 0169 y acá las migraciones las pega el dueño a mano en el SQL Editor:
 * hay bases (local, un staging, una restauración) donde esa columna
 * puede no existir. Ahí PostgREST devuelve error, `leerSuperDestacados`
 * devuelve `[]` —está escrito así a propósito— y sin degradado la
 * portada arrancaría con un agujero justo arriba de todo. La portada es
 * la URL más visitada del sitio: no puede depender de una columna
 * decorativa.
 */
export function VitrinaHome({
  destacados,
  respaldo,
}: {
  destacados: DatosHome["destacados"];
  respaldo: DatosHome["respaldoVitrina"];
}) {
  // NIVEL A. Nunca se le pasa un arreglo vacío al carrusel: con cero
  // negocios devuelve null y el `mb-5` de su sección se perdería.
  if (destacados.length > 0) return <CarruselSuperDestacados negocios={destacados} />;

  // NIVEL B.
  if (respaldo) return <VitrinaRespaldo negocio={respaldo} />;

  // NIVEL C.
  return <VitrinaSinDatos />;
}

/**
 * Nivel B: la misma pinta que una diapositiva del carrusel, pero
 * quieta y sin controles.
 *
 * ⚠️ POR QUÉ NO SE REUSA `CarruselSuperDestacados` CON UN SOLO
 * NEGOCIO. Técnicamente funciona —con `total === 1` el componente ya
 * apaga la rotación, las flechas, los puntos y el botón de pausa— pero
 * su diapositiva lleva escrito el sello «★ Súper destacado», y este
 * negocio NO fue elegido por nadie: es simplemente el más nuevo. Sería
 * afirmar una curaduría que no existe, que es exactamente lo que este
 * home evita en todas partes. El arreglo barato es un prop de etiqueta
 * en el carrusel; se dejó para cuando ese archivo no tenga otro dueño.
 *
 * No es «otra tarjeta de negocio»: no aparece en ninguna grilla ni
 * riel, no tiene corazón de favorito, ni hueco para calificación, ni
 * botón de reservar. Es el marco del héroe, y por eso vive acá y no en
 * rancho-card.tsx.
 */
function VitrinaRespaldo({ negocio }: { negocio: Rancho }) {
  const vertical = verticalDe(negocio);
  const ubicacion = [negocio.canton, negocio.provincia].filter(Boolean).join(", ");
  // Criterio compartido (@/lib/demo): mira `detalles.demo` además del
  // prefijo del slug. Con solo el slug, los demos sembrados para
  // parecer un negocio real salían de héroes de la portada sin aviso.
  const demo = esDemo(negocio.slug, negocio.detalles);
  // eslint-disable-next-line react-hooks/purity -- «nuevo» es una etiqueta de vitrina; no pasa nada si queda desactualizada un instante entre renders
  const esNuevo = Date.now() - new Date(negocio.created_at).getTime() < DIAS_NUEVO;

  return (
    <section
      className={`relative mb-5 overflow-hidden rounded-3xl bg-aventurea-navy shadow-[0_24px_60px_-28px_rgba(6,38,83,0.55)] ${ALTO_VITRINA}`}
    >
      <h2 className="sr-only">Lo último publicado en Bookea</h2>

      <Link href={rutaDeNegocio(negocio)} className="group block h-full">
        <div
          className="absolute inset-0"
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
              // Es el elemento LCP de la portada cuando este nivel se
              // pinta: sin prioridad el navegador lo dejaría para el
              // final. `quality={60}` porque va detrás de un velo y a
              // tamaño de banner (60/75/82 son las únicas calidades que
              // next.config permite).
              priority
              quality={60}
              // El contenedor de la portada es max-w-[1200px] con px-4
              // (lg:px-6): arriba de 1248px el ancho real queda fijo.
              sizes="(min-width: 1248px) 1200px, (min-width: 1024px) calc(100vw - 48px), calc(100vw - 32px)"
              className="object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-white/25 [&_svg]:h-16 [&_svg]:w-16">
              {categoriaIcono(vertical, negocio.categoria)}
            </span>
          )}
        </div>

        {/* El velo arranca a media altura: abajo tapa lo justo para que
            el texto blanco se lea sobre cualquier foto, arriba deja la
            foto limpia. Mismo degradado que la diapositiva. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,38,83,0.93)_0%,rgba(6,38,83,0.62)_28%,rgba(6,38,83,0.12)_58%,transparent_78%)]" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 sm:p-8">
          <span className="flex flex-wrap items-center gap-2">
            {/* «Recién publicado» SOLO si de verdad lo es.
                Este negocio sale de «el primero de la lista ordenada por
                fecha», que no es lo mismo que «nuevo»: con el directorio
                quieto —8 negocios y ninguno entrando— el primero puede
                tener ocho meses, y la portada lo estaría anunciando como
                recién llegado. El umbral es el MISMO que ya usa
                RanchoCard (30 días): dos definiciones de «nuevo» en la
                misma pantalla se contradicen el día que alguien toca una. */}
            {/* ⚠️ La insignia le gana el puesto a «Recién publicado»,
                que es el «Nuevo» de esta pantalla con otro nombre. Ver
                `rancho-card.tsx`: las dos etiquetas dicen cosas
                opuestas y en una sola tarjeta gana la que da confianza. */}
            {negocio.verificado ? (
              <InsigniaVerificado sobreFoto />
            ) : (
              esNuevo && (
                <span className="rounded-lg bg-aventurea-orange px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white">
                  Recién publicado
                </span>
              )
            )}
            {demo && (
              <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-zinc-900">
                Demo
              </span>
            )}
          </span>

          <p className="max-w-[80%] text-2xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgba(6,38,83,0.6)] sm:text-3xl lg:text-4xl">
            {negocio.nombre}
          </p>

          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-white/90">
            {ubicacion && (
              <span className="flex items-center gap-1.5">
                <IconPin className="h-3.5 w-3.5" />
                {ubicacion}
              </span>
            )}
            <span className="text-white/70">{categoriaLabel(vertical, negocio.categoria)}</span>
            {/* El precio solo si el negocio lo publicó, y SIN la unidad:
                los negocios arrastran el `unidad_precio='evento'` que
                dejó por defecto la 0033 y que nadie tocó, así que
                "desde ₡1 500 por evento" en una cafetería sería falso.
                El monto sí es cierto; la unidad se queda en la ficha. */}
            {/* ⚠️ Acá iba «Desde ₡X». Se sacó a pedido del dueño (26 ago 2026) — ver `rancho-card.tsx`. */}
          </span>
        </div>
      </Link>
    </section>
  );
}

/**
 * Nivel C: no hay ni un negocio pintable. En vez de un hueco —o peor,
 * de un mensaje de error mirando al visitante— la vitrina se llena con
 * la marca. Ocupa exactamente el mismo alto que los otros dos niveles.
 */
function VitrinaSinDatos() {
  return (
    <section
      className={`relative mb-5 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl bg-aventurea-navy px-6 text-center shadow-[0_24px_60px_-28px_rgba(6,38,83,0.55)] ${ALTO_VITRINA}`}
    >
      <div aria-hidden className="bento-orbe -right-16 -top-20" />
      <div aria-hidden className="bento-orbe -bottom-24 -left-20" />

      {/* eslint-disable-next-line @next/next/no-img-element -- el logo
          oficial es un PNG estático; next/image no aporta nada acá
          (mismo criterio que site-header.tsx). */}
      <img
        src="/logo-bookea-blanco-v4.png"
        alt="Bookea"
        width={1251}
        height={391}
        className="relative h-9 w-auto sm:h-11"
      />
      <p className="titulo relative max-w-[22ch] text-[clamp(20px,3vw,30px)] text-white">
        Negocios de todo el país, listos para reservar
      </p>
    </section>
  );
}

/**
 * ============================================================
 * EL RIEL «LO NUEVO EN BOOKEA»
 * ============================================================
 *
 * Riel horizontal y no grilla de tres, a propósito: una grilla de 3
 * columnas con 3 negocios se lee como "esto es todo el catálogo",
 * mientras que un riel con 3 se lee como el principio de una lista.
 * Además `RielProveedores` ya trae las flechas que se apagan solas, el
 * scroll-snap y el ancho que en móvil muestra dos tarjetas y el asomo
 * de la tercera.
 *
 * UMBRAL DURO: con menos de tres negocios la sección NO se pinta.
 * Mejor ausente que vacía.
 *
 * Las tarjetas son `RanchoCard`, la misma pieza del directorio: ya
 * resuelve la foto con respaldo de gradiente, el badge de rubro, el
 * aviso «Nuevo», el aviso «Demo», el velo de «en configuración», el
 * corazón de favorito con su server action, el precio en colones — y
 * las estrellas SOLO si hay calificación, o sea que hoy no las pinta.
 */
export function RielLoNuevo({
  nuevos,
  verTodoHref,
  favoritosIds,
  sesionActiva,
  prioridad = true,
}: {
  nuevos: DatosHome["nuevos"];
  verTodoHref: string;
  favoritosIds: string[];
  sesionActiva: boolean;
  /** Si su primera foto se pide con prioridad alta. Ver RielProveedores. */
  prioridad?: boolean;
}) {
  if (nuevos.length < MINIMO_RIEL) return null;

  return (
    <section>
      <p className="px-1 text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-bookea-naranja-fuerte">
        Recién publicados
      </p>
      <RielProveedores
        titulo="Lo nuevo en Bookea"
        subtitulo="Los últimos negocios que se sumaron al directorio, de todo el país."
        items={nuevos}
        verTodoHref={verTodoHref}
        // Sin calificaciones y sin disponibilidad: los dos mapas van
        // vacíos a propósito.
        //
        // · Calificaciones: `resenas` tiene cero filas en producción.
        //   La card solo pinta estrellas si le llega una calificación,
        //   así que un mapa vacío es exactamente "todavía nadie
        //   reseñó" — no un número inventado.
        // · Disponibilidad: saber qué fecha tiene libre un Lugar cuesta
        //   una consulta a `disponibilidad_rancho`, y la portada no la
        //   hace. Con el mapa vacío `.get()` devuelve undefined y la
        //   card omite el chip, en vez de decir "Agotado" sin haber
        //   preguntado. El dato completo está a un clic, en /eventos.
        calificaciones={new Map<string, Calificacion>()}
        proximasLibres={new Map<string, string | null>()}
        favoritosIds={new Set(favoritosIds)}
        sesionActiva={sesionActiva}
        // SIN la unidad del precio. Este riel mezcla verticales —una
        // barbería al lado de un salón— y `unidad_precio` arrastra el
        // 'evento' por defecto de la 0033: «desde ₡1.500 por evento»
        // debajo de una cafetería es falso. Es la misma regla que la
        // vitrina de arriba ya aplicaba; faltaba acá, que es justo la
        // sección para la que se escribió.
        // Este riel ya NO es la primera lista de la portada: arriba
        // están los carriles por rubro de la pestaña activa. Marcar
        // también acá una foto como prioritaria sería sumar otra imagen
        // a la pelea con el héroe.
        prioridad={prioridad}
      />
    </section>
  );
}
