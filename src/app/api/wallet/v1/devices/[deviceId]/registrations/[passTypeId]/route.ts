import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "¿Qué pases míos cambiaron?" — el teléfono pregunta esto al recibir
 * el aviso push, y también por su cuenta cada tanto.
 *
 * Devuelve los seriales que cambiaron después de `passesUpdatedSince`,
 * y un `lastUpdated` que el teléfono guarda para la próxima consulta.
 *
 * Esta ruta NO lleva `Authorization`: Apple no manda el token acá
 * porque la pregunta es por dispositivo, no por pase. Lo que la
 * protege es que `deviceLibraryIdentifier` es un identificador opaco
 * que solo conoce ese teléfono, y que la respuesta son seriales — que
 * sin su auth_token no sirven para bajar ningún pase.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ deviceId: string; passTypeId: string }> },
) {
  const { deviceId, passTypeId } = await params;
  const desde = new URL(pedido.url).searchParams.get("passesUpdatedSince");

  const db = createAdminClient();
  if (!db) return new NextResponse(null, { status: 500 });

  const { data: registros } = await db
    .from("registros_dispositivo")
    .select("serial_number")
    .eq("device_library_id", deviceId)
    .eq("pass_type_id", passTypeId);

  const seriales = (registros ?? []).map((r) => r.serial_number as string);
  // 204 y no un array vacío: Apple lo trata como "este dispositivo ya
  // no tiene nada acá" y deja de preguntar.
  if (seriales.length === 0) return new NextResponse(null, { status: 204 });

  let consulta = db
    .from("pases_wallet")
    .select("serial_number, actualizado_en")
    .in("serial_number", seriales);

  // `passesUpdatedSince` es el tag que devolvimos la vez pasada. Se usa
  // `gt` y no `gte` para no reenviar el mismo cambio en bucle.
  if (desde) consulta = consulta.gt("actualizado_en", desde);

  const { data: pases } = await consulta;
  const cambiados = pases ?? [];
  if (cambiados.length === 0) return new NextResponse(null, { status: 204 });

  const ultimo = cambiados
    .map((p) => String(p.actualizado_en))
    .sort()
    .at(-1)!;

  return NextResponse.json(
    {
      serialNumbers: cambiados.map((p) => p.serial_number as string),
      lastUpdated: ultimo,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
