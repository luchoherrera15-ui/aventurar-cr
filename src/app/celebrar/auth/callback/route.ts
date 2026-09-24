import { NextResponse } from "next/server";
import { conPrefijo, destinoDentroDeCelebrar, prefijoParaHost } from "@/lib/celebrar/dominios";
import { RUTA } from "@/lib/celebrar/rutas";
import { createClient } from "@/lib/supabase/server";

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL ATERRIZAJE DEL LOGIN DE CELEBRAR
 * ══════════════════════════════════════════════════════════════════
 *
 * Google, Facebook y el link de recuperación de contraseña devuelven
 * al navegador acá con un `?code` de un solo uso. Se canjea por la
 * sesión (las cookies las escribe @supabase/ssr **para este host**, que
 * es lo que hace posible entrar en celebrar.lat con la misma cuenta) y
 * se sigue a `?next`.
 *
 * Es la contraparte de `src/app/auth/callback` (Bookea) y hace el mismo
 * canje, pero NO se reutiliza aquel a propósito: sus caídas van a
 * `/cuenta` (una página de Bookea) y su `next` por defecto también.
 * Acá toda caída queda dentro de CELEBRAR, y en `celebrar.lat` se llega
 * como `/auth/callback` porque el proxy lo reescribe a esta ruta.
 *
 * `next` viene de la URL: `destinoDentroDeCelebrar` lo valida (ruta
 * interna, dentro del producto, nunca el propio login).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const prefijo = prefijoParaHost(request.headers.get("host"));
  const destino = destinoDentroDeCelebrar(url.searchParams.get("next"), prefijo, url.origin);
  const alLogin = new URL(conPrefijo(RUTA.entrar, prefijo), url.origin);

  const code = url.searchParams.get("code");
  if (!code) {
    alLogin.searchParams.set("aviso", "sin-codigo");
    return NextResponse.redirect(alLogin);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    alLogin.searchParams.set("aviso", "codigo-vencido");
    return NextResponse.redirect(alLogin);
  }

  // Google ya sabe cómo se llama la persona: si el perfil quedó sin
  // nombre (el trigger solo copia la metadata `nombre`, que OAuth no
  // manda), se completa con el RPC que solo deja editar el propio.
  // Si falla no pasa nada: la sesión ya está abierta.
  const meta = data.user.user_metadata ?? {};
  const nombreProveedor = [meta.full_name, meta.name].find(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  if (nombreProveedor) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!perfil?.nombre) {
      await supabase.rpc("actualizar_mi_nombre", { p_nombre: nombreProveedor.trim() });
    }
  }

  return NextResponse.redirect(new URL(destino, url.origin));
}
