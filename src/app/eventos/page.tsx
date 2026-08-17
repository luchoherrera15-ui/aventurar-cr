import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Directorio from "./directorio";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import SelectorVertical from "@/components/selector-vertical";
import CarruselSuperDestacados, {
  type NegocioDestacado,
} from "@/components/carrusel-super-destacados";
// En carga diferida: el modal de Boki solo existe cuando el hash es
// #boki, así que sus ~41 KB de JS no tienen por qué viajar en el bundle
// inicial de esta página (ver planificador-lazy.tsx).
import Planificador from "@/components/planificador/planificador-lazy";
import { EsqueletoCarrusel, EsqueletoFiltros, EsqueletoGrilla } from "../esqueleto";
import { enConfiguracion, normalizarCategoria } from "../mi-negocio/types";
import type { Rancho } from "../mi-negocio/types";
/**
 * Las ÚNICAS columnas que las tarjetas del directorio leen (verificado
 * campo por campo contra rancho-card.tsx, rancho-card-grande.tsx,
 * riel-proveedores.tsx, planificador.tsx y los filtros de directorio.tsx).
 *
 * Antes acá había `select("*")`, y eso traía las 57 columnas de
 * `ranchos`. Dos problemas MEDIDOS:
 *
 * 1. FUGA DE DATOS. `select("*")` con la llave anónima devuelve
 *    `sinpe_numero`, `sinpe_titular`, `cuenta_banco`, `cuenta_numero`,
 *    `cuenta_titular` y `owner_id`, y esas columnas terminaban dentro
 *    del HTML público de /eventos. Con esta lista ya no salen.
 * 2. PESO. La misma consulta contra producción: 17030 bytes con `*`
 *    contra 8003 con esta lista (−53%). Y el payload RSC serializa
 *    estas filas TRES veces (Directorio + Planificador), así que el
 *    ahorro va al triple en el HTML.
 *
 * Si se agrega un campo a una tarjeta, hay que sumarlo acá.
 *
 * La lista se mudó a @/lib/ranchos-publicos —donde vive también el
 * mismo criterio aplicado a las FICHAS individuales, que arrastraban la
 * fuga que este comentario ya describía— y /hospedajes usa la misma.
 */
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";
import { urlSitio } from "@/lib/sitio";

/**
 * El armazón de /eventos: todo lo que se puede pintar SIN esperar a la
 * base. El contenido (las cards) va detrás de un `<Suspense>`.
 *
 * Así Next manda el `<head>` con los preloads de CSS y JS de inmediato,
 * en vez de retenerlo hasta que Supabase conteste. Medido con
 * `next start` contra la base de producción: el primer byte de /eventos
 * pasó de **652 ms** (la medición del informe de servidor, antes del
 * cambio) a **16 ms**; el documento completo llega a los 185 ms.
 *
 * Va como `<Suspense>` en la página y NO como `loading.tsx`: un
 * `loading.tsx` acá abajo también cubriría /eventos/[id], y ahí el
 * armazón saldría antes del `notFound()` — un id inexistente
 * respondería 200 en vez de 404. Lo verifiqué contra el servidor de
 * producción local: con el `loading.tsx` puesto,
 * `/eventos/<uuid inexistente>` daba 200; así da 404.
 */
/**
 * ============================================================
 * LA DIRECCIÓN OFICIAL DE ESTE CONTENIDO ES `/`
 * ============================================================
 *
 * Desde que la raíz dejó de redirigir (ver `rewrites()` en
 * next.config.ts: el 307 costaba ~340 ms desde Costa Rica), el MISMO
 * directorio responde 200 en dos direcciones: `bookea.lat/` y
 * `bookea.lat/eventos`. Para un buscador eso es contenido duplicado y
 * alguien tiene que desempatar.
 *
 * Gana `/`, y no por costumbre:
 *
 *  · Es la que la gente escribe, comparte y enlaza desde afuera. Toda
 *    la autoridad de dominio entra por ahí.
 *  · `/` no es una portada de marca que enlaza al directorio: ES el
 *    directorio (src/app/page.tsx renderiza este mismo componente).
 *    No hay dos contenidos que separar — hay uno con dos direcciones.
 *  · Matar el redirect ya se hizo justamente para que la raíz dejara
 *    de regalar su autoridad. Canonizar hacia `/eventos` la volvería a
 *    regalar por otra puerta, y de paso dejaría a quien busca "Bookea"
 *    aterrizando en una URL de sección.
 *
 * CUÁNDO SE REVIERTE: el día que `/` tenga contenido PROPIO (una
 * portada multi-vertical de verdad, con eventos/citas/hospedajes como
 * secciones). Ahí `/eventos` pasa a ser una página distinta, con su
 * propio canónico a sí misma, y esta etiqueta se borra.
 *
 * POR QUÉ LA ETIQUETA VA ACÁ, EN EL JSX, Y NO EN `export const
 * metadata`: la Metadata API se resuelve por RUTA. `src/app/page.tsx`
 * monta este componente, no esta ruta, así que un `alternates.canonical`
 * declarado en este archivo cubriría `/eventos` y dejaría `/` sin
 * etiqueta. Rendido como elemento, React lo iza al `<head>` de las DOS
 * respuestas, con el mismo valor, que es exactamente la promesa que un
 * canónico tiene que hacer. (Ponerlo en el layout raíz no sirve: la
 * metadata de un layout la heredan TODAS las rutas de abajo, y /citas,
 * /hospedajes y cada ficha terminarían canonizadas a `/`.)
 */
const CANONICO_DIRECTORIO = urlSitio("/");

/**
 * Quién es Bookea, en el idioma que leen los buscadores.
 *
 * Va en ESTE componente y no en el layout raíz por la misma razón que
 * el canónico: acá es la portada del sitio (`/` monta este componente),
 * y la recomendación de Google es declarar la organización UNA vez, en
 * la portada — no repetida en cada pantalla del panel.
 *
 * Deliberadamente corto: nombre, dirección oficial, logo y el idioma
 * del sitio. Los datos que no se pueden sostener (teléfono, dirección
 * física, redes) no se inventan: un dato estructurado que no calza con
 * lo que dice la página vale menos que ninguno.
 */
const DATOS_ORGANIZACION = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${CANONICO_DIRECTORIO}#organizacion`,
      name: "Bookea",
      url: CANONICO_DIRECTORIO,
      logo: urlSitio("/logo-bookea-v3.png"),
      areaServed: { "@type": "Country", name: "Costa Rica" },
    },
    {
      "@type": "WebSite",
      "@id": `${CANONICO_DIRECTORIO}#sitio`,
      name: "Bookea",
      url: CANONICO_DIRECTORIO,
      inLanguage: "es-CR",
      publisher: { "@id": `${CANONICO_DIRECTORIO}#organizacion` },
    },
  ],
};

export default function EventosPage() {
  return (
    // El lienzo crema de la línea bento (/lealtad): los bloques de
    // color se recortan encima.
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
      <link rel="canonical" href={CANONICO_DIRECTORIO} />
      <script
        type="application/ld+json"
        // JSON serializado por nosotros, sin nada que venga de la base:
        // no hay entrada de usuario que escapar acá.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ORGANIZACION) }}
      />
      <SiteHeader breadcrumb="Eventos" />

      <section className="pb-16 pt-4">
        <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
          {/* Sin hero de marketing (buscador grande, banners): eso sigue
              descartado a propósito, todo el espacio es para las cards.
              El único bloque de arriba es el carrusel de Súper
              destacados (0169, dentro de DirectorioEventos), que es
              contenido real del directorio —no una portada aparte— así
              que no rompe esa regla. El h1 queda para lectores de
              pantalla y SEO. */}
          <h1 className="sr-only">Todo para tu evento — directorio nacional</h1>
          <div className="mb-4">
            <SelectorVertical activo="eventos" />
          </div>

          {/* El esqueleto calca la forma de lo que viene: el buscador con
              sus chips y la grilla de cards. Nada salta de lugar cuando
              llegan los datos. */}
          <Suspense
            fallback={
              <>
                <EsqueletoCarrusel />
                <EsqueletoFiltros />
                <EsqueletoGrilla cantidad={6} />
              </>
            }
          >
            <DirectorioEventos />
          </Suspense>
        </div>
      </section>

      {/* El avisito flotante de invitaciones digitales queda APAGADO
          hasta nuevo aviso (decisión de producto). El componente sigue
          en src/components/aviso-invitaciones-flotante.tsx: para
          reactivarlo alcanza con volver a montarlo acá. */}

      {/* El pie chiquito de antes solo decía "BOOKEA — Costa Rica": los
          legales quedaban publicados pero sin que los enlazara nadie.
          El pie del sitio los lleva, y de paso el link de paquetes. */}
      <p className="border-t border-aventurea-line py-6 text-center text-xs text-zinc-500">
        <Link href="/puntaleona-web" className="font-bold text-aventurea-orange">
          Paquetes vacacionales
        </Link>
      </p>
      <SiteFooter />
    </div>
  );
}

/** Las cards del directorio: lo único que necesita ir a la base. */
async function DirectorioEventos() {
  const supabase = await createClient();

  // UNA sola tanda a Supabase en vez de cinco.
  //
  // Estas cuatro consultas no dependen una de otra, pero estaban
  // escritas como cuatro `await` seguidos: cada una esperaba a que la
  // anterior volviera. Medido contra producción, cada ida y vuelta a
  // Supabase desde Vercel cuesta ~55 ms, así que la cascada le sumaba
  // ~165 ms al TTFB de esta página sin ninguna razón. `auth.getUser()`
  // entra también acá: para un visitante anónimo no sale a la red
  // (corta con AuthSessionMissingError) y para uno con sesión se
  // resuelve en paralelo con las demás.
  const [
    { data },
    { data: confirmadas },
    { data: calificacionesData },
    { data: resenasData },
    { data: superDestacadosData },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("ranchos")
      .select(COLUMNAS_CARD)
      .eq("estado", "aprobado")
      // Los más nuevos primero: mezcla todas las categorías en el frente
      // en vez de amontonar ahí a los lugares (los primeros que existieron
      // en la plataforma), y los sitios viejos se corren solos hacia las
      // páginas siguientes conforme se publican otros.
      .order("created_at", { ascending: false }),

    // Solo "lugares" reserva por fecha en línea — el resto se contrata por
    // WhatsApp, sin calendario. Traemos de una sola vez qué fechas ya están
    // confirmadas para poder filtrar por "Cuándo" sin una consulta por card.
    supabase
      .from("disponibilidad_rancho")
      .select("rancho_id, fecha")
      .eq("estado", "confirmada"),

    // Calificación real (Fase 1): si un proveedor todavía no tiene
    // reseñas, la tarjeta simplemente no muestra estrellas — nunca un
    // número inventado.
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),

    // Una reseña con comentario por proveedor, la más reciente: la
    // tarjeta grande del directorio la muestra como cita, igual que los
    // marketplaces de referencia. Se trae un lote y se queda la primera
    // de cada rancho (PostgREST no hace "primera por grupo").
    supabase
      .from("resenas")
      .select("rancho_id, comentario")
      .not("comentario", "is", null)
      .order("created_at", { ascending: false })
      .limit(300),

    // Los hasta 10 "súper destacados" (0169) que el admin eligió a mano
    // para el carrusel de arriba — consulta APARTE de COLUMNAS_CARD (no
    // filtrada por vertical: es una vitrina de todo el marketplace, no
    // solo Eventos) y con manejo de error propio: si la migración 0169
    // todavía no corrió en esta base, `data` llega null y el carrusel
    // simplemente no se pinta — el resto de la página sigue viva.
    supabase
      .from("ranchos")
      .select(
        "id, slug, nombre, foto_url, provincia, canton, categoria, vertical, detalles",
      )
      .eq("estado", "aprobado")
      .eq("super_destacado", true)
      .order("created_at", { ascending: false })
      .limit(10),

    supabase.auth.getUser(),
  ]);

  // Las tarjetas piden el tipo `Rancho` completo pero solo leen las
  // columnas de COLUMNAS_CARD (verificado arriba) — de ahí el cast.
  const ranchos = ((data ?? []) as unknown as (Rancho & { vertical?: string })[])
    // Solo la vertical de eventos: citas y hospedajes tienen su propio
    // directorio. Se filtra acá (no en SQL) para que la página siga
    // viva aunque la migración 0055 no se haya corrido todavía.
    .filter((r) => (r.vertical ?? "eventos") === "eventos")
    .map((r) => ({
      ...r,
      categoria: normalizarCategoria(r.categoria),
    }))
    // Los destacados del admin van de primeros, en su orden. Se ordena
    // acá y no en SQL para que la página siga viva aunque la migración
    // 0044 todavía no se haya corrido (sort es estable: el resto
    // conserva el más-nuevo-primero).
    .sort(
      (a, b) => (a.destacado_orden ?? Infinity) - (b.destacado_orden ?? Infinity),
    );

  const superDestacados: NegocioDestacado[] = (
    (superDestacadosData ?? []) as {
      id: string;
      slug: string | null;
      nombre: string;
      foto_url: string | null;
      provincia: string | null;
      canton: string | null;
      categoria: string;
      vertical?: string;
      detalles?: Record<string, unknown> | null;
    }[]
  )
    // Un negocio "en configuración" se ve en la grilla pero no se puede
    // abrir (la card le pone un velo y le corta el link). De héroe
    // clickeable de la portada sería una promesa que no se cumple: el
    // clic no lleva a ninguna parte. Se saca del carrusel.
    .filter((n) => !enConfiguracion(n.detalles))
    .map((n) => ({
      id: n.id,
      slug: n.slug,
      nombre: n.nombre,
      fotoUrl: n.foto_url,
      provincia: n.provincia,
      canton: n.canton,
      categoria: n.categoria,
      vertical: n.vertical ?? "eventos",
    }));

  const fechasOcupadas = (confirmadas ?? []) as { rancho_id: string; fecha: string }[];

  const calificaciones = (calificacionesData ?? []) as {
    rancho_id: string;
    promedio: number;
    total: number;
  }[];

  const resenaPorRancho: Record<string, string> = {};
  for (const r of (resenasData ?? []) as { rancho_id: string; comentario: string }[]) {
    if (!(r.rancho_id in resenaPorRancho)) resenaPorRancho[r.rancho_id] = r.comentario;
  }

  // La única consulta que no puede ir en la tanda de arriba: necesita
  // el id de la sesión. Solo la paga quien tiene sesión abierta.
  let favoritosIniciales: string[] = [];
  if (user) {
    const { data: favData } = await supabase
      .from("favoritos")
      .select("rancho_id")
      .eq("cliente_id", user.id);
    favoritosIniciales = (favData ?? []).map((f) => f.rancho_id as string);
  }

  return (
    <>
      <CarruselSuperDestacados negocios={superDestacados} />

      <Directorio
        ranchos={ranchos}
        fechasOcupadas={fechasOcupadas}
        calificaciones={calificaciones}
        resenaPorRancho={resenaPorRancho}
        favoritosIniciales={favoritosIniciales}
        sesionActiva={!!user}
      />

      {/* Cotizador guiado "Asistente Boki": se abre por hash (#boki)
          desde el chip de la barra de categorías del directorio. Es un
          overlay `fixed` que solo existe cuando está abierto, así que
          colgarlo desde acá adentro no cambia en nada cómo se ve. */}
      <Planificador
        ranchos={ranchos}
        fechasOcupadas={fechasOcupadas}
        calificaciones={calificaciones}
        favoritosIniciales={favoritosIniciales}
        sesionActiva={!!user}
      />
    </>
  );
}
