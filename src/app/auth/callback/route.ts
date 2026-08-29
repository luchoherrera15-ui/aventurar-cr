import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/url-segura";

/**
 * Aterrizaje del login con Google (OAuth de Supabase). Google devuelve
 * al navegador acá con un `?code` de un solo uso; se canjea por la
 * sesión (las cookies las escribe el cliente de @supabase/ssr) y se
 * redirige a `?next`.
 *
 * `next` viene de la URL, así que no se le puede creer a ciegas: solo
 * se aceptan rutas INTERNAS del propio sitio. `rutaInternaSegura` cierra
 * el open redirect en todas sus formas —"//otro.com", "/\otro.com" (el
 * parser vuelve "\" en "/"), tabs/saltos que colapsan la ruta— y ante
 * cualquier duda devuelve null; acá eso cae a /cuenta.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const destino = rutaInternaSegura(next, url.origin) ?? "/cuenta";

  // Sin código no hay nada que canjear (llegaron acá a mano, o Google
  // devolvió un error): a /cuenta, donde el login vuelve a ofrecerse.
  if (!code) {
    return NextResponse.redirect(new URL("/cuenta", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/cuenta", url.origin));
  }

  // Google ya sabe cómo se llama la persona: si el perfil quedó sin
  // nombre (el trigger handle_new_user solo copia la metadata `nombre`,
  // que OAuth no manda), se completa con el nombre de Google vía el RPC
  // que solo deja a cada quien editar SU nombre. Si algo falla, no pasa
  // nada: la sesión ya está abierta y el nombre se puede poner después.
  const meta = data.user.user_metadata;
  const nombreGoogle =
    typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name
      : typeof meta.name === "string" && meta.name.trim()
        ? meta.name
        : null;
  if (nombreGoogle) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!perfil?.nombre) {
      await supabase.rpc("actualizar_mi_nombre", { p_nombre: nombreGoogle });
    }
  }

  return NextResponse.redirect(new URL(destino, url.origin));
}
