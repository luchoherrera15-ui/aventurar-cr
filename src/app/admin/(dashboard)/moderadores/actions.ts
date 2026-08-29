"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server actions del panel de moderadores. Un moderador es un usuario
 * YA registrado al que el admin le da el rol: se crea su fila en
 * `agentes_lealtad` (con un código de 4 dígitos generado) y se le pone
 * `perfiles.rol='moderador'`. La comisión NO se fija a mano — sale de
 * la regla por paquete (lib/lealtad/comision-moderador). Pausar le
 * devuelve el rol a 'cliente' (pierde el acceso) pero NO borra su fila.
 */

async function generarCodigo(admin: SupabaseClient): Promise<string | null> {
  for (let i = 0; i < 40; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    const { data } = await admin
      .from("agentes_lealtad")
      .select("id")
      .eq("codigo", c)
      .maybeSingle();
    if (!data) return c;
  }
  return null;
}

export type ResultadoPromo = { error: string | null; aviso: string | null };

export async function promoverModerador(
  _prev: ResultadoPromo | null,
  formData: FormData,
): Promise<ResultadoPromo> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto.", aviso: null };
  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY, aviso: null };

  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  if (!correo) return { error: "Escribí el correo del usuario.", aviso: null };

  const { data: perfil } = await admin
    .from("perfiles")
    .select("id, nombre")
    .eq("email", correo)
    .maybeSingle();
  if (!perfil) {
    return {
      error:
        "No hay ninguna cuenta registrada con ese correo. Primero pedile que se registre en bookea.lat.",
      aviso: null,
    };
  }

  const { data: yaEs } = await admin
    .from("agentes_lealtad")
    .select("id")
    .eq("usuario_id", perfil.id)
    .maybeSingle();
  if (yaEs) return { error: "Esa cuenta ya es moderador.", aviso: null };

  const codigo = await generarCodigo(admin);
  if (!codigo)
    return { error: "No se pudo generar un código libre. Probá otra vez.", aviso: null };

  const nombre = (perfil.nombre as string | null)?.trim() || correo;
  const { error: eIns } = await admin.from("agentes_lealtad").insert({
    usuario_id: perfil.id,
    nombre,
    codigo,
    activo: true,
  });
  if (eIns) return { error: "No se pudo crear el moderador: " + eIns.message, aviso: null };

  await admin.from("perfiles").update({ rol: "moderador" }).eq("id", perfil.id);

  revalidatePath("/admin/moderadores");
  return { error: null, aviso: `Listo. ${nombre} ya es moderador con el código ${codigo}.` };
}

export async function alternarActivo(formData: FormData): Promise<void> {
  const { ok } = await requireAdmin();
  if (!ok) return;
  const admin = createAdminClient();
  if (!admin) return;
  const id = String(formData.get("id") ?? "");
  const activar = String(formData.get("activar") ?? "") === "1";
  if (!id) return;
  const { data: ag } = await admin
    .from("agentes_lealtad")
    .update({ activo: activar })
    .eq("id", id)
    .select("usuario_id")
    .maybeSingle();
  if (ag?.usuario_id) {
    await admin
      .from("perfiles")
      .update({ rol: activar ? "moderador" : "cliente" })
      .eq("id", ag.usuario_id as string);
  }
  revalidatePath("/admin/moderadores");
}
