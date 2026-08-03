import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// NOTA: en esta versión de Next.js el archivo "middleware.ts" pasó a
// llamarse "proxy.ts" (mismo propósito: código que corre antes de que
// se renderice la página). Acá lo usamos para dos cosas: 1) mantener la
// sesión de Supabase renovada, y 2) exigir login para entrar a /admin.
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /**
   * Redirige SIN perder las cookies que Supabase acaba de escribir.
   *
   * Al renovar la sesión, Supabase entrega un refresh token nuevo e
   * invalida el anterior. Esas cookies se escriben en `response`, así que
   * devolver un `NextResponse.redirect()` recién creado las tiraba a la
   * basura: el navegador se quedaba con el token viejo, que ya no sirve, y
   * a la vuelta siguiente la sesión aparecía cerrada. Por eso hay que
   * copiarlas a la respuesta del redirect.
   */
  function redirigir(destino: string) {
    const salida = NextResponse.redirect(new URL(destino, request.url));
    response.cookies.getAll().forEach((cookie) => salida.cookies.set(cookie));
    return salida;
  }

  // Si Supabase no contesta (corte de red, servicio caído) no cerramos la
  // sesión de nadie: se deja pasar y la propia página vuelve a verificar
  // antes de mostrar algo privado.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return response;
  }

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";
  const isMiRanchoRoute =
    path.startsWith("/mi-negocio") &&
    path !== "/mi-negocio/login" &&
    path !== "/mi-negocio/registro";

  if (isAdminRoute) {
    if (!user) return redirigir("/admin/login");

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    if (perfil?.rol !== "admin") return redirigir("/admin/login");
  }

  if (isMiRanchoRoute && !user) {
    return redirigir("/mi-negocio/login");
  }

  // Con la sesión abierta no tiene sentido volver a las pantallas de login.
  if (user && (path === "/mi-negocio/login" || path === "/mi-negocio/registro")) {
    return redirigir("/mi-negocio");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
