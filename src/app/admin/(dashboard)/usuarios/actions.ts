"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient, FALTA_SERVICE_KEY } from "@/lib/supabase/admin";

export type NuevoUsuarioState = { error?: string; ok?: string } | undefined;

export async function crearUsuario(
  _prevState: NuevoUsuarioState,
  formData: FormData,
): Promise<NuevoUsuarioState> {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const nombre = String(formData.get("nombre") || "").trim();

  if (!email || password.length < 6) {
    return {
      error: "Hace falta un correo y una contraseña de al menos 6 caracteres.",
    };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (error) {
    if (/already/i.test(error.message)) {
      return { error: "Ya existe una cuenta con ese correo." };
    }
    return { error: "No se pudo crear la cuenta: " + error.message };
  }

  revalidatePath("/admin/usuarios");
  return { ok: `Cuenta creada para ${email}.` };
}

export async function cambiarRol(id: string, rol: "admin" | "dueno_rancho") {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase.from("perfiles").update({ rol }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}
