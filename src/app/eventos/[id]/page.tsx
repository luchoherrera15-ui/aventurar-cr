import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCategoria, type Rancho } from "@/app/mi-rancho/types";
import { NOMBRE_RANCHO_BOOKEAR } from "../constants";
import RanchoPortal from "../rancho-portal";

/**
 * Enlace legado (bookea.lat/eventos/<uuid>): sigue
 * funcionando para links ya compartidos, pero si el rancho ya tiene
 * slug (toda publicación nueva lo trae, y el backfill se lo dio a las
 * viejas) redirige a su URL corta para que esa sea la única que
 * circule de acá en adelante.
 */
export default async function RanchoPortalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .eq("estado", "aprobado")
    .maybeSingle();

  if (!data) notFound();

  // Se normaliza la categoría al leer: una fila que todavía no pasó por
  // la migración de taxonomía sigue mostrándose bien.
  const rancho = {
    ...(data as Rancho),
    categoria: normalizarCategoria((data as Rancho).categoria),
  };

  if (rancho.nombre === NOMBRE_RANCHO_BOOKEAR) {
    redirect("/eventos-salon");
  }

  if (rancho.slug) {
    redirect(`/${rancho.slug}`);
  }

  return <RanchoPortal rancho={rancho} />;
}
