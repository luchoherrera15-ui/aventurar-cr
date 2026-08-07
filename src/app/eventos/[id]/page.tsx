import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizarCategoria, type Rancho } from "@/app/mi-negocio/types";
import RanchoPortal from "../rancho-portal";
import EsqueletoPortal from "../esqueleto-portal";

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

  if (rancho.slug) {
    redirect(`/${rancho.slug}`);
  }

  // Igual que /[slug]: el 404 y el redirect ya quedaron decididos con la
  // consulta de arriba, así que de acá para abajo se puede transmitir.
  return (
    <Suspense fallback={<EsqueletoPortal />}>
      <RanchoPortal rancho={rancho} />
    </Suspense>
  );
}
