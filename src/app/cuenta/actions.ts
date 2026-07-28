"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El inicio de sesión y el registro viven en el cliente
// (FormularioCodigoAcceso): sin contraseñas, con código al correo.
// Acá solo queda lo que sí necesita correr en el servidor.

export async function cerrarSesionCuenta() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/cuenta");
}
