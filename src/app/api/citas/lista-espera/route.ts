import { NextResponse } from "next/server";
import { sesionDesdeBearer, type SesionBearer } from "@/lib/supabase/bearer";
import { avisarListaEspera } from "@/lib/lista-espera";

/**
 * POST /api/citas/lista-espera — la puerta de la app móvil al aviso de
 * la lista de espera (0095). Cuando el dueño cancela o mueve una cita
 * DESDE EL TELÉFONO (update directo a reservas, sin server action), la
 * app pega acá para que los apuntados de ese día se enteren igual que
 * cuando se cancela desde la web. El envío necesita la service key y
 * Resend, así que vive en el servidor.
 *
 * Autentica con `Authorization: Bearer <access_token>` y exige que
 * quien llama sea el dueño del negocio (o admin) — el aviso solo lo
 * dispara quien de verdad liberó la franja.
 *
 * Body: { ranchoId, fecha }  →  { ok: boolean }
 */

const UUID_REGEX = /^[0-9a-f-]{36}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function esDueno(sesion: SesionBearer, ranchoId: string): Promise<boolean> {
  const { data: rancho } = await sesion.supabase
    .from("ranchos")
    .select("owner_id")
    .eq("id", ranchoId)
    .maybeSingle();
  if (rancho?.owner_id === sesion.usuarioId) return true;
  const { data: perfil } = await sesion.supabase
    .from("perfiles")
    .select("rol")
    .eq("id", sesion.usuarioId)
    .maybeSingle();
  return perfil?.rol === "admin";
}

export async function POST(request: Request) {
  const sesion = await sesionDesdeBearer(request);
  if (!sesion) {
    return NextResponse.json({ ok: false }, { status: 401, headers: CORS });
  }

  let body: { ranchoId?: string; fecha?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    // Cae al chequeo de abajo.
  }
  const ranchoId = body?.ranchoId ?? "";
  const fecha = body?.fecha ?? "";
  if (!UUID_REGEX.test(ranchoId) || !FECHA_REGEX.test(fecha)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  if (!(await esDueno(sesion, ranchoId))) {
    return NextResponse.json({ ok: false }, { status: 403, headers: CORS });
  }

  // avisarListaEspera nunca lanza y trae su propio reclamo
  // (avisado_en): martillar este endpoint no duplica correos.
  await avisarListaEspera(ranchoId, fecha);
  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}
