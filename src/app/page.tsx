import { Suspense, cache } from "react";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import RevealOnScroll from "@/components/reveal-on-scroll";
import { IconCheck, IconChevronRight, IconPin } from "@/components/icons";
import AvisoSuperior from "@/components/home/aviso-superior";
import NavHome from "@/components/home/nav-home";
import TarjetasVertical from "@/components/home/tarjetas-vertical";
import ComoFunciona from "@/components/home/como-funciona";
import BloqueNegocios from "@/components/home/bloque-negocios";
import BloqueSoluciones from "@/components/home/bloque-soluciones";
import BuscadorHome from "@/components/buscador-home";
import NegociosDestacados from "@/components/negocios-destacados";
import { estiloRevelado } from "@/components/revelar";
import { DATOS_ORGANIZACION } from "@/lib/seo-organizacion";
import { urlSitio } from "@/lib/sitio";
import { paisDelVisitante } from "@/lib/pais-visitante";
import type { CodigoPais } from "@/lib/paises";
import { leerDatosHome } from "./home-datos";
import { Bloque, EsqueletoDestacados } from "./esqueleto";

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
 * ── LA COMPOSICIÓN NUEVA (referencia/bookeahome.html) ────────────
 *
 * El orden y el ritmo salen de la maqueta que entregó el dueño. Su
 * decisión de diseño más fuerte no es un color ni un radio: es que
 * EL BUSCADOR Y LOS NEGOCIOS ENTREN EN LA PRIMERA PANTALLA. Por eso el
 * héroe se comprime (`min-height:350px` allá, dos columnas acá), por
 * eso el buscador se solapa con el héroe en vez de colgar debajo, y por
 * eso la tira «Negocios destacados» es una tarjeta horizontal de 132 px
 * y no la tarjeta vertical de 330 px del directorio.
 *
 *   1. Héroe compacto, a dos columnas       → `section.hero`
 *   2. Buscador, solapado sobre el héroe    → `section.search-wrap`
 *   3. NEGOCIOS DESTACADOS                  → `section.business-peek`
 *   4. ¿Qué querés hacer hoy? (categorías)  → `section.compact`
 *   5. Lo nuevo en Bookea (riel)            → `section.soft`
 *   6. Dos formas de empezar                → `.path-grid`
 *   7. Cómo funciona                        → (propio del sitio)
 *   8. Todo el recorrido dentro de Bookea   → `.ecosystem`
 *   9. Descubrí algo cerca de vos           → `#provincias`
 *  10. Tu negocio merece más reservas       → `section.cream`
 *
 * ── LO QUE LA MAQUETA PIDE Y ESTA PORTADA NO DA ──────────────────
 *
 * Ni estrellas, ni «4,2 km», ni «Hoy 3:30 p.m.», ni «Más reservado»,
 * ni «Cancelación flexible», ni los filtros «Disponible hoy» y «Mejor
 * valorados». En producción `resenas` tiene CERO filas, no hay
 * ubicación del visitante en kilómetros y no existe una consulta de
 * disponibilidad que abarque el directorio entero. Un control que no
 * filtra es un control que miente, y una estrella inventada en la
 * primera pantalla es la mentira más cara del sitio. Cada omisión está
 * anotada donde corresponde: negocios-destacados.tsx, home-secciones.tsx
 * y grilla-categorias.tsx.
 *
 * El mosaico de fotos de provincias tampoco se construyó: pedía cinco
 * imágenes de banco (host externo en la ruta más visitada) y prometía
 * cobertura sin verificarla. En su lugar hay chips con el CONTEO REAL
 * por provincia, contados en memoria sobre la misma consulta.
 *
 * ── EL CARRUSEL DE SÚPER DESTACADOS SALIÓ DE ACÁ ─────────────────
 *
 * `VitrinaHome` (home-secciones.tsx) ya no se monta en la portada, y el
 * archivo NO se borró — solo dejó de usarse desde este orden. Dos
 * razones, las dos de la maqueta: su diapositiva mide 420 px justo
 * arriba del pliegue (la entrada móvil está en LCP 3640 ms, contra un
 * objetivo de 2500) y mostraba EXACTAMENTE los mismos súper destacados
 * que ahora alimentan la tira de la sección 3 — el mismo negocio en un
 * carrusel y en una grilla, uno encima del otro, es la misma
 * información dos veces. ⚠️ Es una decisión de producto: los súper
 * destacados son la vitrina que el admin curó a mano desde
 * /admin/ranchos. Siguen visibles, y con su nombre; lo que se fue es el
 * formato carrusel.
 *
 * DE DÓNDE SALE CADA PEDAZO
 *
 *   · Las secciones sin datos      → src/components/home/*
 *   · El buscador                  → src/components/buscador-home.tsx
 *   · Las grillas de categoría     → src/components/grilla-categorias.tsx
 *   · La tira de destacados        → src/components/negocios-destacados.tsx
 *   · El riel de lo nuevo          → src/app/home-secciones.tsx
 *   · La única consulta a la base  → src/app/home-datos.ts
 *
 * Este archivo NO tiene lógica propia: ordena, pone los anchos y marca
 * dónde va el `<Suspense>`. Si hay que cambiar cómo se ve una sección,
 * el archivo es el suyo, no este.
 *
 * EL PAÍS DEL BUSCADOR SE DETECTA, NO SE ADIVINA
 *
 * El `<select>` de país del buscador abre en el país del visitante,
 * sacado de la cabecera de Vercel `x-vercel-ip-country` (o del que la
 * persona haya elegido a mano antes). Las reglas viven en
 * @/lib/pais-preferido y la lectura del request en @/lib/pais-visitante.
 * Se resuelve ACÁ ARRIBA y no dentro de un `<Suspense>`: leer una
 * cabecera no cuesta ni I/O ni red, y el buscador es lo primero que se
 * ve.
 *
 * LA BIENVENIDA ANIMADA SE FUE, Y NO ES UN DESCUIDO
 *
 * Los cuatro archivos del velo blanco con el logo (`portada-intro.tsx`,
 * `intro.css`, `intro-visita.ts` y su prueba) están BORRADOS, no
 * comentados: tapaban justo el héroe, que es lo que Google mide. Ya
 * revivieron una vez por accidente. No vuelven.
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

/**
 * LOS DATOS DE LA PORTADA, UNA SOLA VEZ POR VISITA.
 *
 * `leerDatosHome()` hace toda la tanda de consultas de una (ver
 * home-datos.ts), pero acá se consume desde TRES lugares distintos: la
 * tira de destacados, que va arriba de todo; las grillas + el riel, que
 * van en el medio; y los chips de provincia, que van al final. Como
 * cada uno vive detrás de su propio `<Suspense>`, no puede ser un solo
 * componente que envuelva a los tres sin arrastrar todo lo de en medio
 * a la misma espera.
 *
 * `cache()` de React resuelve exactamente eso: deduplica por render,
 * así que el segundo y el tercero que preguntan reciben la MISMA
 * promesa que arrancó el primero. Una sola ida a Supabase, tres límites
 * de espera. Es el mismo patrón que ya usan @/lib/auth y
 * @/lib/negocio-propio.
 */
const datosDeLaPortada = cache(leerDatosHome);

export default async function Home() {
  // No es una consulta: la cookie y la cabecera ya vienen en el
  // request, así que este `await` resuelve en el mismo tick. La página
  // ya era dinámica antes de esto (ver @/lib/pais-visitante).
  const pais = await paisDelVisitante();

  return (
    // `overflow-x-clip`: el fondo `organico` del héroe pinta manchas
    // difuminadas que se salen de su caja, y en un teléfono eso mueve
    // el sitio ENTERO hacia los lados (ya pasó, ver eventos/page.tsx).
    // `clip` y no `hidden`: `hidden` crearía un contexto de scroll y
    // rompería el `position: sticky` del header.
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
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

      {/* `conPublicar={false}` a propósito: `NavHome` ya trae «Para
          negocios», y las dos puertas juntas en la misma barra se leen
          como un error. De paso se salta la consulta
          `tieneNegocioPropio()` — una ida menos a la base en la URL más
          visitada del sitio. */}
      <SiteHeader
        ancho="max-w-[1200px]"
        extra={<NavHome />}
        extraCentrado
        conPublicar={false}
      />

      <Hero />
      <Buscador pais={pais} />
      <Destacados />
      {/* Acá iban «¿Qué querés hacer hoy?» (las dos grillas de categoría)
          y el riel «Lo nuevo en Bookea». Los sacó el dueño: estorbaban.
          Y tenía razón en lo estructural — las dos repetían lo que ya
          hacen sus vecinas. «Negocios destacados» arriba ya muestra
          negocios de verdad con su rubro encima, y `TarjetasVertical`
          justo abajo ya bifurca entre Citas y Eventos, que era el trabajo
          de las grillas. Tres bloques de navegación seguidos antes de
          llegar a nada concreto es lo que hacía larga la portada.
          El único enlace a /restaurantes vivía adentro de la grilla y se
          rescató: ahora va debajo de las tarjetas de vertical, que es
          donde se elige a dónde ir. */}
      <TarjetasVertical />
      <PuertaRestaurantes />
      <ComoFunciona />
      <BloqueSoluciones />
      <SeccionProvincias />
      <BloqueNegocios />

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
   1 · EL HÉROE  (`section.hero` de la maqueta)
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
 * El fondo del héroe: `organico` (globals.css), las manchas
 * difuminadas que derivan despacio y el grano de película.
 *
 * Los tres colores van por variable porque la utilidad los pide así
 * (`--c1/--c2/--c3`), y salen de los tokens de la marca — nunca un hex
 * suelto, o el día que cambie el naranja este fondo se quedaría con el
 * viejo. `color-mix` baja la opacidad sin inventar un color nuevo.
 *
 * POR QUÉ NO HAY ADEMÁS DOS ORBES SUELTOS como en la maqueta: eso es
 * exactamente lo que `organico` ya pinta —tres manchas radiales
 * difuminadas, en las mismas posiciones que sus dos `radial-gradient`—
 * y son la pieza oficial del sistema, con su animación apagada bajo
 * `prefers-reduced-motion` y su `overflow: hidden` para que nada se
 * escape del héroe.
 */
const COLORES_HERO = {
  "--c1": "color-mix(in srgb, var(--color-aventurea-orange) 24%, transparent)",
  "--c2": "color-mix(in srgb, var(--color-aventurea-sky) 45%, transparent)",
  "--c3": "color-mix(in srgb, var(--color-aventurea-navy-3) 75%, transparent)",
} as CSSProperties;

/**
 * El collage de la maqueta: dos fotos rotadas con marco blanco.
 *
 * ⚠️ LAS FOTOS SON PROPIAS, no de Unsplash. `public/fondos/*.jpg` ya
 * estaban pagadas y en el repo, y ya las usa `TarjetasVertical` más
 * abajo (o sea que el navegador las va a reusar). Traer un banco de
 * imágenes teniendo estas sería pagar dos veces y, encima, meter un
 * host externo en la ruta más visitada del sitio.
 *
 * ⚠️ SIN LAS DOS TARJETITAS FLOTANTES de la maqueta («Masaje relajante
 * · Disponible hoy · 4.9 ★»): un negocio inventado, una disponibilidad
 * que no se consulta y una estrella que no existe, los tres pecados en
 * el mismo recuadro de 12 px.
 */
const COLLAGE: { src: string; clase: string }[] = [
  {
    src: "/fondos/portada-citas.jpg",
    clase: "left-[2%] top-0 h-[82%] w-[63%] -rotate-[4deg]",
  },
  {
    src: "/fondos/portada-eventos.jpg",
    clase: "bottom-0 right-0 h-[70%] w-[54%] rotate-[5deg]",
  },
];

function Hero() {
  return (
    <section className="organico bg-aventurea-navy" style={COLORES_HERO}>
      {/* El `pb` grande es el espacio donde entra la mitad de arriba del
          buscador, que se solapa desde afuera de esta sección. */}
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pb-24 sm:pt-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-12 lg:px-10">
        <div className="min-w-0">
          {/* El «eyebrow» de la maqueta: la rayita y el texto en
              mayúsculas. La rayita es decorativa. */}
          <p className="flex items-center gap-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-orange-light">
            <span aria-hidden className="h-px w-6 bg-current" />
            Reservá local. Viví más.
          </p>

          {/* El único `<h1>` de la página, y visible: el del directorio
              es `sr-only` porque allá el contenido son las cards. Acá
              el titular ES la página. El acento va en naranja: es
              texto grande (34px para arriba), donde el contraste del
              naranja sobre navy alcanza de sobra. La escala baja
              respecto de la portada anterior (era clamp 38-76) porque
              la maqueta comprime el héroe a propósito. */}
          <h1 className="titulo mt-3.5 text-balance text-[clamp(34px,5vw,60px)] leading-[1.02] text-white">
            Encontrá. Elegí. <span className="text-aventurea-orange">Reservá.</span>
          </h1>

          <p className="mt-4 max-w-[54ch] text-[14.5px] leading-relaxed text-white/75 sm:text-[16px]">
            Citas, espacios, proveedores y experiencias de Costa Rica en un solo
            lugar. Fácil de comparar, fácil de reservar.
          </p>

          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[12px] font-semibold text-white/80">
            {HECHOS.map((hecho) => (
              <li key={hecho} className="flex items-center gap-2">
                {/* El ícono en burbuja de la maqueta (`.proof i`). */}
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                  <IconCheck className="h-3 w-3 shrink-0 text-aventurea-orange" />
                </span>
                {hecho}
              </li>
            ))}
          </ul>
        </div>

        {/* Decorativo y SOLO de `lg` para arriba, igual que en la
            maqueta (`.hero-gallery{display:none}` en móvil): en un
            teléfono estas fotos no aportan nada y solo empujarían el
            buscador y los negocios fuera de la primera pantalla, que es
            justo lo que esta composición viene a evitar.

            El `sizes` con el `1px` de respaldo no es un truco sucio: es
            la forma de que el navegador que igual resuelve el `srcset`
            en móvil se baje el candidato más chico en vez de uno de 640
            para una caja que no se ve. */}
        <div aria-hidden className="relative hidden h-[300px] lg:block">
          {COLLAGE.map((foto) => (
            <div
              key={foto.src}
              className={`absolute overflow-hidden rounded-[22px] border-4 border-white/10 shadow-[0_28px_50px_rgba(0,0,0,0.32)] ${foto.clase}`}
            >
              <Image
                src={foto.src}
                alt=""
                fill
                // Calidad 60: es la del sitio para fotos decorativas
                // (ver next.config.ts).
                quality={60}
                sizes="(min-width: 1024px) 340px, 1px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   2 · EL BUSCADOR  (`section.search-wrap`)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * El buscador, SOLAPADO sobre el héroe — lo único que se adopta tal
 * cual de la maqueta en esta zona (`margin-top:-46px`).
 *
 * ⚠️ VA FUERA DEL `<section class="organico">`, no adentro. `organico`
 * trae `isolation: isolate` y `overflow: hidden`: un elemento que
 * sobresale del héroe desde adentro quedaría recortado, y su apilado
 * no podría subir por encima de nada de afuera. Es el mismo choque que
 * ya obligó al portal de la hoja móvil del buscador.
 *
 * El solapamiento arranca en `sm`. En teléfono el buscador no muestra
 * los campos (abre una hoja a pantalla completa) y solaparlo dejaría el
 * disparador pisando el borde del héroe sin ganar nada.
 *
 * EL COMPONENTE NO SE TOCA. La maqueta propone otro buscador —cinco
 * columnas con «¿Cuándo?» y «¿Para quién?», cada campo abriendo un
 * modal— y ese buscador no se puede construir con verdad: no hay
 * consulta de disponibilidad transversal ni columna de capacidad
 * consultable en Citas, así que dos de sus cinco campos no filtrarían
 * nada. El que ya existe, además, BUSCA SIN JAVASCRIPT (`<form
 * method="get">`, pestañas que son `<a href>`, chips que son `<Link>` a
 * URLs rastreables) y trae resuelta la accesibilidad completa —
 * `role="tablist"` con flechas, `inert` en la vertical inactiva, trampa
 * de foco en la hoja móvil—. Nada de eso está en la maqueta.
 */
function Buscador({ pais }: { pais: CodigoPais }) {
  return (
    <div className="relative z-20 px-4 sm:px-6 lg:px-10">
      {/* −50 px es EXACTAMENTE el alto de la fila de pestañas más su
          margen: con eso las pestañas quedan sobre el navy del héroe y
          el panel blanco de los campos empieza justo en el borde. Es la
          silueta de la maqueta, donde el mismo recorte lo hace el
          `padding` interno del `.search-panel`. */}
      <div className="mx-auto mt-5 max-w-[1200px] sm:-mt-[50px]">
        {/* `paisInicial` es el país detectado (o el que la persona
            eligió antes). Baja como prop y no lo lee el buscador solo
            porque el buscador es `"use client"`: no puede tocar
            `headers()`, y meterle un `useSearchParams()` obligaría a
            renderizar la portada entera del lado del cliente.

            `tono="oscuro"` sigue siendo el correcto: con el solapamiento,
            la fila de pestañas es justo la parte que queda sobre el navy
            del héroe, y el panel blanco de los campos cae ya sobre el
            crema. Es la silueta de la maqueta. */}
        <BuscadorHome className="mx-auto max-w-[980px]" paisInicial={pais} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   3 · NEGOCIOS DESTACADOS  (`section.business-peek`)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * La sección que el dueño señaló con el dedo: los negocios ACTIVOS,
 * visibles apenas debajo del buscador.
 *
 * Va detrás de su propio `<Suspense>` con un esqueleto que mide
 * EXACTAMENTE lo mismo (132 px por tarjeta, mismas columnas por ancho):
 * es lo primero que se ve debajo del pliegue y el CLS del sitio hoy es
 * 0,000.
 */
function Destacados() {
  return (
    <Suspense fallback={<EnvoltorioDestacados />}>
      <DestacadosConDatos />
    </Suspense>
  );
}

/** El esqueleto con el mismo margen exterior que la sección real. */
function EnvoltorioDestacados() {
  return (
    <div className="px-4 pb-10 pt-7 sm:px-6 sm:pb-12 sm:pt-9 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <EsqueletoDestacados />
      </div>
    </div>
  );
}

async function DestacadosConDatos() {
  const { vitrinaPeek, peekCurado, verTodoPeek } = await datosDeLaPortada();
  return (
    <NegociosDestacados
      negocios={vitrinaPeek}
      curado={peekCurado}
      verTodoHref={verTodoPeek}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════
   4 · LA PUERTA A RESTAURANTES
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Una línea, y existe por una razón concreta: sin esto `/restaurantes`
 * NO está enlazado desde la portada.
 *
 * Vivía dentro de la grilla de categorías, y cuando esa grilla se quitó
 * se habría ido con ella sin que nadie lo notara — los restaurantes son
 * la vertical con más negocios publicados y habrían quedado sin puerta
 * de entrada. Va debajo de las tarjetas de vertical porque ahí es donde
 * la persona está eligiendo a dónde ir; suelta en cualquier otro lado
 * sería una línea huérfana.
 *
 * Es texto y no una tercera tarjeta a propósito: darle el mismo peso
 * visual que a Citas y Eventos diría que son tres caminos iguales, y no
 * lo son — el marketplace se vende por esos dos.
 */
function PuertaRestaurantes() {
  return (
    <section className="px-4 pb-4 sm:px-6 lg:px-10">
      <p className="mx-auto max-w-[1200px] text-center text-[13.5px] text-aventurea-ink-soft">
        ¿Buscás dónde comer?{" "}
        <Link
          href="/restaurantes"
          className="inline-flex items-center gap-1 font-bold text-aventurea-navy underline underline-offset-4 hover:text-bookea-naranja-fuerte"
        >
          Ver restaurantes
          <IconChevronRight className="h-3.5 w-3.5" />
        </Link>
      </p>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   9 · DESCUBRÍ ALGO CERCA DE VOS  (`section#provincias`)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Los chips de provincia — el sustituto HONESTO del mosaico de fotos.
 *
 * ⚠️ QUÉ PEDÍA LA MAQUETA Y POR QUÉ NO SE HIZO. Un bento de cinco
 * provincias (Alajuela grande, San José, Guanacaste, Heredia, Limón)
 * con foto a sangre y un descriptor: «Volcanes, bienestar y planes
 * locales». Eso necesita cinco fotos que no existen en el repo —serían
 * de banco de imágenes, o sea un host externo en la ruta más visitada
 * del sitio— y, peor, promete cobertura en cinco provincias sin
 * haberla verificado negocio por negocio.
 *
 * Estos chips cuentan la columna `provincia` sobre la misma lista que
 * ya trajo `leerDatosHome()`: cero consultas nuevas, cero fotos, y el
 * número que se ve es exactamente el que la persona va a encontrar del
 * otro lado del clic. Solo aparecen las provincias que TIENEN algo.
 *
 * ⚠️ Y NO DICE «CERCA DE VOS» EN SERIO: no hay ubicación del visitante.
 * La cabecera de Vercel da el país, y en Costa Rica el ruteo por Miami
 * hace basura de la ciudad — una sección que le dice «cerca de
 * Alajuela» a alguien de Limón es peor que no tenerla. Por eso el
 * título habla de explorar por provincia y no de cercanía.
 */
function SeccionProvincias() {
  return (
    <section id="provincias" className="px-4 py-14 sm:px-6 sm:py-16 lg:px-10">
      <div className="mx-auto max-w-[1200px]">
        <Suspense fallback={<EsqueletoProvincias />}>
          <Provincias />
        </Suspense>
      </div>
    </section>
  );
}

function EsqueletoProvincias() {
  return (
    <div>
      <Bloque className="h-3 w-32" />
      <Bloque className="mt-3 h-8 w-[min(360px,75%)]" />
      <div className="mt-6 flex flex-wrap gap-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Bloque key={i} className="h-11 w-[150px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

async function Provincias() {
  const { porProvincia } = await datosDeLaPortada();

  // Menos de tres chips no es un mapa del país: es una lista de dos
  // lugares con un título grande encima. La sección entera se omite
  // antes que quedar como un encabezado huérfano.
  if (porProvincia.length < 3) return null;

  return (
    <>
      <div className="max-w-[62ch]">
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-bookea-naranja-fuerte">
          Hecho para Costa Rica
        </p>
        <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,40px)] text-aventurea-navy">
          Explorá por provincia
        </h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-aventurea-ink-soft">
          Citas, eventos y lugares publicados en cada zona del país. El número es
          el que vas a encontrar del otro lado.
        </p>
      </div>

      <ul className="mt-6 flex flex-wrap gap-2.5">
        {porProvincia.map((p, i) => (
          <li key={p.provincia} data-reveal style={estiloRevelado(i, 50)}>
            <Link
              href={p.href}
              className="elevar presionable group flex items-center gap-2.5 rounded-xl border border-aventurea-line bg-white py-2.5 pl-3 pr-4 text-[13.5px] font-bold text-aventurea-ink shadow-[0_5px_18px_-10px_rgba(22,41,94,0.25)] hover:border-aventurea-navy/40"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-aventurea-sky/10 text-aventurea-navy">
                <IconPin className="h-3.5 w-3.5" />
              </span>
              {p.provincia}
              <span className="text-[12px] font-semibold text-aventurea-ink-soft">
                {p.cantidad}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
