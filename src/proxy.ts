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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";
  const isMiRanchoRoute =
    path.startsWith("/mi-rancho") &&
    path !== "/mi-rancho/login" &&
    path !== "/mi-rancho/registro";

  if (isAdminRoute) {
    if (!user) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol")
      .eq("id", user.id)
      .single();
    if (perfil?.rol !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (isMiRanchoRoute && !user) {
    return NextResponse.redirect(new URL("/mi-rancho/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
