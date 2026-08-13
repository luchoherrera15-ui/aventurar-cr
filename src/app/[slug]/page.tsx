import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCategoria } from "@/app/mi-negocio/types";
import RanchoPortal from "@/app/eventos/rancho-portal";
import EsqueletoPortal from "@/app/eventos/esqueleto-portal";
import {
  COLUMNAS_PORTAL,
  COLUMNAS_PORTAL_JOVENES,
  pedirFila,
  type RanchoPublico,
} from "@/lib/ranchos-publicos";

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
  const supabase = await createClient();
  // Esta es la ÚNICA consulta que bloquea la respuesta: es la que decide
  // si esto es un 404, un redirect a otra vertical, o la página del
  // negocio. Todo lo demás va detrás del <Suspense> de abajo.
  //
  // Lista explícita y no `select("*")`: con `*` esta consulta traía
  // también `sinpe_numero`, `sinpe_titular` y los tres campos de la
  // cuenta bancaria, y terminaban dentro del HTML público de la ficha
  // (ver el comentario grande de @/lib/ranchos-publicos). Los datos de
  // cobro ya no salen de acá: el calendario los recibe recién cuando
  // toma su fecha, en la respuesta de `crearReservaTemporal`.
  const data = await pedirFila(
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
    <Suspense fallback={<EsqueletoPortal />}>
      <RanchoPortal rancho={rancho} />
    </Suspense>
  );
}
