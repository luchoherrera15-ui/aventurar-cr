import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autenticarPase } from "@/lib/wallet/servicio";

/**
 * Alta y baja de un teléfono para recibir actualizaciones de un pase.
 *
 * Lo llama iOS solo, apenas el cliente agrega la tarjeta al Wallet, y
 * de nuevo cuando la borra. No hay sesión de usuario: la credencial es
 * la cabecera `Authorization: ApplePass <token>` del propio pase.
 *
 * Ruta exacta que exige Apple (se arma pegándole `/v1/...` al
 * `webServiceURL` que declara el pase):
 *   /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeId}/{serial}
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = {
  params: Promise<{ deviceId: string; passTypeId: string; serial: string }>;
};

export async function POST(pedido: Request, { params }: Contexto) {
  const { deviceId, passTypeId, serial } = await params;

  const pase = await autenticarPase(pedido, serial);
  // 401 y no 404: es lo que Apple espera cuando el token no cuadra, y
  // no delata si el serial existe.
  if (!pase) return new NextResponse(null, { status: 401 });

  const db = createAdminClient();
  if (!db) return new NextResponse(null, { status: 500 });

  let pushToken = "";
  try {
    const cuerpo = (await pedido.json()) as { pushToken?: string };
    pushToken = (cuerpo.pushToken ?? "").trim();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!pushToken) return new NextResponse(null, { status: 400 });

  const { data: yaEstaba } = await db
    .from("registros_dispositivo")
    .select("device_library_id")
    .eq("device_library_id", deviceId)
    .eq("serial_number", serial)
    .maybeSingle();

  const { error } = await db.from("registros_dispositivo").upsert(
    {
      device_library_id: deviceId,
      push_token: pushToken,
      pass_type_id: passTypeId,
      serial_number: serial,
    },
    { onConflict: "device_library_id,serial_number" },
  );

  if (error) return new NextResponse(null, { status: 500 });

  // 201 = alta nueva, 200 = ya estaba. Apple distingue los dos y con el
  // código equivocado reintenta el registro cada vez que abre el pase.
  return new NextResponse(null, { status: yaEstaba ? 200 : 201 });
}

export async function DELETE(pedido: Request, { params }: Contexto) {
  const { deviceId, serial } = await params;

  const pase = await autenticarPase(pedido, serial);
  if (!pase) return new NextResponse(null, { status: 401 });

  const db = createAdminClient();
  if (!db) return new NextResponse(null, { status: 500 });

  await db
    .from("registros_dispositivo")
    .delete()
    .eq("device_library_id", deviceId)
    .eq("serial_number", serial);

  return new NextResponse(null, { status: 200 });
}
