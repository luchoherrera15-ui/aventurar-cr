/**
 * GET /api/media/diagnostico — ¿está lista la configuración de Cloudflare?
 *
 * Solo para el equipo admin. Comprueba de verdad —hablando con R2 y con
 * Cloudflare— que las credenciales sirven, que las cuatro variantes
 * existen y que la CORS del bucket permite `if-none-match`, que es lo
 * único que rompe todas las subidas sin que ninguna prueba lo note.
 *
 * NUNCA devuelve el valor de una credencial: solo si está y si el
 * proveedor contestó.
 */

import { diagnosticarMedia } from "@/lib/media/diagnostico";
import { metodoNoPermitido, preflight } from "@/lib/media/respuestas";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se responde lo MISMO sin sesión y sin ser admin: quien prueba esta
  // ruta no se entera de si existe o de si su cuenta es especial.
  const noAutorizado = () =>
    new Response(JSON.stringify({ ok: false, mensaje: "No encontramos eso." }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });

  if (!user) return noAutorizado();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if ((perfil as { rol?: string } | null)?.rol !== "admin") return noAutorizado();

  const resultado = await diagnosticarMedia();

  return new Response(JSON.stringify(resultado, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const noPermitido = (request: Request) =>
  metodoNoPermitido({ origen: request.headers.get("origin") });

export async function OPTIONS(request: Request) {
  return preflight({ origen: request.headers.get("origin") });
}

export const POST = noPermitido;
export const PUT = noPermitido;
export const PATCH = noPermitido;
export const DELETE = noPermitido;
