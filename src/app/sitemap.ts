import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/server";
import { urlSitio } from "@/lib/sitio";

/**
 * ============================================================
 * EL MAPA DEL SITIO
 * ============================================================
 *
 * Lo que un buscador tiene que encontrar: las secciones públicas y la
 * ficha de cada negocio aprobado. Antes de esto no existía ninguno, y
 * las fichas solo se descubrían navegando el directorio — que carga
 * sus cards detrás de un `<Suspense>`.
 *
 * DOS REGLAS QUE NO SE PUEDEN ROMPER ACÁ:
 *
 * 1. SOLO URLs CANÓNICAS. La regla sigue en pie; lo que cambió es el
 *    caso que la ilustraba. Acá decía que `/eventos` NO se listara,
 *    porque servía el mismo directorio que `/` y se canonizaba a `/`.
 *    Desde que la portada tiene contenido propio, el directorio se
 *    canoniza a sí mismo (ver el comentario grande en eventos/page.tsx)
 *    y por lo tanto SÍ va: hoy son dos contenidos distintos, cada uno
 *    en su dirección. Listar una URL que se declara duplicada de otra
 *    sigue siendo mandarle al buscador dos señales opuestas — por eso
 *    esta regla se revisa cada vez que se toca un canónico.
 *
 * 2. SOLO URLs QUE RESPONDEN 200. Un negocio de Citas vive en
 *    `/citas/{slug}` y uno de Restaurantes en `/restaurantes/{slug}`;
 *    `/{slug}` los REDIRIGE (ver src/app/[slug]/page.tsx). Se lista el
 *    destino, no el rebote.
 *
 * Es un Route Handler cacheado: `createAnonClient` no toca cookies, así
 * que esto se genera una vez por hora y no en cada visita de un robot.
 */

/** Una hora: el directorio no cambia tan seguido como para pagar más. */
export const revalidate = 3600;

/**
 * Tope de fichas. El formato admite 50.000 por archivo; con este techo
 * ni se acerca, y si algún día lo alcanza hay que partir el mapa con
 * `generateSitemaps` en vez de dejar que se corte en silencio.
 */
const MAX_FICHAS = 5000;

/**
 * Las secciones fijas. `/booking` queda AFUERA a propósito: hoy es una
 * página de "muy pronto" (PaginaMantenimiento) y no hay nada que
 * indexar todavía.
 */
const SECCIONES: { ruta: string; prioridad: number; frecuencia: "daily" | "weekly" | "monthly" }[] =
  [
    /**
     * La raíz es EL marketplace. Desde ago 2026 no comparte ese papel
     * con nadie: `/citas` y `/eventos` se borraron y ahora hacen 301
     * hacia acá (ver `redirects()` en next.config.ts).
     *
     * ⚠️ NO LOS VUELVAS A AGREGAR ACÁ. Una URL que responde 301 no se
     * lista en un sitemap: le pide a Google que rastree una dirección
     * que ya le dijimos que no es la buena, y diluye justo la señal
     * que el redirect viene a concentrar.
     *
     * Las FICHAS de negocio sí siguen listadas, cada una con su
     * `/citas/<slug>` — eso lo arma `rutaDeFicha`, más abajo, y no se
     * toca: esas páginas están vivas.
     */
    { ruta: "/", prioridad: 1, frecuencia: "daily" },
    { ruta: "/hospedajes", prioridad: 0.8, frecuencia: "weekly" },
    { ruta: "/restaurantes", prioridad: 0.8, frecuencia: "weekly" },
    // FOOD.BOOKEA es un producto aparte (no vive en `ranchos`, no
    // aparece en la navegación principal) pero SÍ quiere clientes
    // reales por buscador — por eso va acá con sus propias fichas
    // abajo, igual criterio que /restaurantes.
    { ruta: "/food", prioridad: 0.7, frecuencia: "daily" },
    { ruta: "/lealtad", prioridad: 0.7, frecuencia: "weekly" },
    { ruta: "/invitaciones", prioridad: 0.7, frecuencia: "weekly" },
    { ruta: "/publicar", prioridad: 0.6, frecuencia: "monthly" },
    { ruta: "/terminos", prioridad: 0.2, frecuencia: "monthly" },
    { ruta: "/privacidad", prioridad: 0.2, frecuencia: "monthly" },
    { ruta: "/politicas", prioridad: 0.2, frecuencia: "monthly" },
  ];

/** Dónde vive públicamente la ficha de un negocio, según su vertical. */
function rutaDeFicha(vertical: string | null, slug: string): string {
  switch (vertical) {
    case "citas":
      return `/citas/${slug}`;
    case "restaurantes":
      return `/restaurantes/${slug}`;
    default:
      // Eventos y Hospedajes usan la URL corta de la raíz.
      return `/${slug}`;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date();

  const secciones: MetadataRoute.Sitemap = SECCIONES.map((s) => ({
    url: urlSitio(s.ruta),
    lastModified: ahora,
    changeFrequency: s.frecuencia,
    priority: s.prioridad,
  }));

  // Si Supabase no contesta, el mapa sale igual con las secciones: un
  // sitemap incompleto es infinitamente mejor que un 500 que le enseña
  // a Googlebot a no volver.
  let fichas: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("ranchos")
      .select("slug, vertical, created_at")
      .eq("estado", "aprobado")
      .not("slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(MAX_FICHAS);

    const filas = (data ?? []) as {
      slug: string | null;
      vertical: string | null;
      created_at: string | null;
    }[];

    fichas = filas
      .filter((f): f is { slug: string; vertical: string | null; created_at: string | null } =>
        Boolean(f.slug),
      )
      .map((f) => ({
        url: urlSitio(rutaDeFicha(f.vertical, f.slug)),
        // `ranchos` no tiene columna de última modificación; la fecha de
        // alta es lo más honesto que se puede decir sin inventar un
        // "modificado hoy" que ningún robot volvería a creer.
        lastModified: f.created_at ? new Date(f.created_at) : ahora,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
  } catch {
    fichas = [];
  }

  // Las fichas de FOOD.BOOKEA: tabla propia (food_businesses), no
  // `ranchos` — misma lógica de "sin esto no falla, sale sin ellas".
  let fichasFood: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("food_businesses")
      .select("slug, created_at")
      .eq("activo", true)
      .limit(MAX_FICHAS);

    fichasFood = ((data ?? []) as { slug: string; created_at: string | null }[]).map((f) => ({
      url: urlSitio(`/food/restaurante/${f.slug}`),
      lastModified: f.created_at ? new Date(f.created_at) : ahora,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    fichasFood = [];
  }

  return [...secciones, ...fichas, ...fichasFood];
}
