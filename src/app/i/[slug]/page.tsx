import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { parsearPreguntas } from "@/lib/invitaciones-preguntas";
import { fechaLargaCR } from "@/lib/fechas";
import InvitacionVista, { type Invitacion } from "./invitacion-vista";

// La serif fina de la plantilla clásica — la misma vía que el álbum
// (/a/{slug}): next/font la sirve desde el propio sitio y acá solo
// deja la variable CSS que usa .inv3-serif en globals.css.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--inv3-serif",
});

// La barra del navegador acompaña al lienzo: marfil en la plantilla
// clásica; si el equipo diseñó un HTML a la medida, se queda el navy
// de siempre para no desentonar con ese diseño.
export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitaciones")
    .select("html_personalizado")
    .eq("slug", slug)
    .eq("estado", "activa")
    .maybeSingle();
  const personalizada = Boolean(
    (data as { html_personalizado?: string | null } | null)?.html_personalizado,
  );
  return {
    themeColor: personalizada ? "#16295e" : "#faf7f2",
    colorScheme: "only light",
  };
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

  // Las copias de vitrina (0074) se ven pero no se confirman: nadie
  // que llegue desde la landing debe caer en la lista de invitados de
  // un evento real. Consulta aparte por si la 0074 no corrió.
  const { data: muestra } = await supabase
    .from("invitaciones")
    .select("es_ejemplo")
    .eq("id", invitacion.id)
    .maybeSingle();
  const esEjemplo = (muestra as { es_ejemplo?: boolean } | null)?.es_ejemplo === true;

  return (
    <InvitacionVista
      invitacion={invitacion}
      preguntas={preguntas}
      esEjemplo={esEjemplo}
      fechaLarga={fechaLargaCR(invitacion.fecha_evento)}
      claseFuente={cormorant.variable}
    />
  );
}
