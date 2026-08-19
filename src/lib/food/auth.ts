import { createClient } from "@/lib/supabase/server";

/**
 * Acceso al panel de un negocio de FOOD: el dueño (owner_id) o un
 * admin. FOOD no tiene colaboradores en el V1 — a diferencia de
 * `verificarAccesoRancho`, que sí distingue dueño/colaborador/admin
 * (0116), acá no existe todavía esa tabla intermedia. Se agrega el día
 * que un restaurante pida sumar personal a su panel.
 */
export async function verificarAccesoNegocioFood(negocioId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, ok: false as const };

  const [{ data: negocio }, { data: perfil }] = await Promise.all([
    supabase.from("food_businesses").select("owner_id").eq("id", negocioId).maybeSingle(),
    supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle(),
  ]);

  const esAdmin = perfil?.rol === "admin";
  const ok = !!negocio && (negocio.owner_id === user.id || esAdmin);
  return { supabase, user, ok };
}

/** El primer negocio de FOOD de la persona logueada, o null. */
export async function miNegocioFood() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("food_businesses")
    .select("id, nombre, slug, activo")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}
