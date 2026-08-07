import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // .trim(): la variable puede venir de Vercel con un \n pegado al
  // final y ese salto viaja a toda URL armada con ella (ver el
  // comentario en a/[slug]/page.tsx — así se cayeron los álbumes).
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  );
}
