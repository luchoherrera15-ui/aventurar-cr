import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tieneNegocioPropio } from "@/lib/negocio-propio";

/**
 * A dónde cae alguien después de entrar por `/lealtad/login` O por
 * `/lealtad/ingresar` (la puerta de cliente de `NavLealtad`).
 *
 * Antes este desvío adivinaba: un negocio → derecho a su pestaña,
 * varios → al panel general. Desde que existe el dashboard de lealtad
 * (/lealtad/panel) ya no había nada que adivinar ahí — TODOS aterrizan
 * en "Mis negocios", que resuelve solo cada caso — cero negocios
 * (tarjeta de crear), sin activar (se ve el estado), varios (se elige).
 *
 * Pero desde que `/lealtad/ingresar` manda acá TAMBIÉN clientes sin
 * ningún negocio propio, "mandar siempre al panel" dejó de alcanzar:
 * un cliente que solo junta sellos en negocios ajenos caía en la
 * pantalla de "creá tu primera tarjeta", que no es lo que vino a
 * buscar. `tieneNegocioPropio()` (dueño o colaborador, ya cacheado y
 * usado por el header) es el mismo criterio con el que el resto del
 * sitio distingue "tiene panel que administrar" de "solo tiene
 * cuenta": con negocio, al panel; sin ninguno, a sus tarjetas de
 * cliente (`/cuenta/lealtad`).
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

  const esNegocio = await tieneNegocioPropio();
  return NextResponse.redirect(
    new URL(esNegocio ? "/lealtad/panel" : "/cuenta/lealtad", base),
  );
}
