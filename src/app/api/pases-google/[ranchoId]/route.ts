import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarPaseGoogle } from "@/lib/wallet/google";

/**
 * "Guardame la tarjeta en Google Wallet" — resuelve la identidad con
 * la sesión (nunca por parámetro, igual que el .pkpass de Apple) y
 * redirige al link de guardado que firma nuestra cuenta de servicio.
 * El teléfono abre Google Wallet con la tarjeta lista para agregar.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _pedido: Request,
  { params }: { params: Promise<{ ranchoId: string }> },
) {
  const { ranchoId } = await params;
  if (!UUID_REGEX.test(ranchoId)) {
    return NextResponse.json({ error: "Negocio inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Iniciá sesión para agregar tu tarjeta a Google Wallet." },
      { status: 401 },
    );
  }

  const resultado = await generarPaseGoogle({ ranchoId, clienteId: user.id });
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.motivo }, { status: 409 });
  }

  return NextResponse.redirect(resultado.url, 302);
}
