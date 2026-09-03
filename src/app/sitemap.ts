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
    // ⚠️ `/food` salió del sitemap: Bookea Food se apagó el 27 ago 2026
    // y se eliminó del repo el 30. Dejarla acá le pediría a Google que
    // indexe una ruta que ya no existe.
    //
    // OJO: `/restaurantes` de arriba NO es FOOD — es la cuarta vertical
    // del marketplace, sobre la tabla `ranchos`. Sigue viva.
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
      // ⚠️ `en_marketplace` FALTABA ACÁ (2 sep 2026). Sin este filtro el
      // sitemap le entregaba a Google las ~99 fichas sembradas del
      // `/demo-bookea`, que TODAS las demás superficies ya escondían: se
      // estaban indexando negocios inventados como si fueran reales.
      // Es el mismo filtro que usa el directorio (`home-datos.ts`), no
      // una regla nueva.
      .neq("en_marketplace", false)
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

  // ⚠️ ACÁ SE LEÍAN LAS FICHAS DE FOOD (`food_businesses`) PARA EL
  // SITEMAP. Bookea Food se apagó el 27 ago 2026 y se eliminó del repo
  // el 30, así que esas URLs ya no existen y pedirle a Google que las
  // visite sería mandarlo a la nada. Las tablas `food_*` siguen en la
  // base con sus datos; nada del sitio las lee.
  //
  // La consulta se va entera, no solo las URLs: era una ida a Supabase
  // en cada generación del sitemap para una tabla que este sitio ya no
  // sirve.
  const fichasFood: MetadataRoute.Sitemap = [];

  return [...secciones, ...fichas, ...fichasFood];
}
