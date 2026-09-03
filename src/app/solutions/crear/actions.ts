"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarSlugSolutions } from "@/lib/solutions/slug";
import { TOPES } from "@/lib/solutions/tipos";

/**
 * EL ALTA DE UN NEGOCIO DE SOLUTIONS.
 *
 * Requiere sesión (la cuenta de Bookea, la misma para todo). Crea la
 * fila con lo mínimo —nombre y slug— y manda al panel, donde se arma
 * el resto. Sin tope de negocios por cuenta a propósito: un dueño con
 * dos locales tiene dos cartas y dos QR.
 */
export async function crearNegocioSolutions(
  _estado: { error: string | null } | null,
  form: FormData,
): Promise<{ error: string | null }> {
  const nombre = String(form.get("nombre") ?? "").trim().slice(0, TOPES.nombre);
  if (nombre.length < 2) return { error: "Escribí el nombre de tu negocio." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cuenta?volver=solutions");

  const admin = createAdminClient();
  if (!admin) return { error: "Falta la llave de servicio en el entorno." };

  const slug = await generarSlugSolutions(admin, nombre);
  const { data, error } = await admin
    .from("solutions_negocios")
    .insert({ owner_id: user.id, nombre, slug })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo crear el negocio. Probá de nuevo." };

  redirect(`/solutions/panel/${data.id}?nuevo=1`);
}
