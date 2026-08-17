import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Directorio from "./directorio";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import SelectorVertical from "@/components/selector-vertical";
import CarruselSuperDestacados from "@/components/carrusel-super-destacados";
import { leerSuperDestacados } from "@/lib/destacados";
// En carga diferida: el modal de Boki solo existe cuando el hash es
// #boki, así que sus ~41 KB de JS no tienen por qué viajar en el bundle
// inicial de esta página (ver planificador-lazy.tsx).
import Planificador from "@/components/planificador/planificador-lazy";
import { EsqueletoCarrusel, EsqueletoFiltros, EsqueletoGrilla } from "../esqueleto";
import { normalizarCategoria } from "../mi-negocio/types";
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
 * LA DIRECCIÓN OFICIAL DE ESTE CONTENIDO ES `/eventos`
 * ============================================================
 *
 * Acá decía `/`, y estaba bien mientras duró: la raíz y esta ruta
 * servían EL MISMO directorio en dos direcciones, y de las dos, la que
 * la gente escribe y enlaza es la pelada. Ganaba `/`.
 *
 * EL DÍA QUE ESTO SE DABA POR VENCIDO YA LLEGÓ. El comentario anterior
 * declaraba su propia condición de reversión: «el día que `/` tenga
 * contenido PROPIO —una portada multi-vertical de verdad, con
 * eventos/citas/hospedajes como secciones— `/eventos` pasa a ser una
 * página distinta, con su propio canónico a sí misma». Ese es el home
 * nuevo, y esto es ese cambio.
 *
 * Ya no hay un contenido con dos direcciones: hay DOS contenidos. La
 * portada es una portada y el directorio es este. Cada uno se canoniza
 * a sí mismo, que es lo que un canónico debe decir cuando la página
 * existe de verdad.
 *
 * ORDEN DEL CAMBIO (importa, y por eso queda escrito): esta etiqueta se
 * mudó a `/eventos` en un despliegue APARTE y ANTERIOR al del home
 * nuevo, con el contenido todavía idéntico en las dos direcciones. Así
 * el buscador consolida el directorio en su dirección definitiva
 * mientras el contenido no cambió —que es la parte fácil de digerir— y
 * recién después la portada cambia de tema. Al revés, las dos cosas le
 * pasan al buscador el mismo día y no hay forma de saber cuál movió
 * qué.
 *
 * DÓNDE VIVE LA ETIQUETA, Y POR QUÉ SE MUDÓ. Estuvo rendida como un
 * `<link>` dentro del JSX, y tenía que estarlo: mientras
 * `src/app/page.tsx` montaba ESTE componente, la Metadata API de este
 * archivo solo habría cubierto la ruta `/eventos` y la raíz habría
 * quedado sin etiqueta; como elemento, en cambio, React la izaba al
 * `<head>` de cualquier respuesta que montara este componente.
 *
 * Con el home nuevo eso dejó de pasar: `/` tiene cuerpo propio y ya no
 * monta nada de acá, así que este archivo sirve una sola ruta y la
 * Metadata API vuelve a ser el lugar correcto —el mismo valor, pero
 * declarado donde Next lo espera y donde la próxima persona lo va a
 * buscar—. La portada declara la suya en `src/app/page.tsx`.
 */
export const metadata: Metadata = {
  alternates: { canonical: urlSitio("/eventos") },
};

/*
 * ACÁ YA NO SE MONTAN LOS DATOS DE ORGANIZACIÓN (schema.org).
 *
 * Primero se mudaron a `src/lib/seo-organizacion.ts`, y no fue orden
 * por orden: acá se armaban con `CANONICO_DIRECTORIO`, y al mudar ese
 * canónico a `/eventos` la organización se habría mudado con él —
 * Bookea declarándole a Google que la EMPRESA vive en una sección del
 * sitio. La organización es siempre la raíz; el canónico de esta
 * pantalla es esta pantalla.
 *
 * Y ahora se montan en `src/app/page.tsx`, que es su lugar: la
 * recomendación de Google es declarar la organización UNA vez, en la
 * portada. Se seguían montando desde este archivo solo mientras `/`
 * montaba este componente; con el home nuevo eso dejó de pasar, y
 * dejarlos acá los habría duplicado —una vez en la portada y otra en
 * el directorio— que es peor que no ponerlos.
 */

export default function EventosPage() {
  return (
    // El lienzo crema de la línea bento (/lealtad): los bloques de
    // color se recortan encima.
    <div className="min-h-screen overflow-x-clip bg-aventurea-cream-2">
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
          {/* El chip activo es esta misma página, y desde el home nuevo
              eso además es CIERTO: antes, cuando `/` montaba este
              componente, "Eventos" quedaba marcado como la página
              actual pero enlazaba a la otra dirección del mismo
              contenido —el duplicado no canónico—. Ahora el
              `aria-current="page"` y el `href` dicen lo mismo. */}
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
    superDestacados,
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
    // para el carrusel de arriba. La consulta vive en @/lib/destacados
    // porque la portada nueva pinta la misma vitrina: ahí están el
    // filtro de "en configuración", el degradado cuando la 0169 no
    // corrió en esta base, y las columnas que puede ver el público.
    // Entra igual en esta tanda —devuelve una promesa como las demás—
    // así que sigue viajando en paralelo con el resto.
    leerSuperDestacados(supabase),

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
