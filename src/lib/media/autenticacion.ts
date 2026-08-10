/**
 * BOOKEA MEDIA — quién llama a /api/media/*, y desde dónde.
 *
 * ⚠️ Server-only: usa los clientes de Supabase del servidor.
 *
 * ── POR QUÉ ESTE HELPER NO SE PARECE AL RESTO DE LAS RUTAS ───────────
 *
 * Las diez rutas de `/api` que ya existen usan
 * `Access-Control-Allow-Origin: "*"` y ninguna valida `Origin`. Eso
 * funciona porque todas autentican SOLO con `Authorization: Bearer`
 * (son la puerta de la app móvil): una cabecera que un formulario
 * cross-site no puede poner sin preflight.
 *
 * Estos endpoints tienen que atender también a la web, que autentica
 * con COOKIES. Y una cookie sí viaja sola en una petición cross-site:
 * ahí aparece el CSRF. Por eso acá:
 *
 *   · `*` queda prohibido — el navegador ni siquiera lo permite junto
 *     con credenciales;
 *   · con cookies se EXIGE un `Origin` de la lista;
 *   · la lista sale de configuración y en producción FALLA CERRADA.
 *
 * Copiar el patrón de las otras rutas habría sido lo cómodo y lo
 * inseguro.
 */

import "server-only";

import { createClient as createClienteCookies } from "@/lib/supabase/server";
import { sesionDesdeBearer } from "@/lib/supabase/bearer";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Actor = {
  usuarioId: string;
  /** El cliente que actúa COMO el usuario: la RLS lo ve como él. */
  supabase: SupabaseClient;
  via: "bearer" | "cookie";
};

export type MotivoRechazo =
  | "sin-credencial"
  | "bearer-invalido"
  | "origen-no-permitido"
  | "origen-ausente"
  | "sin-configuracion";

export type Autenticacion =
  | { ok: true; actor: Actor }
  | { ok: false; motivo: MotivoRechazo; http: 401 | 403 | 503; mensaje: string };

// ------------------------------------------------------------
// Orígenes permitidos
// ------------------------------------------------------------

/**
 * De dónde salen los orígenes válidos.
 *
 * `MEDIA_ALLOWED_ORIGINS` (server-only, separada por comas) es la
 * fuente. Si falta, se cae a `NEXT_PUBLIC_SITE_URL` y su variante
 * `www`, que es lo único que el repo ya tiene configurado.
 *
 * `localhost` SOLO fuera de producción: agregarlo siempre convertiría
 * cualquier página local de un atacante en un origen de confianza.
 *
 * Y si en producción no queda ninguno, se FALLA CERRADA con un 503. Un
 * default permisivo acá es una puerta abierta esperando a que alguien
 * se olvide de una variable.
 */
export function origenesPermitidos(entorno: NodeJS.ProcessEnv = process.env): string[] {
  const explicitos = (entorno.MEDIA_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  const lista = [...explicitos];

  // El default de sitio se deriva de `NEXT_PUBLIC_SITE_URL`. OJO: NO se
  // usa un literal como último recurso.
  //
  // La primera versión hacía `?? "https://bookea.lat"`, y con eso la
  // lista NUNCA podía quedar vacía — o sea que el "falla cerrada" de
  // producción era inalcanzable: un despliegue sin ninguna variable
  // habría autenticado por cookies contra un origen adivinado. Lo
  // encontró el test que pretendía comprobar justamente eso.
  const sitio = (entorno.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (lista.length === 0 && sitio) {
    lista.push(sitio);
    // La variante con y sin `www`: las dos responden y las dos son
    // nuestras (medido: bookea.lat y www.bookea.lat devuelven 200).
    try {
      const u = new URL(sitio);
      const host = u.host.startsWith("www.") ? u.host.slice(4) : `www.${u.host}`;
      lista.push(`${u.protocol}//${host}`);
    } catch {
      // Un NEXT_PUBLIC_SITE_URL mal formado no agrega variantes.
    }
  }

  if (entorno.NODE_ENV !== "production") {
    lista.push("http://localhost:3000");
    // `expo start --web` sirve en 8081.
    lista.push("http://localhost:8081");
  }

  return [...new Set(lista)];
}

export function origenPermitido(
  origen: string | null,
  entorno: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!origen) return false;
  return origenesPermitidos(entorno).includes(origen.replace(/\/+$/, ""));
}

/**
 * Las cabeceras CORS de la respuesta.
 *
 * Nunca `*`: es incompatible con credenciales y además convertiría en
 * pública una respuesta que depende de quién mira. `Vary: Origin` es
 * obligatorio — sin él, una caché intermedia puede servirle a un origen
 * la respuesta que se armó para otro.
 */
export function cabecerasCors(
  origen: string | null,
  entorno: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const base: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
  };
  if (origen && origenPermitido(origen, entorno)) {
    base["Access-Control-Allow-Origin"] = origen.replace(/\/+$/, "");
    base["Access-Control-Allow-Credentials"] = "true";
  }
  return base;
}

// ------------------------------------------------------------
// Autenticación
// ------------------------------------------------------------

export type DependenciasAuth = {
  entorno?: NodeJS.ProcessEnv;
  /** Inyectables para probar sin Supabase. */
  desdeBearer?: typeof sesionDesdeBearer;
  desdeCookies?: typeof createClienteCookies;
};

/**
 * Autentica una petición mutable de /api/media/*.
 *
 * ── LA REGLA CUANDO LLEGAN LAS DOS CREDENCIALES ──────────────────────
 *
 *   solo bearer válido   → entra. No hace falta validar Origin: una
 *                          cabecera Authorization no se puede mandar
 *                          cross-site sin que el preflight lo autorice.
 *   solo cookies         → entra, PERO exigiendo Origin de la lista.
 *   bearer + cookies     → gana el BEARER. Es el mecanismo con
 *                          intención explícita; una cookie ambiental no
 *                          debería decidir por una petición que ya se
 *                          identificó.
 *   bearer INVÁLIDO      → 401 y punto. NO se cae a la cookie: un
 *                          bearer roto es un error del cliente, no una
 *                          invitación a probar otra credencial. Sin
 *                          esto, un token vencido dejaría pasar la
 *                          petición con la sesión del navegador, que es
 *                          exactamente el fallback silencioso que hay
 *                          que evitar.
 */
export async function autenticarMedia(
  request: Request,
  deps: DependenciasAuth = {},
): Promise<Autenticacion> {
  const entorno = deps.entorno ?? process.env;
  const desdeBearer = deps.desdeBearer ?? sesionDesdeBearer;
  const desdeCookies = deps.desdeCookies ?? createClienteCookies;

  if (entorno.NODE_ENV === "production" && origenesPermitidos(entorno).length === 0) {
    return {
      ok: false,
      motivo: "sin-configuracion",
      http: 503,
      mensaje: "No se puede subir ahora mismo.",
    };
  }

  const traeBearer = (request.headers.get("authorization") ?? "").trim().length > 0;

  if (traeBearer) {
    const sesion = await desdeBearer(request);
    if (!sesion) {
      // Sin fallback a la cookie. A propósito.
      return {
        ok: false,
        motivo: "bearer-invalido",
        http: 401,
        mensaje: "Entrá con tu cuenta.",
      };
    }
    return {
      ok: true,
      actor: { usuarioId: sesion.usuarioId, supabase: sesion.supabase, via: "bearer" },
    };
  }

  // Camino de la web: cookies. Acá sí hay que defenderse del CSRF.
  const origen = request.headers.get("origin");
  if (!origen) {
    return {
      ok: false,
      motivo: "origen-ausente",
      http: 403,
      mensaje: "No se pudo verificar el origen de la petición.",
    };
  }
  if (!origenPermitido(origen, entorno)) {
    return {
      ok: false,
      motivo: "origen-no-permitido",
      http: 403,
      mensaje: "No se pudo verificar el origen de la petición.",
    };
  }

  const supabase = await desdeCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, motivo: "sin-credencial", http: 401, mensaje: "Entrá con tu cuenta." };
  }

  return {
    ok: true,
    actor: { usuarioId: user.id, supabase: supabase as unknown as SupabaseClient, via: "cookie" },
  };
}
