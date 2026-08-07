import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Autenticar una petición que viene de la app móvil.
 *
 * El sitio autentica por cookies (createClient de ./server), pero el
 * app no tiene cookies: manda el access_token de su sesión de Supabase
 * en `Authorization: Bearer <token>`. Los endpoints que atienden a los
 * dos usan esto para el caso del teléfono.
 *
 * El cliente que devuelve actúa COMO ese usuario, no con la service
 * key: la RLS lo ve igual que a una sesión del navegador. Eso importa
 * — un endpoint que se salta la RLS tiene que ganárselo por una razón
 * concreta, no por comodidad.
 */

export type SesionBearer = {
  supabase: SupabaseClient;
  usuarioId: string;
  correo: string | null;
  token: string;
};

/** El token del header, o null si no vino uno usable. */
export function tokenDeLaPeticion(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 ? token : null;
}

/**
 * Devuelve la sesión del app, o null si no hay token, si el servidor
 * no está configurado o si el token no corresponde a nadie.
 */
export async function sesionDesdeBearer(req: Request): Promise<SesionBearer | null> {
  const token = tokenDeLaPeticion(req);
  if (!token) return null;

  // .trim(): en Vercel el valor puede traer un \n pegado (ver
  // a/[slug]/page.tsx).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;

  const supabase = createSupabaseClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return { supabase, usuarioId: user.id, correo: user.email ?? null, token };
}
