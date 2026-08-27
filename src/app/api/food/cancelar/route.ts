import { NextResponse } from "next/server";
import { FOOD_APAGADO } from "@/lib/food-apagado";
import { createAnonClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/food/cancelar — hermano de /api/food/reservar (ver ese
 * archivo para el porqué de este puente HTTP). Misma lógica que
 * cancelarReservaFood() (src/app/food/reserva/actions.ts), solo que
 * recibe el token de la app móvil por Authorization en vez de leer la
 * cookie de sesión de /web.
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
  // ⚠️ BOOKEA FOOD ESTÁ APAGADO (27 ago 2026). Ver
  // `src/lib/food-apagado.ts`: el producto se rehace desde cero en su
  // propio proyecto y este puente dejó de servirse.
  //
  // 410 y no 404: 410 significa «existía y se fue a propósito», que es
  // exactamente lo que pasó. Un 404 le diría a la app que se equivocó
  // de dirección.
  if (FOOD_APAGADO) {
    return NextResponse.json(
      { error: "Bookea Food ya no se atiende desde este servidor." },
      { status: 410 },
    );
  }


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

  let body: { reservaId?: string };
  try {
    body = await req.json();
  } catch {
    return conCors(NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 }));
  }
  if (!body.reservaId || typeof body.reservaId !== "string") {
    return conCors(NextResponse.json({ ok: false, error: "Falta la reserva." }, { status: 400 }));
  }

  const db = createAdminClient();
  if (!db) {
    return conCors(
      NextResponse.json({ ok: false, error: "No hay conexión de servicio." }, { status: 500 }),
    );
  }

  const { data, error } = await db.rpc("cancelar_reserva_food", {
    p_reserva_id: body.reservaId,
    p_customer_id: user.id,
  });
  if (error) {
    return conCors(
      NextResponse.json({ ok: false, error: "No se pudo cancelar: " + error.message }, { status: 500 }),
    );
  }

  const r = data as { ok: boolean; motivo?: string };
  if (!r.ok) {
    return conCors(NextResponse.json({ ok: false, error: r.motivo ?? "No se pudo cancelar." }, { status: 400 }));
  }

  return conCors(NextResponse.json({ ok: true }));
}
