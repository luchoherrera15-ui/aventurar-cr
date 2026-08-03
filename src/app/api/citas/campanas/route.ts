import { NextResponse } from "next/server";
import { sesionDesdeBearer, type SesionBearer } from "@/lib/supabase/bearer";
import {
  enviarCampanaNegocioCore,
  type CampanaNegocioInput,
} from "@/lib/campanas/citas";

/**
 * POST /api/citas/campanas — la puerta de la app móvil a las campañas
 * por negocio (promos de re-enganche del CRM). El envío necesita
 * secretos del servidor (Resend, service key para bitácora y frenos),
 * así que el teléfono delega acá; el núcleo es el MISMO que usa la
 * server action del panel web — destinatarios derivados de las
 * reservas, consentimiento con ámbito y frenos anti-abuso incluidos.
 *
 * Autentica con `Authorization: Bearer <access_token>`; además
 * verifica que quien llama sea el dueño del negocio (o admin).
 *
 * Body: { ranchoId, tipo, segmento, asunto, mensaje, correos }
 * Response: ResultadoCampanaNegocio (error, enviados, fallidos,
 *           excluidos, omitidosRecientes)
 */

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

// Una campaña de 200 destinatarios va en lotes con pausa: necesita más
// que el timeout por defecto de una función serverless.
export const maxDuration = 300;

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
    return NextResponse.json(
      { error: "Entrá con tu cuenta.", enviados: 0, fallidos: 0, excluidos: 0, omitidosRecientes: 0 },
      { status: 401, headers: CORS },
    );
  }

  let body: (Partial<CampanaNegocioInput> & { ranchoId?: string }) | null = null;
  try {
    body = await request.json();
  } catch {
    // Cae al chequeo de abajo.
  }
  const ranchoId = body?.ranchoId ?? "";
  if (!body || !UUID_REGEX.test(ranchoId)) {
    return NextResponse.json(
      { error: "Datos inválidos.", enviados: 0, fallidos: 0, excluidos: 0, omitidosRecientes: 0 },
      { status: 400, headers: CORS },
    );
  }

  if (!(await esDueno(sesion, ranchoId))) {
    return NextResponse.json(
      { error: "No encontramos tu publicación.", enviados: 0, fallidos: 0, excluidos: 0, omitidosRecientes: 0 },
      { status: 403, headers: CORS },
    );
  }

  const resultado = await enviarCampanaNegocioCore(sesion.supabase, sesion.usuarioId, ranchoId, {
    tipo: body.tipo ?? "campana",
    segmento: body.segmento ?? "manual",
    asunto: body.asunto ?? "",
    mensaje: body.mensaje ?? "",
    correos: Array.isArray(body.correos) ? body.correos : [],
  });
  return NextResponse.json(resultado, { status: 200, headers: CORS });
}
