"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Login de las cuentas DEMO con código fijo (pedido del dueño, para
 * poder testear sin correo): el formulario de acceso detecta un correo
 * *.demo@bookea.lat y, en vez de verificar el OTP de Supabase, llama
 * acá con el código de prueba. El servidor valida el patrón del correo
 * y el código, y entra con la contraseña interna de las cuentas demo —
 * que nunca viaja al navegador.
 *
 * Esto NO abre ninguna cuenta real: el patrón *.demo@bookea.lat está
 * clavado acá (servidor), así que aunque alguien escriba 123456 con
 * otro correo, cae al flujo normal de OTP y no pasa nada. Las cuentas
 * demo solo tienen datos de mentira.
 */

const CODIGO_DEMO = "123456";
// La misma contraseña con la que los seeds crean las cuentas demo
// (scripts/seed-demo-*.mjs). Se puede rotar vía env sin tocar código.
const PASSWORD_DEMO = process.env.DEMO_ACCOUNTS_PASSWORD || "BookeaDemo2026!";

export async function entrarComoDemo(
  email: string,
  codigo: string,
): Promise<{ ok?: true; error?: string }> {
  const limpio = email.trim().toLowerCase();
  if (!/^[a-z0-9._+-]+\.demo@bookea\.lat$/.test(limpio)) {
    return { error: "Esto solo funciona con cuentas demo." };
  }
  if (codigo.trim() !== CODIGO_DEMO) {
    return { error: "Ese código no sirve. Para las cuentas demo es 123456." };
  }

  // El cliente SSR escribe las cookies de sesión en la respuesta — el
  // navegador queda logueado igual que con el OTP normal.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: limpio,
    password: PASSWORD_DEMO,
  });
  if (error) {
    return { error: "No se pudo entrar a la cuenta demo: " + error.message };
  }
  return { ok: true };
}
