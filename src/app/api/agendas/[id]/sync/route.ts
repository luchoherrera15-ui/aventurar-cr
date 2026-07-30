import { NextResponse } from "next/server";
import { sincronizarAgendaExterna } from "@/lib/agenda/importar-ics";

/**
 * "Sincronizá esta agenda externa ahora" — lo llama la app móvil (y
 * las server actions de la web lo hacen directo con la lib). Mismo
 * diseño sin oráculo que /api/citas/[id]/asistencia:
 *
 *  - El cuerpo no se lee: la URL del calendario y el negocio salen de
 *    `agendas_externas`, que solo el dueño pudo haber creado (RLS).
 *  - Idempotente y con throttle interno: martillar el endpoint no
 *    descarga el calendario externo más de una vez por minuto.
 *  - El id es un UUID inadivinable; la respuesta solo trae el conteo.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const resultado = await sincronizarAgendaExterna(id);
  return NextResponse.json(resultado, { status: 200, headers: CORS });
}
