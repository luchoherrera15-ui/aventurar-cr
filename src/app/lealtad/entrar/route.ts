import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * A dónde cae alguien después de entrar por `/lealtad/login`.
 *
 * Antes este desvío adivinaba: un negocio → derecho a su pestaña,
 * varios → al panel general. Desde que existe el dashboard de lealtad
 * (/lealtad/panel) ya no hay nada que adivinar: TODOS aterrizan en
 * "Mis negocios", que resuelve solo cada caso — cero negocios (tarjeta
 * de crear), sin activar (se ve el estado), varios (se elige).
 *
 * Sigue existiendo como route handler y no como redirect en el login
 * porque es el único punto que decide el aterrizaje: si mañana cambia,
 * se cambia acá y todos los caminos (correo, Google, Facebook,
 * /cuenta/ir) lo heredan.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  const base = new URL(pedido.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/lealtad/login", base));
  return NextResponse.redirect(new URL("/lealtad/panel", base));
}
