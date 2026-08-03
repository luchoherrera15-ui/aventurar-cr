import { NextResponse } from "next/server";
import { sesionDesdeBearer, type SesionBearer } from "@/lib/supabase/bearer";
import {
  guardarHorarioMiembroCore,
  guardarServiciosMiembroCore,
  type RangoHorarioMiembroCore,
} from "@/lib/agenda/equipo";

/**
 * POST /api/citas/equipo — la puerta de la app móvil a la
 * configuración fina del equipo (horario propio y servicios por
 * miembro). El app NO escribe horarios_recurso/servicios_recurso
 * directo aunque la RLS se lo permitiría: la semántica es delicada
 * (el centinela de "día libre", la materialización de "lo dan todos")
 * y tiene que vivir en UN solo lugar — el núcleo compartido con la
 * server action del panel web.
 *
 * Autentica con `Authorization: Bearer <access_token>` y opera CON esa
 * sesión (la RLS sigue en pie); además verifica acá que quien llama
 * sea el dueño del negocio (o admin).
 *
 * Body:
 *  { ranchoId, miembroId, accion: "horario",
 *    rangos: {dow,abre,cierra}[] | null, diasLibres?: number[] }
 *  { ranchoId, miembroId, accion: "servicios", itemIds: string[] }
 * Response: { ok: boolean, error?, advertencia? }
 */

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** ¿Quien llama es el dueño de este negocio (o un admin)? */
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
      { ok: false, error: "Entrá con tu cuenta." },
      { status: 401, headers: CORS },
    );
  }

  let body: {
    ranchoId?: string;
    miembroId?: string;
    accion?: string;
    rangos?: RangoHorarioMiembroCore[] | null;
    diasLibres?: number[];
    itemIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Cuerpo inválido." },
      { status: 400, headers: CORS },
    );
  }

  const ranchoId = body.ranchoId ?? "";
  const miembroId = body.miembroId ?? "";
  if (!UUID_REGEX.test(ranchoId) || !UUID_REGEX.test(miembroId)) {
    return NextResponse.json(
      { ok: false, error: "Datos inválidos." },
      { status: 400, headers: CORS },
    );
  }

  if (!(await esDueno(sesion, ranchoId))) {
    return NextResponse.json(
      { ok: false, error: "No encontramos tu publicación." },
      { status: 403, headers: CORS },
    );
  }

  if (body.accion === "horario") {
    // `rangos` tiene que venir EXPLÍCITO (null = heredar del negocio):
    // un body que simplemente lo omite no puede borrar el horario de
    // alguien por accidente.
    if (!("rangos" in body)) {
      return NextResponse.json(
        { ok: false, error: "Falta `rangos` (null = heredar del negocio)." },
        { status: 400, headers: CORS },
      );
    }
    const res = await guardarHorarioMiembroCore(
      sesion.supabase,
      ranchoId,
      miembroId,
      body.rangos ?? null,
      body.diasLibres ?? [],
    );
    return NextResponse.json(
      { ok: !res.error, error: res.error },
      { status: 200, headers: CORS },
    );
  }

  if (body.accion === "servicios") {
    // Mismo principio: la lista tiene que venir explícita — omitida no
    // significa "no da ninguno".
    if (!Array.isArray(body.itemIds)) {
      return NextResponse.json(
        { ok: false, error: "Falta `itemIds` (la lista de servicios que da)." },
        { status: 400, headers: CORS },
      );
    }
    const res = await guardarServiciosMiembroCore(
      sesion.supabase,
      ranchoId,
      miembroId,
      body.itemIds,
    );
    return NextResponse.json(
      { ok: !res.error, error: res.error, advertencia: res.advertencia },
      { status: 200, headers: CORS },
    );
  }

  return NextResponse.json(
    { ok: false, error: "Acción desconocida." },
    { status: 400, headers: CORS },
  );
}
