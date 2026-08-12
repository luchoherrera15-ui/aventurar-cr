import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autenticarPase } from "@/lib/wallet/servicio";
import { generarPaseDeLealtad } from "@/lib/wallet/generar";

/**
 * "Dame el pase actualizado" — el teléfono llama acá después de saber
 * que su tarjeta cambió, y reemplaza la que tiene guardada.
 *
 * Es el mismo generador del endpoint público, pero la identidad NO sale
 * de una sesión: sale del `auth_token` del propio pase. Acá no hay
 * usuario logueado, el que llama es iOS.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ serial: string }> },
) {
  const { serial } = await params;

  const pase = await autenticarPase(pedido, serial);
  if (!pase) return new NextResponse(null, { status: 401 });

  const db = createAdminClient();
  if (!db) return new NextResponse(null, { status: 500 });

  // El pase pertenece a un miembro, y de ahí sale su cuenta. Se
  // regenera con esos datos, no con los de quien pide.
  const { data: miembro } = await db
    .from("miembros")
    .select("cliente_id")
    .eq("id", pase.miembroId)
    .maybeSingle();

  if (!miembro?.cliente_id) return new NextResponse(null, { status: 404 });

  const resultado = await generarPaseDeLealtad({
    ranchoId: pase.ranchoId,
    clienteId: miembro.cliente_id as string,
    ahora: new Date(),
  });

  if (!resultado.ok) return new NextResponse(null, { status: 500 });

  return new NextResponse(new Uint8Array(resultado.pkpass), {
    headers: {
      "content-type": "application/vnd.apple.pkpass",
      // `last-modified` es lo que el teléfono compara para decidir si
      // vale la pena reemplazar el pase que ya tiene.
      "last-modified": new Date().toUTCString(),
      "cache-control": "no-store",
    },
  });
}
