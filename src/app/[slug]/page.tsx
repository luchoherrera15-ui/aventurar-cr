import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCategoria, type Rancho } from "@/app/mi-rancho/types";
import { NOMBRE_RANCHO_BOOKEAR } from "@/app/eventos/constants";
import RanchoPortal from "@/app/eventos/rancho-portal";

/**
 * La URL corta de cada rancho/servicio, ej. bookea.lat/rancholastorres.
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

  // Los negocios de citas tienen su propia mini-página, con agenda por
  // horas — la URL corta los manda para allá.
  if ((data as { vertical?: string }).vertical === "citas") {
    redirect(`/citas/${slug}`);
  }

  const rancho = {
    ...(data as Rancho),
    categoria: normalizarCategoria((data as Rancho).categoria),
  };

  if (rancho.nombre === NOMBRE_RANCHO_BOOKEAR) {
    redirect("/eventos-salon");
  }

  // El negocio de Invitaciones Digitales es de Bookea mismo: no tiene
  // portal con calendario ni reservas — su "perfil" es el panel de
  // paquetes, donde el cliente pide lo que necesita y abre el chat.
  if (rancho.slug === "bookea-invitaciones") {
    redirect("/invitaciones");
  }

  return <RanchoPortal rancho={rancho} />;
}
