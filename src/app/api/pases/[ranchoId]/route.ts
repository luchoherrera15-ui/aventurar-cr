import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarPaseDeLealtad } from "@/lib/wallet/generar";

/**
 * "Dame mi tarjeta de lealtad de este negocio" — devuelve un .pkpass
 * firmado, listo para agregar a Apple Wallet.
 *
 * La identidad se resuelve ACÁ, con la sesión de quien pide: el pase
 * es siempre del usuario autenticado y el id del cliente NUNCA llega
 * por parámetro. Si llegara, cualquiera podría bajarse la tarjeta de
 * otro y ver su saldo.
 *
 * El generador corre después con la llave de servicio, porque
 * `pases_wallet` no tiene política de escritura para clientes (0060) —
 * pero solo se lo invoca con el id ya verificado.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Firmar y dibujar tres tiras de sellos no cabe en el runtime de edge.
export const runtime = "nodejs";
// El pase depende del saldo del cliente: nunca se cachea.
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
      { error: "Iniciá sesión para agregar tu tarjeta a Wallet." },
      { status: 401 },
    );
  }

  const resultado = await generarPaseDeLealtad({
    ranchoId,
    clienteId: user.id,
    ahora: new Date(),
  });

  if (!resultado.ok) {
    // Los motivos ya vienen en español y listos para mostrar.
    return NextResponse.json({ error: resultado.motivo }, { status: 409 });
  }

  return new NextResponse(new Uint8Array(resultado.pkpass), {
    headers: {
      // Este tipo MIME es lo que hace que iOS ofrezca "Agregar a
      // Wallet" en vez de descargar un archivo que nadie sabe abrir.
      "content-type": "application/vnd.apple.pkpass",
      "content-disposition": `attachment; filename="tarjeta-${resultado.serialNumber}.pkpass"`,
      "cache-control": "no-store",
    },
  });
}
