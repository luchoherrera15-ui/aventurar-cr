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

/**
 * `passesUpdatedSince` viaja como texto plano de la marca de tiempo que
 * esta misma ruta devolvió la vez anterior (`lastUpdated`, más abajo) —
 * algo como `2026-08-16T15:22:58.099512+00:00`. Apple lo manda con el
 * `+` del huso horario TAL CUAL, sin codificarlo como `%2B`.
 *
 * `URLSearchParams` (lo que usa `new URL(...).searchParams`) interpreta
 * un `+` en un query string como espacio — es la semántica de
 * `application/x-www-form-urlencoded`, no la de una URI cualquiera.
 * Eso convertía la marca en `...099512 00:00` (espacio en vez de `+`),
 * que Postgres rechaza de plano como `timestamptz` inválido
 * (confirmado directo contra Postgres, no supuesto). La consulta de
 * abajo fallaba en silencio —el código solo miraba `data`, nunca
 * `error`— así que esta ruta contestaba "nada cambió" (204) aun cuando
 * SÍ había un sello nuevo: el mismo "spurious push... returned no
 * serial numbers" que Apple reporta en `/v1/log` cuando esto pasa.
 *
 * Por eso acá se extrae el valor a mano, sin pasar por
 * `URLSearchParams`, decodificando el resto de escapes `%XX` pero sin
 * tocar ningún `+` literal.
 */
export function extraerPassesUpdatedSince(urlCompleta: string): string | null {
  const encontrado = urlCompleta.match(/[?&]passesUpdatedSince=([^&]*)/);
  if (!encontrado) return null;
  try {
    return decodeURIComponent(encontrado[1]);
  } catch {
    return null;
  }
}

export async function GET(
  pedido: Request,
  { params }: { params: Promise<{ deviceId: string; passTypeId: string }> },
) {
  const { deviceId, passTypeId } = await params;
  const desde = extraerPassesUpdatedSince(pedido.url);

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

  const { data: pases, error: errorConsulta } = await consulta;
  if (errorConsulta) {
    // Antes esto se descartaba en silencio y la ruta contestaba 204
    // ("nada cambió") — exactamente el bug de arriba, solo que para
    // CUALQUIER error futuro de esta consulta, no solo el de la marca
    // de tiempo mal decodificada. 204 es una afirmación ("no hay
    // cambios"): no se puede afirmar eso cuando la consulta que lo
    // confirmaría falló. Responde 500 — "no se pudo saber", nunca
    // "no cambió nada" — y el motivo real queda en el log del
    // servidor, sin exponer nada del error al teléfono.
    console.error(`[wallet] passesUpdatedSince falló para deviceId=${deviceId}: ${errorConsulta.message}`);
    return new NextResponse(null, { status: 500 });
  }
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
