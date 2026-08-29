import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";
import { CATEGORIA_LABEL, normalizarCategoria, UNIDAD_PRECIO_LABEL } from "@/app/mi-negocio/types";
import RanchoPortal from "@/app/eventos/rancho-portal";
import EsqueletoPortal from "@/app/eventos/esqueleto-portal";
import {
  COLUMNAS_PORTAL,
  COLUMNAS_PORTAL_JOVENES,
  pedirFila,
  type RanchoPublico,
} from "@/lib/ranchos-publicos";
import {
  datosEstructuradosNegocio,
  jsonLdSeguro,
  metadataNegocio,
  type NegocioSeo,
} from "@/lib/seo-negocio";

/**
 * La fila del negocio, UNA sola vez por visita.
 *
 * `generateMetadata` y la página se ejecutan por separado, así que
 * escrito a la ligera esto serían DOS consultas bloqueantes a Supabase
 * en la página pública más caliente del sitio — justo la que tiene el
 * TTFB medido (ver docs/rendimiento.md §1.8: la ficha es la única ruta
 * con sobrecosto de servidor, ~35 ms sobre una estática, y ese
 * sobrecosto es exactamente esta consulta). `cache()` de React
 * deduplica por render: la primera que llegue hace el viaje y la otra
 * recibe el mismo resultado. Mismo patrón que /a/[slug] y /i/[slug].
 */
/**
 * ⚠️ DOS CAPAS DE CACHÉ, CADA UNA CONTRA OTRO DESPERDICIO — el espejo
 * exacto de /citas/[slug], que estrenó el patrón.
 *
 * `cache()` de React (afuera) deduplica DENTRO de una visita (lo del
 * comentario de arriba). `unstable_cache` (adentro) comparte la fila
 * ENTRE visitas: la ficha de un negocio es idéntica para todo el
 * mundo, y sin esta capa CADA visita pagaba su propio viaje a la base.
 *
 * ── EL CLIENTE ANÓNIMO NO ES OPCIONAL ───────────────────────────────
 *
 * Dentro de `unstable_cache` no se puede tocar `cookies()` — y con
 * razón: lo que se guarde ahí SE LE SIRVE A CUALQUIERA. Acá es seguro
 * porque la consulta ya filtra `estado = 'aprobado'` y las columnas
 * son las públicas (`COLUMNAS_PORTAL`, sin SINPE ni datos de cobro;
 * ver el comentario de abajo). Nada depende de quién mira: un
 * visitante anónimo ya ejecutaba esta MISMA consulta con el rol `anon`
 * y veía exactamente lo mismo.
 *
 * El tag lleva el slug para que la edición de UN negocio no tire la
 * caché de todos — y es el mismo `negocio:<slug>` que revienta el
 * editor de mi-negocio con `updateTag`, así que la invalidación sigue
 * funcionando sin tocar nada más. La CLAVE, en cambio, va aparte de la
 * de citas a propósito: es la misma tabla pero otra lista de columnas,
 * y compartir clave serviría filas incompletas a una de las dos fichas.
 */
const cargarNegocio = cache(async (slug: string) => {
  const leer = unstable_cache(
    () => negocioDeLaBase(slug),
    ["ficha-portal", slug],
    { revalidate: 60, tags: ["negocio:" + slug] },
  );
  try {
    return await leer();
  } catch {
    // Sin caché de datos disponible (build, entornos raros) se cae al
    // viaje directo, que es lo que siempre hubo.
    return negocioDeLaBase(slug);
  }
});

function negocioDeLaBase(slug: string) {
  const supabase = createAnonClient();
  // Lista explícita y no `select("*")`: con `*` esta consulta traía
  // también `sinpe_numero`, `sinpe_titular` y los tres campos de la
  // cuenta bancaria, y terminaban dentro del HTML público de la ficha
  // (ver el comentario grande de @/lib/ranchos-publicos). Los datos de
  // cobro ya no salen de acá: el calendario los recibe recién cuando
  // toma su fecha, en la respuesta de `crearReservaTemporal`.
  return pedirFila(
    (columnas) =>
      supabase
        .from("ranchos")
        .select(columnas)
        .eq("slug", slug)
        .eq("estado", "aprobado")
        .maybeSingle(),
    COLUMNAS_PORTAL,
    COLUMNAS_PORTAL_JOVENES,
  );
}

/** Lo que necesita el presentador de metadata, sacado de la fila pública. */
function paraCompartir(rancho: RanchoPublico, slug: string): NegocioSeo {
  const categoria = normalizarCategoria(rancho.categoria);
  return {
    nombre: rancho.nombre,
    ruta: `/${slug}`,
    categoriaLabel: CATEGORIA_LABEL[categoria] ?? null,
    descripcion: rancho.descripcion ?? rancho.descripcion_larga ?? null,
    provincia: rancho.provincia ?? null,
    canton: rancho.canton ?? null,
    direccionExacta: rancho.direccion_exacta ?? null,
    latitud: rancho.latitud ?? null,
    longitud: rancho.longitud ?? null,
    // La de presentación primero: es la que el dueño eligió para que se
    // vea grande, o sea la que quiere que se vea al compartir.
    fotos: [
      rancho.foto_presentacion,
      rancho.foto_url,
      ...(rancho.fotos ?? []),
    ].filter((f): f is string => typeof f === "string" && f.trim().length > 0),
    precioDesde: rancho.precio_desde ?? null,
    unidadPrecio: rancho.unidad_precio ? UNIDAD_PRECIO_LABEL[rancho.unidad_precio] ?? null : null,
    telefono: rancho.contacto_whatsapp ?? null,
    redes: [rancho.instagram, rancho.facebook, rancho.tiktok, rancho.sitio_web],
  };
}

/**
 * Sin esto, TODA ficha de Eventos y Hospedajes se compartía con el
 * título genérico del sitio y sin foto: en WhatsApp el enlace salía
 * como una línea de texto gris, justo en el momento en que alguien
 * recomienda el negocio.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await cargarNegocio(slug);
  // Sin fila la página va a devolver 404; acá no se inventa nada y se
  // deja que herede lo del layout.
  if (!data) return {};
  return metadataNegocio(paraCompartir(data as unknown as RanchoPublico, slug));
}

/**
 * La URL corta de cada rancho/servicio, ej. bookea.lat/rancholastorres.
 * Vive en la raíz del sitio; Next.js siempre prueba primero las rutas
 * literales (/admin, /mi-negocio, /publicar, etc.), así que esta ruta
 * dinámica solo entra a jugar cuando ningún nombre de carpeta real
 * calza — por eso el slug nunca puede pisar una ruta existente (ver
 * RESERVED_SLUGS en src/lib/slug.ts).
 */
export default async function SlugPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Esta es la ÚNICA consulta que bloquea la respuesta: es la que decide
  // si esto es un 404, un redirect a otra vertical, o la página del
  // negocio. Todo lo demás va detrás del <Suspense> de abajo. Y la
  // comparte con `generateMetadata` — es la misma llamada, cacheada.
  const data = await cargarNegocio(slug);

  if (!data) notFound();

  // Los negocios de citas tienen su propia mini-página, con agenda por
  // horas — la URL corta los manda para allá.
  if (data.vertical === "citas") {
    redirect(`/citas/${slug}`);
  }

  // Los restaurantes también: menú, mesas y pickup viven en su ficha.
  if (data.vertical === "restaurantes") {
    redirect(`/restaurantes/${slug}`);
  }

  const fila = data as unknown as RanchoPublico;
  const rancho = {
    ...fila,
    categoria: normalizarCategoria(fila.categoria),
  };

  // El negocio de Invitaciones Digitales es de Bookea mismo: no tiene
  // portal con calendario ni reservas — su "perfil" es el panel de
  // paquetes, donde el cliente pide lo que necesita y abre el chat.
  if (rancho.slug === "bookea-invitaciones") {
    redirect("/invitaciones");
  }

  // Con el estado HTTP ya decidido (404/redirect arriba), el resto se
  // transmite: Next manda de una el armazón + el esqueleto y va
  // completando la página cuando la base contesta. Un `loading.tsx` no
  // serviría acá — saldría ANTES del notFound() y un slug inexistente
  // respondería 200.
  return (
    <>
      {/* Datos estructurados: lo que le deja a Google mostrar la ficha
          con dirección y rango de precio. Sale de la MISMA fila que ya
          se leyó — cero consultas extra. `jsonLdSeguro` escapa lo que
          venga de la base (la descripción la escribe el dueño). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdSeguro(datosEstructuradosNegocio(paraCompartir(fila, slug))),
        }}
      />
      <Suspense fallback={<EsqueletoPortal />}>
        <RanchoPortal rancho={rancho} />
      </Suspense>
    </>
  );
}
