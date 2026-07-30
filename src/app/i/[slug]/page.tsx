import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsearPreguntas } from "@/lib/invitaciones-preguntas";
import { fechaLargaCR } from "@/lib/fechas";
import InvitacionVista, { type Invitacion } from "./invitacion-vista";

// La barra del navegador se tiñe del navy del lienzo: la invitación
// se ve inmersiva también en móvil, sin el blanco del sitio.
export const viewport: Viewport = {
  themeColor: "#16295e",
  colorScheme: "only light",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitaciones")
    .select("titulo")
    .eq("slug", slug)
    .eq("estado", "activa")
    .maybeSingle();
  return {
    title: data?.titulo ?? "Invitación",
    description: "Estás en la lista — confirmá tu asistencia acá.",
    robots: { index: false },
  };
}

/**
 * La invitación pública (/i/{slug}): pantalla completa sin el header
 * del sitio. Corre con la llave anónima — la política de la base solo
 * muestra invitaciones activas, así que un borrador o una archivada
 * dan 404 sin lógica extra.
 */
export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitaciones")
    .select(
      "id, slug, titulo, anfitriones, mensaje, fecha_evento, hora, lugar_nombre, direccion, maps_url, portada_url, html_personalizado, tema",
    )
    .eq("slug", slug)
    .eq("estado", "activa")
    .maybeSingle();

  const invitacion = data as Invitacion | null;
  if (!invitacion) notFound();

  // Las preguntas configurables llegaron con la 0068. Se piden aparte
  // para tolerar que esa migración no haya corrido: si la columna no
  // existe, esta consulta falla sola y el RSVP sigue sin preguntas.
  const { data: extra } = await supabase
    .from("invitaciones")
    .select("preguntas")
    .eq("id", invitacion.id)
    .maybeSingle();
  const preguntas = parsearPreguntas(
    (extra as { preguntas?: unknown } | null)?.preguntas,
  );

  return (
    <InvitacionVista
      invitacion={invitacion}
      preguntas={preguntas}
      fechaLarga={fechaLargaCR(invitacion.fecha_evento)}
    />
  );
}
