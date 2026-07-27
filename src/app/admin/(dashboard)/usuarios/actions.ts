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

export async function cambiarRol(
  id: string,
  rol: "admin" | "dueno_rancho" | "cliente",
) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const { error } = await supabase.from("perfiles").update({ rol }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function cambiarEmail(id: string, email: string) {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  const limpio = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) {
    return { error: "Ese correo no parece válido." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  // email_confirm deja el correo nuevo ya verificado, para que el dueño
  // pueda entrar de una sin tener que abrir un link de confirmación.
  const { error } = await admin.auth.admin.updateUserById(id, {
    email: limpio,
    email_confirm: true,
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: "Ya existe una cuenta con ese correo." };
    }
    return { error: "No se pudo cambiar el correo: " + error.message };
  }

  // El trigger que llena `perfiles` solo corre al crear la cuenta, así que
  // la tabla se actualiza acá o la lista quedaría mostrando el correo viejo.
  const { error: errorPerfil } = await supabase
    .from("perfiles")
    .update({ email: limpio })
    .eq("id", id);

  if (errorPerfil) {
    return {
      error:
        "El correo de acceso se cambió, pero no se pudo actualizar la lista: " +
        errorPerfil.message,
    };
  }

  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function cambiarPassword(id: string, password: string) {
  const { ok } = await requireAdmin();
  if (!ok) return { error: "No tenés permiso para esto." };

  if (password.length < 6) {
    return { error: "La contraseña necesita al menos 6 caracteres." };
  }

  const admin = createAdminClient();
  if (!admin) return { error: FALTA_SERVICE_KEY };

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) {
    return { error: "No se pudo cambiar la contraseña: " + error.message };
  }

  return { error: null };
}
