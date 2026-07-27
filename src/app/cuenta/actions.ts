"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CuentaAuthState =
  | { error?: string; needsConfirmation?: boolean }
  | undefined;

export async function iniciarSesionCuenta(
  _prevState: CuentaAuthState,
  formData: FormData,
): Promise<CuentaAuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/cuenta");
}

export async function registrarCuenta(
  _prevState: CuentaAuthState,
  formData: FormData,
): Promise<CuentaAuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const nombre = String(formData.get("nombre") || "").trim();

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const supabase = await createClient();
  // Siempre queda como 'cliente' — nunca como dueño de negocio, incluso
  // si después publica uno (eso lo decide el alta en /publicar, no el
  // registro). Mismo criterio que ya usa la app móvil.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre: nombre || null, rol: "cliente" } },
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return {
        error: "Ya existe una cuenta con ese correo. Iniciá sesión en su lugar.",
      };
    }
    return { error: "No se pudo crear la cuenta: " + error.message };
  }

  if (!data.session) return { needsConfirmation: true };
  redirect("/cuenta");
}

export async function cerrarSesionCuenta() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/cuenta");
}
