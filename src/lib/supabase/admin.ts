import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con permisos totales, solo para el servidor. Se usa únicamente
 * para crear cuentas de usuario desde el panel admin (eso requiere la
 * llave secreta de servicio, que nunca llega al navegador).
 *
 * Devuelve null si la llave no está configurada, para poder mostrar un
 * mensaje claro en vez de romper la página.
 */
export function createAdminClient() {
  // .trim(): en Vercel el valor puede traer un \n pegado (ver
  // a/[slug]/page.tsx).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const FALTA_SERVICE_KEY =
  "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel para poder crear cuentas desde acá.";
