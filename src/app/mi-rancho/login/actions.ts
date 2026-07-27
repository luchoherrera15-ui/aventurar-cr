"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

export async function loginDueno(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (/email.*not.*confirmed/i.test(error.message)) {
      return {
        error:
          "Tu correo todavía no está confirmado. Revisá la bandeja de entrada (y spam) del correo de confirmación, o pedile a un admin que te reinicie la contraseña desde el panel.",
      };
    }
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/mi-rancho");
}
