import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// NOTA: en esta versión de Next.js el archivo "middleware.ts" pasó a
// llamarse "proxy.ts" (mismo propósito: código que corre antes de que
// se renderice la página). Acá lo usamos para tres cosas: 1) mantener
// la sesión de Supabase renovada, 2) exigir login para entrar a
// /admin, y 3) servir food.bookea.lat desde el mismo despliegue.

/**
 * FOOD.BOOKEA.LAT — mismo proyecto de Vercel, dominio propio.
 *
 * Antes de cualquier otra cosa: si el host es food.bookea.lat, se
 * reescribe la ruta con el prefijo /food — food.bookea.lat/ sirve
 * src/app/food/page.tsx y food.bookea.lat/demo sirve
 * src/app/food/demo/page.tsx, sin duplicar ni un archivo.
 *
 * POR QUÉ ACÁ Y NO EN next.config.ts: los rewrites de ahí corren
 * DESPUÉS del sistema de archivos (afterFiles) — la raíz ya tiene su
 * propio page.tsx real (la portada del marketplace) y ese page.tsx
 * SIEMPRE gana. Ya pasó una vez con un rewrite de "/" que nunca
 * disparaba por esto mismo (ver el comentario grande en
 * next.config.ts). El middleware corre ANTES del sistema de archivos
 * — es la única capa donde este truco funciona de verdad.
 *
 * `NextResponse.rewrite()` es invisible para el navegador: la barra de
 * direcciones se queda en food.bookea.lat/lo-que-sea aunque por dentro
 * Next resuelva contra /food/lo-que-sea.
 *
 * ⚠️ La sesión de Supabase NO se comparte todavía entre bookea.lat y
 * food.bookea.lat (la cookie nace sin `domain` explícito, así que
 * queda pegada al host exacto que la puso). Alguien logueado en el
 * sitio principal tiene que volver a iniciar sesión acá — pendiente
 * para cuando food.bookea.lat maneje reservas reales, no solo el demo.
 */
function esHostFood(host: string): boolean {
  return host.split(":")[0] === "food.bookea.lat";
}

export default async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (esHostFood(host)) {
    const { pathname } = request.nextUrl;
    const yaResuelta =
      pathname.startsWith("/food") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      // /cuenta pasa TAL CUAL: es la pantalla de acceso compartida de
      // todo Bookea y la ficha de un restaurante manda ahí a quien
      // quiere reservar (`/cuenta?volver=food:slug`). Sin esta
      // excepción, food.bookea.lat/cuenta se reescribía a /food/cuenta
      // —que no existe— y el login moría en un 404 (visto en vivo el
      // 2026-08-20). La cookie de sesión ya alcanza al subdominio.
      pathname.startsWith("/cuenta") ||
      /\.[a-z0-9]+$/i.test(pathname); // archivos estáticos: favicon.ico, robots.txt...
    if (!yaResuelta) {
      const url = request.nextUrl.clone();
      url.pathname = `/food${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";
  const isMiRanchoRoute =
    path.startsWith("/mi-negocio") &&
    path !== "/mi-negocio/login" &&
    path !== "/mi-negocio/registro";

  /**
   * ════════════════════════════════════════════════════════════════
   *  SIN COOKIE DE SESIÓN NO SE LLAMA A SUPABASE. NUNCA.
   * ════════════════════════════════════════════════════════════════
   *
   * ⚠️ ESTE ATAJO ES EL ARREGLO DE RENDIMIENTO MÁS GRANDE DEL SITIO.
   *
   * Abajo se llama a `supabase.auth.getUser()`. Ese método NO lee la
   * cookie: manda el token al servidor de auth de Supabase para que lo
   * valide, y espera la respuesta. Es un viaje de ida y vuelta por red
   * ANTES de que empiece a generarse una sola línea de HTML.
   *
   * Y este proxy corre en TODAS las rutas (ver el `matcher` del final).
   * O sea que hasta un visitante anónimo que abre la portada pagaba ese
   * viaje. Medido en producción: TTFB de 430-620 ms en todas las
   * páginas, incluidas las que no tienen nada que ver con la sesión
   * (/lealtad, /invitaciones, /publicar…).
   *
   * Un visitante sin sesión NO TIENE la cookie `sb-…-auth-token`. Sin
   * ella no hay token que renovar ni usuario que dejar pasar, así que la
   * llamada solo puede devolver `null` — pero tarda igual.
   *
   * ── POR QUÉ ESTO NO ABRE UN AGUJERO ─────────────────────────────
   * No se está confiando en la cookie ni leyendo nada de adentro: solo
   * se pregunta si EXISTE. Alguien puede fabricar una cookie con ese
   * nombre y lo único que consigue es que su petición siga el camino
   * largo — el de siempre, con la validación real contra Supabase.
   * Sin cookie, el resultado es EXACTAMENTE el mismo que daba
   * `getUser()`: no hay usuario, y las rutas protegidas mandan al login.
   */
  const hayCookieDeSesion = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

  if (!hayCookieDeSesion) {
    if (isAdminRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (isMiRanchoRoute) {
      return NextResponse.redirect(new URL("/mi-negocio/login", request.url));
    }
    // El camino del 95 % del tráfico: sale sin tocar la red.
    return NextResponse.next({ request });
  }

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

  // `path`, `isAdminRoute` y `isMiRanchoRoute` se calculan arriba, antes
  // del atajo sin cookie — los necesita para saber a dónde mandar a
  // quien entra sin sesión a una ruta protegida.

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
