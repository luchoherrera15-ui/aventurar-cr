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

  // El pase pertenece a un miembro, y de ahí sale su identidad. Se
  // regenera con esos datos, no con los de quien pide.
  //
  // `select *` y no una lista de columnas: `persona_id` es de la 0138 y
  // pedirla por nombre haría fallar la consulta entera en una base que
  // todavía no la corrió — con el síntoma "el pase no se refresca", que
  // no se ve en ningún lado hasta que un cliente reclama sus sellos.
  const { data: miembro } = await db
    .from("miembros")
    .select("*")
    .eq("id", pase.miembroId)
    .maybeSingle();

  const fila = (miembro ?? {}) as Record<string, unknown>;
  const clienteId = typeof fila.cliente_id === "string" ? fila.cliente_id : null;
  const personaId = typeof fila.persona_id === "string" ? fila.persona_id : null;

  // ANTES ACÁ HABÍA `if (!miembro?.cliente_id) return 404`, y era el
  // cabo suelto del alta por QR: quien se afilió con su WhatsApp y su
  // correo tiene la membresía a nombre de su PERSONA y `cliente_id` en
  // null. Su iPhone pedía el pase actualizado, se llevaba un 404, y el
  // sello que le acababan de poner en el mostrador no aparecía nunca —
  // sin un error visible en ningún lado, ni para él ni para el negocio.
  if (!personaId && !clienteId) return new NextResponse(null, { status: 404 });

  const resultado = await generarPaseDeLealtad({
    ranchoId: pase.ranchoId,
    personaId,
    clienteId,
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
