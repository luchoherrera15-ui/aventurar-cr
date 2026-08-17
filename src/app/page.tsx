import { Suspense, cache } from "react";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconCheck, IconChevronRight } from "@/components/icons";
import AvisoSuperior from "@/components/home/aviso-superior";
import NavHome from "@/components/home/nav-home";
import TarjetasVertical from "@/components/home/tarjetas-vertical";
import ComoFunciona from "@/components/home/como-funciona";
import BloqueNegocios from "@/components/home/bloque-negocios";
import BloqueSoluciones from "@/components/home/bloque-soluciones";
import BuscadorHome from "@/components/buscador-home";
import GrillaCategorias from "@/components/grilla-categorias";
import { DATOS_ORGANIZACION } from "@/lib/seo-organizacion";
import { urlSitio } from "@/lib/sitio";
import { paisDelVisitante } from "@/lib/pais-visitante";
import type { CodigoPais } from "@/lib/paises";
import { leerDatosHome } from "./home-datos";
import { RielLoNuevo, VitrinaHome } from "./home-secciones";
import {
  EsqueletoGrillaCategorias,
  EsqueletoRiel,
  EsqueletoVitrinaHome,
} from "./esqueleto";

/**
 * ============================================================
 * LA PORTADA DE BOOKEA — `bookea.lat`
 * ============================================================
 *
 * QUÉ ES ESTA PÁGINA
 *
 * La portada del marketplace: quién es Bookea, qué se puede reservar y
 * por dónde se empieza. Es la URL que la gente teclea y comparte, la
 * que Google usa para calificar la velocidad del sitio, y la única
 * pantalla donde se declara la organización en datos estructurados.
 *
 * QUÉ HABÍA ACÁ ANTES Y POR QUÉ CAMBIÓ
 *
 * Hasta este cambio, `/` MONTABA EL DIRECTORIO DE EVENTOS. Este
 * archivo hacía dos líneas: una bienvenida animada y `<EventosPage />`.
 * O sea: la dirección más fuerte del sitio no tenía contenido propio
 * —era una copia de `/eventos` en otra URL— y quien buscaba «Bookea»
 * no encontraba una página que dijera qué es Bookea.
 *
 * Ahora hay DOS contenidos en vez de uno con dos direcciones:
 *
 *   ·  `/`         → esta portada. Canónica de sí misma.
 *   ·  `/eventos`  → EL DIRECTORIO de proveedores para eventos, que
 *                    sigue existiendo tal cual, con su propio canónico
 *                    y ~10 enlaces vivos apuntándole desde el código.
 *                    Si estás buscando la grilla de negocios, está
 *                    allá: src/app/eventos/page.tsx.
 *
 * El cambio se hizo en dos entregas a propósito: primero se mudó el
 * canónico del directorio a `/eventos` con el contenido todavía
 * idéntico en las dos direcciones (así el buscador consolida el
 * directorio antes de que la portada cambie de tema), y recién después
 * llegó este cuerpo. El rewrite dormido de `/` → `/eventos` que había
 * en `next.config.ts` se borró en esa primera entrega: era la
 * reversión silenciosa de esta decisión (ver el comentario largo que
 * quedó en su lugar).
 *
 * LA BIENVENIDA ANIMADA SE FUE, Y NO ES UN DESCUIDO
 *
 * Los cuatro archivos del velo blanco con el logo (`portada-intro.tsx`,
 * `intro.css`, `intro-visita.ts` y su prueba) están BORRADOS, no
 * comentados. Dos razones: tapaba justo el hero, que es lo que Google
 * mide para calificar la velocidad, y casi nadie la habría visto
 * —quedaba marcada como «vista» en todo dispositivo que hubiera
 * entrado alguna vez al sitio, así que la primera impresión terminaba
 * siendo distinta según el aparato—. Esta portada ES la bienvenida de
 * marca; el velo pasó a ser un obstáculo delante de ella.
 *
 * DE DÓNDE SALE CADA PEDAZO
 *
 *   · Las secciones sin datos      → src/components/home/*
 *   · El buscador                  → src/components/buscador-home.tsx
 *   · Las grillas de categoría     → src/components/grilla-categorias.tsx
 *   · Las secciones con negocios   → src/app/home-secciones.tsx
 *   · La única consulta a la base  → src/app/home-datos.ts
 *
 * Este archivo NO tiene lógica propia: ordena, pone los anchos y marca
 * dónde va el `<Suspense>`. Si hay que cambiar cómo se ve una sección,
 * el archivo es el suyo, no este.
 *
 * LO QUE ESTA PORTADA NO DICE, A PROPÓSITO
 *
 * Ni estrellas, ni «negocios verificados», ni «+2k personas
 * reservando». En la base hay CERO reseñas, cero favoritos guardados y
 * 125 reservas en toda la historia de la plataforma: las tres frases de
 * la maqueta de referencia serían inventadas. Y el buscador no tiene
 * campo de fecha porque no existe una consulta de disponibilidad que
 * abarque el directorio entero — un control que no filtra nada es un
 * control que miente.
 *
 * EL PAÍS DEL BUSCADOR SE DETECTA, NO SE ADIVINA
 *
 * El `<select>` de país del buscador ya no abre siempre en Costa Rica:
 * abre en el país del visitante, sacado de la cabecera de Vercel
 * `x-vercel-ip-country` (o del que la persona haya elegido a mano en
 * una visita anterior). Las reglas viven en @/lib/pais-preferido y la
 * lectura del request en @/lib/pais-visitante — ahí está explicado por
 * qué esto NO le cuesta caché a la página más visitada del sitio.
 *
 * Se resuelve ACÁ ARRIBA y no dentro de un `<Suspense>`: leer una
 * cabecera no cuesta ni I/O ni red, y el buscador es lo primero que se
 * ve del hero. Meterlo detrás de un límite de espera sería regalar un
 * salto de maqueta justo en lo que Google mide.
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
  // esta metadata cubre `/` y nada más. Mientras `/` montaba el
  // componente del directorio, la metadata de aquel archivo solo
  // cubría `/eventos` y la raíz quedaba sin etiqueta.
  alternates: { canonical: urlSitio("/") },
};

/**
 * LOS DATOS DE LA PORTADA, UNA SOLA VEZ POR VISITA.
 *
 * `leerDatosHome()` hace toda la tanda de consultas de una (ver
 * home-datos.ts), pero acá se consume desde DOS lugares distintos: la
 * vitrina, que va arriba dentro del hero, y las grillas + el riel, que
 * van bastante más abajo con secciones estáticas en medio. Como cada
 * uno vive detrás de su propio `<Suspense>`, no puede ser un solo
 * componente que envuelva a los dos sin arrastrar todo lo de en medio
 * a la misma espera.
 *
 * `cache()` de React resuelve exactamente eso: deduplica por render,
 * así que el segundo que pregunta recibe la MISMA promesa que arrancó
 * el primero. Una sola ida a Supabase, dos límites de espera. Es el
 * mismo patrón que ya usan @/lib/auth y @/lib/negocio-propio.
 */
const datosDeLaPortada = cache(leerDatosHome);

export default async function Home() {
  // No es una consulta: la cookie y la cabecera ya vienen en el
  // request, así que este `await` resuelve en el mismo tick. La página
  // ya era dinámica antes de esto (ver @/lib/pais-visitante).
  const pais = await paisDelVisitante();

  return (
    // `overflow-x-clip`: el fondo `organico` del hero pinta manchas
    // difuminadas que se salen de su caja, y en un teléfono eso mueve
    // el sitio ENTERO hacia los lados (ya pasó, ver eventos/page.tsx).
    // `clip` y no `hidden`: `hidden` crearía un contexto de scroll y
    // rompería el `position: sticky` del header.
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
      {/* Quién es Bookea, en el idioma que leen los buscadores. Se
          declara UNA vez en todo el sitio y es acá: la recomendación de
          Google es la portada, no cada pantalla. Vivía en
          eventos/page.tsx solo mientras `/` montaba ese componente.
          JSON serializado por nosotros, sin nada que venga de la base:
          no hay entrada de usuario que escapar. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ORGANIZACION) }}
      />

      {/* Arriba del header, nunca adentro: el header tiene una altura
          fija de 64px de la que se cuelgan media docena de barras
          `top-16` del sitio. */}
      <AvisoSuperior />

      {/* `conPublicar={false}` a propósito: `NavHome` ya trae «Para
          negocios», y las dos puertas juntas en la misma barra se leen
          como un error. El atajo sigue en el aviso de arriba (visible
          en TODOS los anchos, incluido el teléfono, donde el link del
          header estaba escondido igual) y en el menú de cuenta. De
          paso, `conPublicar={false}` se salta la consulta
          `tieneNegocioPropio()` — una ida menos a la base en la URL más
          visitada del sitio. */}
      <SiteHeader ancho="max-w-[1200px]" extra={<NavHome />} conPublicar={false} />

      <Hero pais={pais} />
      <TarjetasVertical />
      <SeccionExplorar />
      <ComoFunciona />
      <BloqueNegocios />
      <BloqueSoluciones />

      {/* El pie va en CLARO aunque la sección de arriba también lo sea:
          es decisión propia de SiteFooter («dos navys pegados se leen
          como uno solo») y no se toca desde acá. */}
      <SiteFooter />

      {/* Una sola vez en toda la página: es un observer global que
          busca `[data-reveal]` en el documento entero, así que montarlo
          por sección sería multiplicar el mismo trabajo. Va al final
          porque no pinta nada — es solo el efecto. */}
      <RevealOnScroll />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EL HERO
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Los tres hechos de la fila de confianza.
 *
 * ⚠️ La maqueta prometía «Negocios verificados». El proceso de
 * verificación EXISTE (tabla `verificacion_proveedores`, migración
 * 0046) pero es privado por diseño: no hay ninguna columna pública que
 * diga si un negocio pasó por él, así que ese sello sería una promesa
 * que el sitio no puede sostener. Estos tres, en cambio, se pueden
 * señalar con el dedo: la reserva instantánea es literalmente el
 * modelo del producto, `precio_desde` está a la vista en cada ficha, y
 * `provincia` tiene un CHECK contra las 7 provincias del país.
 */
const HECHOS: string[] = [
  "Reserva instantánea",
  "Precios en colones, a la vista",
  "Negocios de todo el país",
];

/**
 * El fondo del hero: `organico` (globals.css), las manchas
 * difuminadas que derivan despacio y el grano de película.
 *
 * Los tres colores van por variable porque la utilidad los pide así
 * (`--c1/--c2/--c3`), y salen de los tokens de la marca — nunca un hex
 * suelto, o el día que cambie el naranja este fondo se quedaría con el
 * viejo. `color-mix` baja la opacidad sin inventar un color nuevo.
 *
 * POR QUÉ NO HAY ADEMÁS DOS ORBES SUELTOS como en la maqueta: eso es
 * exactamente lo que `organico` ya pinta —tres manchas radiales
 * difuminadas— y son la pieza oficial del sistema, con su animación
 * apagada bajo `prefers-reduced-motion` y su `overflow: hidden` para
 * que nada se escape del hero. Dos divs más encima serían la misma
 * decoración pintada dos veces.
 */
const COLORES_HERO = {
  "--c1": "color-mix(in srgb, var(--color-aventurea-orange) 24%, transparent)",
  "--c2": "color-mix(in srgb, var(--color-aventurea-sky) 45%, transparent)",
  "--c3": "color-mix(in srgb, var(--color-aventurea-navy-3) 75%, transparent)",
} as CSSProperties;

function Hero({ pais }: { pais: CodigoPais }) {
  return (
    <section className="organico bg-aventurea-navy" style={COLORES_HERO}>
      <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:px-10">
        <div className="mx-auto max-w-[860px] text-center">
          <p className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/85 ring-1 ring-white/15">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-aventurea-orange" />
            Reservas fáciles en Costa Rica
          </p>

          {/* El único `<h1>` de la página, y visible: el del directorio
              es `sr-only` porque allá el contenido son las cards. Acá
              el titular ES la página. El acento va en naranja: es
              texto grande (38px para arriba), donde el contraste del
              naranja sobre navy alcanza de sobra. */}
          <h1 className="titulo mt-5 text-balance text-[clamp(38px,7vw,76px)] text-white">
            Encontrá. Elegí. <span className="text-aventurea-orange">Reservá.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-[52ch] text-[15px] leading-relaxed text-white/75 sm:text-[16.5px]">
            Desde tu próxima cita hasta cada detalle de tu evento. Todo en un
            solo lugar, sin llamadas ni complicaciones.
          </p>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-[12.5px] font-semibold text-white/80">
            {HECHOS.map((hecho) => (
              <li key={hecho} className="flex items-center gap-2">
                <IconCheck className="h-3.5 w-3.5 shrink-0 text-aventurea-orange" />
                {hecho}
              </li>
            ))}
          </ul>
        </div>

        {/* El buscador no trae márgenes propios ni el solapamiento
            negativo de la maqueta: dónde se para es decisión de esta
            composición, no del componente.

            `paisInicial` es el país detectado (o el que la persona
            eligió antes). Baja como prop y no lo lee el buscador solo
            porque el buscador es `"use client"`: no puede tocar
            `headers()`, y meterle un `useSearchParams()` obligaría a
            renderizar la portada entera del lado del cliente. */}
        <BuscadorHome className="mx-auto mt-9 max-w-[900px]" paisInicial={pais} />

        {/* LA VITRINA. Es lo único del hero que depende de la base, así
            que va sola detrás de su propio `<Suspense>`: el resto del
            hero —titular, buscador, fila de confianza— sale por el
            cable de inmediato, sin esperar a Supabase. El esqueleto
            mide EXACTAMENTE lo mismo que los tres niveles de la
            vitrina, así que nada salta cuando llegan los datos. */}
        <div className="mt-10">
          <Suspense fallback={<EsqueletoVitrinaHome />}>
            <VitrinaDelHero />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

/** La vitrina con su degradado de tres niveles (ver home-secciones.tsx). */
async function VitrinaDelHero() {
  const { destacados, respaldoVitrina } = await datosDeLaPortada();
  return <VitrinaHome destacados={destacados} respaldo={respaldoVitrina} />;
}

/* ═══════════════════════════════════════════════════════════════════
   EXPLORAR: LAS DOS GRILLAS DE CATEGORÍA Y EL RIEL DE LO NUEVO
   ═══════════════════════════════════════════════════════════════════ */

/**
 * El bloque de en medio de la portada. Las tres piezas que lo forman
 * dependen de la misma consulta —los conteos por categoría y los
 * negocios recién publicados— así que comparten un solo `<Suspense>`:
 * dos límites acá abajo harían que la página se arme en dos saltos
 * visibles, y no hay nada que ganar con eso.
 */
function SeccionExplorar() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-16">
        <Suspense
          fallback={
            <>
              <EsqueletoGrillaCategorias />
              <EsqueletoGrillaCategorias />
              <EsqueletoRiel />
            </>
          }
        >
          <CategoriasYNuevos />
        </Suspense>
      </div>
    </section>
  );
}

async function CategoriasYNuevos() {
  const { conteos, nuevos, verTodoNuevos, favoritosIds, sesionActiva } =
    await datosDeLaPortada();

  return (
    <>
      <GrillaCategorias
        vertical="citas"
        kicker="Citas y servicios"
        titulo="Cuidarte nunca fue tan fácil"
        descripcion="Descubrí profesionales cerca de vos, compará opciones y reservá en minutos."
        conteos={conteos.citas}
        verTodoHref="/citas"
      />

      <GrillaCategorias
        vertical="eventos"
        kicker="Todo para tu evento"
        titulo="Armá tu evento, proveedor por proveedor"
        descripcion="Encontrá espacios, talento y servicios para convertir tu idea en una celebración real."
        conteos={conteos.eventos}
        verTodoHref="/eventos"
      />

      {/* Los restaurantes son el 25% de los negocios publicados y las
          dos grillas de arriba los dejan afuera. No merecen una
          tercera grilla hoy —son dos negocios— pero sí una puerta:
          sin esto, `/restaurantes` no está enlazado desde la portada. */}
      <p className="text-center text-[13.5px] text-aventurea-ink-soft">
        ¿Buscás dónde comer?{" "}
        <Link
          href="/restaurantes"
          className="inline-flex items-center gap-1 font-bold text-aventurea-navy underline underline-offset-4 hover:text-aventurea-orange"
        >
          Ver restaurantes
          <IconChevronRight className="h-3.5 w-3.5" />
        </Link>
      </p>

      {/* Si hay menos de tres negocios pintables, esto no devuelve
          nada: un riel con una tarjeta grita que el directorio está
          vacío. El hueco lo cierra solo el `gap` del contenedor. */}
      <RielLoNuevo
        nuevos={nuevos}
        verTodoHref={verTodoNuevos}
        favoritosIds={favoritosIds}
        sesionActiva={sesionActiva}
      />
    </>
  );
}
