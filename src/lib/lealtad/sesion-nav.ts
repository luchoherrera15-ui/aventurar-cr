import { createClient } from "@/lib/supabase/server";

/**
 * QUIÉN ESTÁ MIRANDO /lealtad — para la esquina derecha del nav.
 *
 * El pedido del dueño (ago 2026): que arriba diga el NOMBRE de la
 * cuenta cuando hay sesión («Luis Herrera») y «Ingresar» cuando no —
 * antes decía siempre «Mi perfil»/«Entrar», que no distingue una
 * cuenta de otra cuando alguien maneja varias.
 *
 * El nombre se resuelve con el MISMO criterio que `AccionesSesion` (el
 * menú de sesión del resto del sitio): primero la tabla `perfiles`, y
 * si ahí no hay, la metadata que dejó el proveedor de login. Dos
 * lecturas distintas del mismo dato darían dos nombres distintos para
 * la misma persona.
 *
 * Vive en un helper y no en cada página porque son CUATRO las que
 * montan `NavLealtad` (landing, industrias, ficha de industria y
 * developers): copiado, el día que cambie el criterio quedarían tres
 * copias viejas.
 */
export async function sesionDelNavLealtad(): Promise<{
  logueado: boolean;
  nombre: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { logueado: false, nombre: null };

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

  return { logueado: true, nombre: nombre?.trim() ?? null };
}
