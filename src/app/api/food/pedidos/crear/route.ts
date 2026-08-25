import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  POST /api/food/pedidos/crear — el puente HTTP para "To Go" (0207)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Mismo criterio que /api/food/reservar: `crear_pedido_food()` está
 * bloqueada para `authenticated` (el precio y el total los decide el
 * servidor, nunca el teléfono), y la app móvil de FOOD no tiene su
 * propio servidor — esta ruta ES ese lugar de confianza, expuesto por
 * HTTP con el access token de Supabase en el header `Authorization`.
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

type ItemPedido = { menuItemId: string; cantidad: number };

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

  let body: { businessId?: string; items?: ItemPedido[]; horaRetiro?: string | null; notas?: string | null };
  try {
    body = await req.json();
  } catch {
    return conCors(NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 }));
  }
  const { businessId, items, horaRetiro, notas } = body;
  if (!businessId || typeof businessId !== "string") {
    return conCors(NextResponse.json({ ok: false, error: "Falta el restaurante." }, { status: 400 }));
  }
  if (!Array.isArray(items) || items.length === 0) {
    return conCors(NextResponse.json({ ok: false, error: "El pedido no tiene platos." }, { status: 400 }));
  }
  const itemsValidos = items.every(
    (it) => it && typeof it.menuItemId === "string" && Number.isInteger(it.cantidad) && it.cantidad > 0,
  );
  if (!itemsValidos) {
    return conCors(NextResponse.json({ ok: false, error: "El pedido tiene datos inválidos." }, { status: 400 }));
  }

  const db = createAdminClient();
  if (!db) {
    return conCors(
      NextResponse.json({ ok: false, error: "No hay conexión de servicio." }, { status: 500 }),
    );
  }

  const { data: negocio, error: errNegocio } = await db
    .from("food_businesses")
    .select("es_demo")
    .eq("id", businessId)
    .maybeSingle();
  if (errNegocio) {
    return conCors(
      NextResponse.json({ ok: false, error: "No se pudo validar el restaurante: " + errNegocio.message }, { status: 500 }),
    );
  }
  if (negocio?.es_demo) {
    return conCors(
      NextResponse.json({ ok: false, error: "Esto es una demo: no acepta pedidos reales." }, { status: 400 }),
    );
  }

  const { data, error } = await db.rpc("crear_pedido_food", {
    p_business_id: businessId,
    p_customer_id: user.id,
    p_items: items.map((it) => ({ menu_item_id: it.menuItemId, cantidad: it.cantidad })),
    p_hora_retiro: horaRetiro ?? null,
    p_notas: notas ?? null,
  });
  if (error) {
    return conCors(
      NextResponse.json({ ok: false, error: "No se pudo crear el pedido: " + error.message }, { status: 500 }),
    );
  }

  const r = data as { ok: boolean; pedido_id?: string; codigo?: string; total?: number; motivo?: string };
  if (!r.ok) {
    return conCors(NextResponse.json({ ok: false, error: r.motivo ?? "No se pudo crear el pedido." }, { status: 400 }));
  }

  return conCors(NextResponse.json({ ok: true, pedidoId: r.pedido_id, codigo: r.codigo, total: r.total }));
}
