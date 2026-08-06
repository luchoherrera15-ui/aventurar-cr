import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente para PÁGINAS PÚBLICAS PRE-GENERADAS (ISR).
 *
 * El cliente de server.ts lee las cookies del visitante, y en Next leer
 * cookies obliga a renderizar la página en cada request. Este cliente
 * no toca cookies: consulta como visitante anónimo (solo ve lo que la
 * RLS deja ver sin sesión), y con eso la página puede quedar generada
 * de antemano en el hosting y servirse al instante.
 *
 * Regla: usarlo únicamente para datos públicos (directorio, portadas).
 * Nada de sesión ni datos por usuario — eso se resuelve en el navegador
 * (ver src/lib/sesion-publica.ts).
 */
export function createClientePublico() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
