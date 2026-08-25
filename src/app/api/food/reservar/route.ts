import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  POST /api/food/reservar — el puente HTTP para la app móvil de FOOD
 * ═══════════════════════════════════════════════════════════════════
 *
 * `crear_reserva_food()` (0190/0191) está bloqueada para `authenticated`
 * a propósito — solo `service_role` puede llamarla, así el cupo y el
 * descuento nunca los decide el navegador. En /web eso lo resuelve un
 * Server Action (reservarFood, src/app/food/restaurante/[slug]/actions.ts):
 * corre en ESTE servidor, así que puede usar la llave de servicio
 * después de validar la sesión por cookie.
 *
 * La app móvil de FOOD (mobile-food/, proyecto Expo aparte, sin
 * servidor propio) no tiene ese lugar de confianza — habla con
 * Supabase directo. Esta ruta es exactamente ESE lugar de confianza,
 * expuesto por HTTP: recibe el access token de la sesión de Supabase
 * en el header `Authorization`, lo valida con `auth.getUser(token)`
 * (verificación real contra Supabase Auth, no un decodificado a
 * ciegas), y desde ahí repite el MISMO cuerpo que reservarFood() —
 * misma llamada a la misma RPC, mismo guard contra negocios demo.
 *
 * CORS abierto a propósito: esta ruta no lee cookies ni nada
 * ambient — toda la autorización viaja en el bearer token, así que no
 * hay nada que un origen ajeno pueda robar con una petición cruzada.
 */
function conCors(respuesta: NextResponse): NextResponse {
  respuesta.headers.set("Access-Control-Allow-Origin", "*");
  respuesta.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  respuesta.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  return respuesta;
}

export function OPTIONS() {
  return conCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return conCors(NextResponse.json({ ok: false, error: "Falta la sesión." }, { status: 401 }));
  }

  const anon = createAnonClient();
  const {
    data: { user },
    error: errorUsuario,
  } = await anon.auth.getUser(token);
  if (errorUsuario || !user) {
    return conCors(NextResponse.json({ ok: false, error: "Sesión inválida o vencida." }, { status: 401 }));
  }

  let body: { franjaId?: string; partySize?: number };
  try {
    body = await req.json();
  } catch {
    return conCors(NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 }));
  }
  const { franjaId, partySize } = body;
  if (!franjaId || typeof franjaId !== "string") {
    return conCors(NextResponse.json({ ok: false, error: "Falta la franja." }, { status: 400 }));
  }
  if (!Number.isInteger(partySize) || partySize! < 1 || partySize! > 30) {
    return conCors(
      NextResponse.json({ ok: false, error: "La cantidad de personas no es válida." }, { status: 400 }),
    );
  }

  const db = createAdminClient();
  if (!db) {
    return conCors(
      NextResponse.json({ ok: false, error: "No hay conexión de servicio." }, { status: 500 }),
    );
  }

  // Mismo guard que reservarFood(): un negocio demo (0193) es
  // puramente visual y no acepta reservas reales, venga de web o de
  // la app móvil.
  const { data: franja, error: errFranja } = await db
    .from("food_franjas")
    .select("food_businesses(es_demo)")
    .eq("id", franjaId)
    .maybeSingle();
  if (errFranja) {
    return conCors(
      NextResponse.json({ ok: false, error: "No se pudo validar la franja: " + errFranja.message }, { status: 500 }),
    );
  }
  const negocioFranja = Array.isArray(franja?.food_businesses)
    ? franja.food_businesses[0]
    : franja?.food_businesses;
  if (negocioFranja?.es_demo) {
    return conCors(
      NextResponse.json(
        { ok: false, error: "Esto es una demo: no acepta reservas reales." },
        { status: 400 },
      ),
    );
  }

  const { data, error } = await db.rpc("crear_reserva_food", {
    p_franja_id: franjaId,
    p_customer_id: user.id,
    p_party_size: partySize,
  });
  if (error) {
    return conCors(
      NextResponse.json({ ok: false, error: "No se pudo reservar: " + error.message }, { status: 500 }),
    );
  }

  const r = data as { ok: boolean; reserva_id?: string; motivo?: string };
  if (!r.ok) {
    return conCors(NextResponse.json({ ok: false, error: r.motivo ?? "No se pudo reservar." }, { status: 400 }));
  }

  return conCors(NextResponse.json({ ok: true, reservaId: r.reserva_id }));
}
