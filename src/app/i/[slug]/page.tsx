import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import { createAnonClient } from "@/lib/supabase/server";
import { esFuncionInexistente } from "@/lib/visitas";
import { parsearPreguntas } from "@/lib/invitaciones-preguntas";
import { sanearHtmlInvitacion } from "@/lib/invitaciones/sanear-html";
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
 * Lo que devuelve `invitacion_por_slug`: los campos que pinta la vista
 * más `preguntas` y `es_ejemplo`, que antes se leían aparte.
 */
type InvitacionCargada = Invitacion & {
  /** Preguntas configurables del RSVP (0068) — jsonb crudo. */
  preguntas: unknown;
  /** Copia de vitrina del catálogo (0074): se ve, no se confirma. */
  es_ejemplo: boolean | null;
};

/**
 * La invitación, UNA sola vez por visita.
 *
 * Antes esta ruta hacía la misma consulta TRES veces: una en
 * `generateViewport` (para el color de la barra), otra en
 * `generateMetadata` (para el título) y otra en la página. Tres idas y
 * vueltas a Supabase de ~55 ms cada una para leer la misma fila.
 * `cache()` de React deduplica por render: la primera que llegue hace
 * el viaje y las otras dos reciben el mismo resultado.
 */
const cargarInvitacion = cache(async (slug: string): Promise<InvitacionCargada | null> => {
  const supabase = createAnonClient();
  // Antes esto era un SELECT directo sobre `invitaciones` con la llave
  // anónima. La auditoría (docs/seguridad-auditoria-2026-08-29.md,
  // hallazgo 5) confirmó EN VIVO que la policy abierta dejaba a
  // cualquiera ENUMERAR la tabla entera —titulo, fecha y hasta la
  // DIRECCIÓN de casa de cada evento— con un solo
  // `GET /rest/v1/invitaciones`. RLS no puede exigir el filtro por slug,
  // así que la fila pasa a venir por una función security-definer (0221)
  // que solo devuelve la invitación ACTIVA de ESE slug: acceso por link,
  // nunca listado. De paso trae `preguntas` y `es_ejemplo` en la misma
  // vuelta, así que las dos consultas por id que había abajo se van.
  const { data, error } = await supabase
    .rpc("invitacion_por_slug", { p_slug: slug })
    .maybeSingle();

  // Mientras la 0221 no esté aplicada la función no existe: se cae al
  // SELECT directo de siempre, que la policy vieja todavía le permite al
  // anónimo. Igual patrón que src/lib/visitas.ts con la 0107. Cuando la
  // migración corra, la función responde y este respaldo ni se roza; y
  // aunque se rozara, con la lectura anónima ya revocada devolvería null
  // sin filtrar nada. Así el código y la migración pueden desplegarse en
  // cualquier orden sin dejar la invitación en 404.
  if (error && esFuncionInexistente(error)) {
    const { data: directo } = await supabase
      .from("invitaciones")
      .select(
        "id, slug, titulo, anfitriones, mensaje, fecha_evento, hora, lugar_nombre, direccion, maps_url, portada_url, html_personalizado, tema, preguntas, es_ejemplo",
      )
      .eq("slug", slug)
      .eq("estado", "activa")
      .maybeSingle();
    return (directo as InvitacionCargada | null) ?? null;
  }
  return (data as InvitacionCargada | null) ?? null;
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
 * Las fotos que la IA mete en el HTML guardado apuntan al ORIGINAL del
 * bucket público — archivos de cámara de varios MB que cada invitado
 * bajaba enteros, treinta invitados por invitación. Acá, y SOLO acá —
 * este es el único punto donde ese HTML se le sirve a un visitante
 * (/invitacion/{slug} llega por rewrite a esta misma página); el editor
 * del admin, el duplicado de /cuenta y la hoja de imprimir siguen
 * leyendo la columna cruda — cada `src` de `<img>` que apunte a nuestro
 * bucket se reescribe hacia el optimizador de Next: el mismo archivo
 * pero a 1080 px y calidad 60, en AVIF/WebP y con el mes de caché del
 * optimizador. Los tres valores ya existen en next.config (deviceSizes,
 * qualities, minimumCacheTTL) y el host ya está en remotePatterns: no
 * se estrena configuración, se usa la que el resto del sitio ya paga.
 *
 * La regla es deliberadamente estrecha para no romper invitaciones ya
 * emitidas:
 *
 *   · SOLO etiquetas <img> — un <audio> o <video> pasado por el
 *     optimizador sería un 400 y una invitación muda;
 *   · SOLO `src` entre comillas (simples o dobles) — lo único que
 *     genera la IA y lo único que se puede recortar sin parsear HTML;
 *   · SOLO URLs que empiecen EXACTAMENTE por nuestro bucket público —
 *     un src relativo, un data:, otro host o una URL firmada
 *     (/object/sign/) no casan con el prefijo y quedan tal cual;
 *   · nada con `&` (sería una entidad HTML o una query que no es
 *     nuestra) ni `.svg` (el optimizador los rechaza sin
 *     dangerouslyAllowSVG) — ante la duda, el original de siempre.
 *
 * Como la ruta es force-static con revalidate 60, esta pasada corre una
 * vez por minuto como mucho, no por visita.
 */
function optimizarFotosDelBucket(html: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return html;
  const prefijo = `${base}/storage/v1/object/public/`;

  return html.replace(/<img\b[^>]*>/gi, (etiqueta) =>
    // `(\s)` y no `\b`: un boundary también casaría `data-src=`.
    etiqueta.replace(
      /(\s)src=(?:"([^"]*)"|'([^']*)')/i,
      (atributo: string, espacio: string, conDobles?: string, conSimples?: string) => {
        const url = conDobles ?? conSimples ?? "";
        if (!url.startsWith(prefijo) || url.includes("&") || /\.svg$/i.test(url)) {
          return atributo;
        }
        return `${espacio}src="/_next/image?url=${encodeURIComponent(url)}&w=1080&q=60"`;
      },
    ),
  );
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
  const invitacion = await cargarInvitacion(slug);
  if (!invitacion) notFound();

  // `preguntas` (0068) y `es_ejemplo` (0074) ya vienen en la MISMA
  // vuelta de `invitacion_por_slug` (0221): antes eran dos consultas
  // anónimas extra por id sobre la tabla, que la migración de seguridad
  // dejó sin lectura directa. Un dato ausente degrada suave igual que
  // antes — sin preguntas el RSVP va como siempre, y `es_ejemplo` en
  // null cuenta como false (nadie que llegue de la landing cae en la
  // lista de invitados de un evento real).
  const preguntas = parsearPreguntas(invitacion.preguntas);
  const esEjemplo = invitacion.es_ejemplo === true;

  // La reescritura se hace sobre una COPIA y solo para esta vista: el
  // marcador data-bookea="abrir-rsvp" que la vista busca en el HTML no
  // se toca, y `cargarInvitacion` sigue devolviendo la fila cruda para
  // metadata y viewport.
  //
  // Se SANEA acá, en el servidor, antes de que el HTML baje al
  // dangerouslySetInnerHTML de la vista: `html_personalizado` lo genera la
  // IA o lo edita el cliente, y por SSR sus <script> corren de verdad
  // (XSS). sanearHtmlInvitacion quita <script>, iframes, on* y esquemas
  // javascript:, y conserva estilos, imágenes y los ganchos data-bookea
  // (cuenta regresiva y RSVP, que monta React). Va DESPUÉS de reescribir
  // las fotos, para tener la última palabra sobre lo que se inyecta. Como
  // el string resultante es estable, el memo del countdown en la vista no
  // se ve afectado.
  const invitacionServida = invitacion.html_personalizado
    ? {
        ...invitacion,
        html_personalizado: sanearHtmlInvitacion(
          optimizarFotosDelBucket(invitacion.html_personalizado),
        ),
      }
    : invitacion;

  return (
    <InvitacionVista
      invitacion={invitacionServida}
      preguntas={preguntas}
      esEjemplo={esEjemplo}
      fechaLarga={fechaLargaCR(invitacion.fecha_evento)}
      claseFuente={cormorant.variable}
    />
  );
}
