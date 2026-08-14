import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarPaseDeLealtad } from "@/lib/wallet/generar";
import { identidadDeQuienPide, NOMBRE_COOKIE_PERSONA } from "@/lib/lealtad/personas";
import { pantallaDeProblema, UUID_REGEX } from "../problema";

/**
 * "Dame mi tarjeta de lealtad de este negocio" — devuelve un .pkpass
 * firmado, listo para agregar a Apple Wallet.
 *
 * La identidad se resuelve ACÁ y NUNCA llega por parámetro: si llegara,
 * cualquiera podría bajarse la tarjeta de otro y ver su saldo. Sale de
 * dos lugares, los dos del navegador y ninguno adivinable:
 *
 *   · la cookie httpOnly de `sesiones_persona` (0138), que es lo que
 *     tiene quien se afilió escaneando el póster sin abrir cuenta;
 *   · la sesión de Supabase, para quien además tiene cuenta.
 *
 * El generador corre después con la llave de servicio, porque
 * `pases_wallet` no tiene política de escritura para clientes (0060) —
 * pero solo se lo invoca con la identidad ya verificada.
 */

// Firmar y dibujar tres tiras de sellos no cabe en el runtime de edge.
export const runtime = "nodejs";
// El pase depende del saldo del cliente: nunca se cachea.
export const dynamic = "force-dynamic";

export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ ranchoId: string }> },
) {
  const { ranchoId } = await params;
  if (!UUID_REGEX.test(ranchoId)) {
    return pantallaDeProblema(pedido, ranchoId, "negocio_desconocido");
  }

  const db = createAdminClient();
  if (!db) return pantallaDeProblema(pedido, ranchoId, "sin_conexion");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const jar = await cookies();
  const identidad = await identidadDeQuienPide(db, {
    token: jar.get(NOMBRE_COOKIE_PERSONA)?.value ?? null,
    clienteId: user?.id ?? null,
  });

  const resultado = await generarPaseDeLealtad({
    ranchoId,
    ...identidad,
    ahora: new Date(),
  });

  if (!resultado.ok) {
    // NUNCA un JSON crudo: el botón es un `<a href>` y el navegador
    // NAVEGA, así que un `NextResponse.json(..., {status:409})` le
    // pintaba al cliente, en pantalla blanca y en jerga de máquina,
    // «{"error":"El programa de este negocio está lleno por ahora"}».
    console.warn(`[pases] ${ranchoId} → ${resultado.codigo}: ${resultado.motivo}`);
    return pantallaDeProblema(pedido, ranchoId, resultado.codigo);
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
