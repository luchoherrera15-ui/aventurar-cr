import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import { createAnonClient } from "@/lib/supabase/server";
import { parsearPreguntas } from "@/lib/invitaciones-preguntas";
import { fechaLargaCR } from "@/lib/fechas";
import InvitacionVista, { type Invitacion } from "./invitacion-vista";
// Las animaciones de las plantillas (inv2-*/inv3-*) viven en su propia
// hoja — así el resto del sitio (home, eventos, citas, el panel de
// negocio...) no las descarga nunca.
import "./plantillas.css";

// La serif fina de la plantilla clásica — la misma vía que el álbum
// (/a/{slug}): next/font la sirve desde el propio sitio y acá solo
// deja la variable CSS que usa .inv3-serif en plantillas.css.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--inv3-serif",
});

/**
 * ── ESTA RUTA SE CACHEA EN EL BORDE ──────────────────────────────────
 *
 * Es la página que se manda por WhatsApp y que abren treinta invitados
 * seguidos desde el teléfono: se ve EXACTAMENTE igual para todos. No lee
 * sesión (usa `createAnonClient()`, sin cookies) y lo que se puede ver
 * lo decide la RLS, que solo devuelve invitaciones en estado 'activa'.
 *
 * Qué se gana, con los números medidos en producción: /i/demo-magia
 * devolvía el documento en 340 ms con `x-vercel-cache: MISS`, y el
 * primer CSS/JS no arrancaba hasta los 760 ms (420 ms de brecha porque
 * el `<head>` espera a Supabase). Una ruta cacheada vuelve en 126–137 ms
 * con `HIT` y su brecha es de 36 ms. La invitación es además la página
 * con el hilo principal más ocupado del sitio (686 ms en móvil), así que
 * todo lo que se le adelante al navegador cuenta doble.
 *
 * Cómo se invalida: sola, a los 60 segundos. Se eligió tiempo y no
 * `revalidateTag` porque el peor caso es benigno y acotado — alguien
 * corrige una hora o archiva una invitación y el cambio tarda a lo sumo
 * un minuto en verse. Si algún día hay que borrar una invitación al
 * instante, el camino correcto es llamar `revalidatePath('/i/'+slug)`
 * desde la acción que la archiva, no bajar este número.
 */
export const dynamic = "force-static";
export const revalidate = 60;

/**
 * La invitación, UNA sola vez por visita.
 *
 * Antes esta ruta hacía la misma consulta TRES veces: una en
 * `generateViewport` (para el color de la barra), otra en
 * `generateMetadata` (para el título) y otra en la página. Tres idas y
 * vueltas a Supabase de ~55 ms cada una para leer la misma fila.
 * `cache()` de React deduplica por render: la primera que llegue hace
 * el viaje y las otras dos reciben el mismo resultado. Las tres
 * columnas que necesitan ya venían en el select de la página.
 */
const cargarInvitacion = cache(async (slug: string) => {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("invitaciones")
    .select(
      "id, slug, titulo, anfitriones, mensaje, fecha_evento, hora, lugar_nombre, direccion, maps_url, portada_url, html_personalizado, tema",
    )
    .eq("slug", slug)
    .eq("estado", "activa")
    .maybeSingle();
  return data as Invitacion | null;
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
  const invitacion = await cargarInvitacion(slug);
  const personalizada = Boolean(
    (invitacion as { html_personalizado?: string | null } | null)?.html_personalizado,
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
  const invitacion = await cargarInvitacion(slug);
  return {
    title: invitacion?.titulo ?? "Invitación",
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
  const supabase = createAnonClient();
  const invitacion = await cargarInvitacion(slug);
  if (!invitacion) notFound();

  // Estas dos van juntas: antes eran dos `await` seguidos, o sea dos
  // idas y vueltas puestas en fila (~55 ms cada una) para leer dos
  // columnas de la MISMA fila que ya se leyó arriba. Siguen siendo dos
  // consultas aparte a propósito — cada una tolera que su migración no
  // haya corrido sin arrastrar a la otra ni a la principal — pero ahora
  // viajan en paralelo, en una sola tanda.
  const [{ data: extra }, { data: muestra }] = await Promise.all([
    // Las preguntas configurables llegaron con la 0068: si la columna no
    // existe, esta consulta falla sola y el RSVP sigue sin preguntas.
    supabase.from("invitaciones").select("preguntas").eq("id", invitacion.id).maybeSingle(),
    // Las copias de vitrina (0074) se ven pero no se confirman: nadie
    // que llegue desde la landing debe caer en la lista de invitados de
    // un evento real.
    supabase.from("invitaciones").select("es_ejemplo").eq("id", invitacion.id).maybeSingle(),
  ]);
  const preguntas = parsearPreguntas((extra as { preguntas?: unknown } | null)?.preguntas);
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
