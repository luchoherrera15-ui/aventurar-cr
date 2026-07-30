import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";

/**
 * Los contadores públicos de un negocio de citas: cuántas citas se
 * han agendado, cuántos clientes distintos ya se atendieron y cuántas
 * lleva cada persona del equipo. Lo usa la app móvil — la web los
 * calcula en el servidor de la página.
 *
 * Solo salen números agregados: la service key lee reservas ajenas,
 * pero acá jamás viaja un nombre, correo ni fecha puntual.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400, headers: CORS });
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
