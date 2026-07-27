import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCategoria, type Rancho } from "@/app/mi-rancho/types";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/ranchos-eventos/constants";
import RanchoPortal from "@/app/ranchos-eventos/rancho-portal";

/**
 * La URL corta de cada rancho/servicio, ej. bookearcr.com/rancholastorres.
 * Vive en la raíz del sitio; Next.js siempre prueba primero las rutas
 * literales (/admin, /mi-rancho, /publicar, etc.), así que esta ruta
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
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("slug", slug)
    .eq("estado", "aprobado")
    .maybeSingle();

  if (!data) notFound();

  const rancho = {
    ...(data as Rancho),
    categoria: normalizarCategoria((data as Rancho).categoria),
  };

  if (rancho.nombre === NOMBRE_RANCHO_BOOKEAR) {
    redirect("/eventos-salon");
  }

  return <RanchoPortal rancho={rancho} />;
}
