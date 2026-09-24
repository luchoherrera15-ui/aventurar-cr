import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prefijoParaHost } from "./dominios";

/**
 * La sesión vista desde CELEBRAR. Es la MISMA identidad de Bookea
 * (Supabase Auth, tabla `perfiles`): no hay una segunda cuenta. Lo que
 * cambia es el envoltorio: acá nadie sabe de ranchos ni de reservas.
 *
 * `getUser()` y no `getSession()`: valida el token contra Supabase en
 * vez de creerle a la cookie. Cuesta un viaje de red por petición del
 * panel — aceptable, porque el proxy ya deja pasar sin tocar la red a
 * quien no trae cookie, y el panel es lo único que lo llama.
 */
export type SesionCelebrar = {
  id: string;
  email: string | null;
  nombre: string | null;
  fotoUrl: string | null;
};

export const sesionCelebrar = cache(async (): Promise<SesionCelebrar | null> => {
  const supabase = await createClient();
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return null;
  }
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", user.id)
    .maybeSingle();

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre =
    [perfil?.nombre, meta.nombre, meta.full_name, meta.name].find(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    ) ?? null;
  const foto =
    [meta.avatar_url, meta.picture].find(
      (v): v is string => typeof v === "string" && v.startsWith("https://"),
    ) ?? null;

  return {
    id: user.id,
    email: user.email ?? null,
    nombre: nombre?.trim() ?? null,
    fotoUrl: foto,
  };
});

/** El primer nombre, para saludar («Hola, Sofía»). */
export function primerNombre(nombre: string | null): string | null {
  if (!nombre) return null;
  const primero = nombre.trim().split(/\s+/)[0];
  return primero || null;
}

/**
 * El prefijo de rutas para ESTA petición: "" si entró por celebrar.lat,
 * "/celebrar" si entró por Bookea. Lo leen los layouts para armar los
 * links y los `redirect()`; leerlo vuelve dinámica la ruta, así que las
 * páginas que quieran ser estáticas (la invitación pública, Fase 3) no
 * deben colgar de un layout que lo use.
 */
export const prefijoDeLaPeticion = cache(async (): Promise<string> => {
  const h = await headers();
  return prefijoParaHost(h.get("host"));
});

/**
 * El origen (esquema + host) de ESTA petición, para validar rutas de
 * vuelta con `rutaInternaSegura`. Detrás de Vercel el esquema viene en
 * `x-forwarded-proto`; en local es http.
 */
export const origenDeLaPeticion = cache(async (): Promise<string> => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
});

/**
 * ¿Quien mira es del equipo de CELEBRAR? La misma marca que el admin de
 * Bookea (`perfiles.rol = 'admin'`, la que lee `is_admin()` en la base):
 * las RPC de administración devuelven vacío para cualquier otra persona,
 * así que esto solo decide si se DIBUJA la sección.
 */
export const esAdminCelebrar = cache(async (): Promise<boolean> => {
  const sesion = await sesionCelebrar();
  if (!sesion) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("perfiles").select("rol").eq("id", sesion.id).maybeSingle();
  return data?.rol === "admin";
});
