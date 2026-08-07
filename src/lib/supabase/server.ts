import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * El cliente anónimo SIN cookies — el que permite cachear una página.
 *
 * `createClient()` (abajo) llama a `cookies()`, y en el App Router un
 * solo `cookies()` en el árbol vuelve DINÁMICA la ruta entera: Next le
 * pone `cache-control: private, no-cache, no-store` y la CDN de Vercel
 * responde `x-vercel-cache: MISS` siempre. Medido en producción: una
 * ruta estática vuelve en 126–137 ms con `HIT`; las dinámicas, entre
 * 192 y 465 ms con `MISS`, y encima el `<head>` con los preloads de CSS
 * y JS no sale hasta que Supabase contesta (176–685 ms de brecha).
 *
 * Este cliente es para las páginas PÚBLICAS que se ven idénticas para
 * todo el mundo y cuyo contenido lo protege la RLS, no la sesión (hoy:
 * /i/[slug]). Al no tocar cookies, la ruta puede quedar cacheada en el
 * borde con `revalidate`.
 *
 * ⚠️ NO usarlo donde la respuesta dependa de quién mira. Sin cookies no
 * hay sesión, así que la RLS ve un anónimo — y si la página igual se
 * cachea, lo que quede guardado se le sirve a cualquiera.
 */
export function createAnonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // Sin sesión que refrescar: es un lector anónimo a propósito.
        },
      },
    },
  );
}

export async function createClient() {
  const cookieStore = await cookies();

  // .trim(): en Vercel el valor puede traer un \n pegado (ver
  // a/[slug]/page.tsx).
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llama desde un Server Component, donde no se pueden setear
            // cookies. El proxy.ts ya se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
