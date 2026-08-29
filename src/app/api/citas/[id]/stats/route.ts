import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sesionDesdeBearer } from "@/lib/supabase/bearer";
import { resolverAccesoLealtad } from "@/lib/lealtad/acceso";
import { hoyISOCR } from "@/lib/fechas";

/**
 * Los contadores de operación de un negocio de citas: cuántas citas se
 * han agendado, cuántos clientes distintos ya se atendieron y cuántas
 * lleva cada persona del equipo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO PIDE SESIÓN (no lo pedía y era una fuga)
 * ------------------------------------------------------------------
 * La consulta corre con la llave de servicio: lee TODAS las reservas
 * del negocio, salteándose la RLS. Sin credencial, cualquiera de
 * internet obtenía —con solo el UUID del negocio— cuánto trabaja ese
 * negocio, cuánta gente atiende y el desempeño de cada persona del
 * equipo. Son números agregados (no viaja nombre, correo ni fecha
 * puntual), pero siguen siendo el pulso operativo de un negocio ajeno.
 *
 * Ahora se exige la misma sesión que el resto de las rutas de la app
 * (`Authorization: Bearer`, que es lo que manda el teléfono) y que
 * quien pregunta sea dueño, admin de plataforma o colaborador de ESE
 * negocio — el mismo reparto de `resolverAccesoLealtad`, resuelto con
 * el cliente del propio usuario para que la RLS dé la segunda opinión.
 * La vitrina pública por miembro vive aparte, en la vista agregada
 * `estadisticas_miembro_citas`, que el teléfono lee directo.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  // `authorization` se suma o el preflight del navegador rechaza el
  // header de sesión antes de que la petición salga.
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400, headers: CORS });
  }

  // Sesión de la app (Bearer). Sin token no se contesta nada: estos
  // números son de operación, no de vitrina.
  const sesion = await sesionDesdeBearer(request);
  if (!sesion) {
    return NextResponse.json(
      { error: "Entrá con tu cuenta." },
      { status: 401, headers: CORS },
    );
  }

  // ¿Maneja este negocio? Dueño, admin de plataforma o colaborador —
  // resuelto con el cliente del propio usuario, así la RLS vuelve a
  // decidir. Los permisos finos de lealtad no importan acá: alcanza con
  // que `ok` diga que pertenece al negocio.
  const acceso = await resolverAccesoLealtad(sesion.supabase, sesion.usuarioId, id);
  if (!acceso.ok) {
    return NextResponse.json(
      { error: "No manejás ese negocio." },
      { status: 403, headers: CORS },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { citasTotales: 0, clientesAtendidos: 0, citasPorMiembro: {} },
      { headers: CORS },
    );
  }

  const { data } = await admin
    .from("reservas")
    .select("cliente_id, correo, fecha, miembro_id")
    .eq("rancho_id", id)
    .eq("estado", "confirmada")
    .not("hora_inicio", "is", null);

  const hoy = hoyISOCR();
  const filas = (data ?? []) as {
    cliente_id: string | null;
    correo: string | null;
    fecha: string;
    miembro_id: string | null;
  }[];
  const atendidas = filas.filter((f) => f.fecha < hoy);
  const citasPorMiembro: Record<string, number> = {};
  for (const f of atendidas) {
    if (f.miembro_id) {
      citasPorMiembro[f.miembro_id] = (citasPorMiembro[f.miembro_id] ?? 0) + 1;
    }
  }

  return NextResponse.json(
    {
      citasTotales: filas.length,
      clientesAtendidos: new Set(
        atendidas.map((f) => f.cliente_id ?? f.correo).filter(Boolean),
      ).size,
      citasPorMiembro,
    },
    { headers: CORS },
  );
}
