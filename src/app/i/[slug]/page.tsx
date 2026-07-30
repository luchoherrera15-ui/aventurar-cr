import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InvitacionVista, { type Invitacion } from "./invitacion-vista";

// La barra del navegador se tiñe del navy del lienzo: la invitación
// se ve inmersiva también en móvil, sin el blanco del sitio.
export const viewport: Viewport = {
  themeColor: "#16295e",
  colorScheme: "only light",
};

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-12-12" → "Sábado 12 de diciembre de 2026" (es-CR, sin dudas de zona horaria). */
function fechaLargaCR(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dia = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d} de ${MESES[m - 1]} de ${y}`;
}

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

  return (
    <InvitacionVista
      invitacion={invitacion}
      fechaLarga={fechaLargaCR(invitacion.fecha_evento)}
    />
  );
}
