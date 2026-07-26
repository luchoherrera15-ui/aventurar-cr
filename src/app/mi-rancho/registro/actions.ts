"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RegistroState =
  | { error?: string; needsConfirmation?: boolean }
  | undefined;

export async function registrarDueno(
  _prevState: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const nombre = String(formData.get("nombre") || "").trim();

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return {
        error:
          "Ya existe una cuenta con ese correo. Iniciá sesión en su lugar.",
      };
    }
    return { error: "No se pudo crear la cuenta: " + error.message };
  }

  if (!data.session) {
    return { needsConfirmation: true };
  }

  redirect("/mi-rancho/nuevo");
}
