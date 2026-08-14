import { NextResponse } from "next/server";
import { sesionDesdeBearer, type SesionBearer } from "@/lib/supabase/bearer";
import { otorgarPuntosPorCita } from "@/lib/lealtad/citas";

/**
 * "Esta cita quedó cumplida — otorgá los puntos de lealtad" — lo llama
 * la app móvil después de marcar la asistencia (el update lo hace ella
 * misma con la sesión del dueño; la RLS ya lo permite).
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTO PIDE SESIÓN Y LOS ENDPOINTS HERMANOS NO
 * ------------------------------------------------------------------
 * /api/citas/[id]/confirmacion y /api/agendas/[id]/sync son anónimos
 * a propósito: lo peor que logra quien los martilla es que salga un
 * correo que ya iba a salir, o que se relea un calendario. No escriben
 * nada del negocio.
 *
 * Este escribe EL LEDGER DE LEALTAD. Con la llave de servicio adentro,
 * `Access-Control-Allow-Origin: *` y sin ninguna credencial, era una
 * escritura anónima a los puntos de los clientes de un negocio. Que
 * estuviera acotado —exige que la reserva ya esté `cumplida`, y la
 * referencia `cita:{id}` lo hace idempotente— achica el daño, no lo
 * cierra: seguía siendo cualquiera de internet moviendo el saldo de un
 * cliente ajeno, con solo adivinar (o filtrarse) un UUID de reserva. Un
 * ledger con un asiento que nadie firmó es un rumor.
 *
 * ------------------------------------------------------------------
 * EL MECANISMO ELEGIDO: BEARER, EL MISMO QUE YA USA EL APP
 * ------------------------------------------------------------------
 * No es un secreto de cron —no lo dispara ningún cron— ni una cookie
 * —el teléfono no tiene—. Lo llama UNA sola cosa en todo el repo
 * (`mobile/src/app/negocio/[id]/agenda.tsx`), y esa pantalla ya tiene
 * la sesión de Supabase en la mano: la usa para marcar la asistencia
 * dos líneas antes, y ya manda `Authorization: Bearer` a
 * /api/citas/lista-espera desde ese mismo archivo. Así que pedir el
 * token es cerrar la puerta sin agregarle nada nuevo a quien llama.
 *
 * Y se exige lo mismo que para MARCAR la cita: quien puede ponerla en
 * `cumplida` es quien puede disparar sus puntos. Ni más (un cliente no
 * se acredita solo) ni menos (el encargado del mostrador, que es quien
 * marca de verdad, sigue pudiendo).
 *
 * Lo que NO cambió:
 *  - El cuerpo del pedido no se lee nunca: el helper verifica en la
 *    base que la cita esté realmente 'cumplida' antes de otorgar nada.
 *  - Idempotente: la referencia `cita:{id}` hace que martillar este
 *    endpoint jamás otorgue puntos dos veces.
 *  - Con sesión válida siempre responde 200 con {ok} para no servir de
 *    oráculo de qué citas existen ni de cuáles tienen programa.
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // `authorization` se suma a la lista o el preflight del navegador
  // rechaza el header antes de que la petición salga.
  "Access-Control-Allow-Headers": "content-type, authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * ¿Esta persona maneja la agenda de ese negocio? Dueño, admin de
 * plataforma o encargado (`rancho_colaboradores`, 0116) — el mismo
 * reparto que `verificarAccesoOperativo`, que es el que gobierna
 * marcar asistencia en el panel web.
 *
 * Las tres consultas van con el cliente DEL USUARIO, no con la llave
 * de servicio: la RLS vuelve a decidir, y si alguna falla se responde
 * que NO. En permisos, el empate se pierde.
 */
async function gestionaElNegocio(sesion: SesionBearer, ranchoId: string): Promise<boolean> {
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
  if (perfil?.rol === "admin") return true;

  const { data: colaborador, error } = await sesion.supabase
    .from("rancho_colaboradores")
    .select("usuario_id")
    .eq("rancho_id", ranchoId)
    .eq("usuario_id", sesion.usuarioId)
    .maybeSingle();
  return !error && !!colaborador;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const sesion = await sesionDesdeBearer(request);
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Entrá con tu cuenta." },
      { status: 401, headers: CORS },
    );
  }

  // De qué negocio es la cita — leído con la sesión de quien llama, así
  // que una reserva que esa persona no puede ni ver ya no existe para
  // esta ruta.
  const { data: reserva } = await sesion.supabase
    .from("reservas")
    .select("rancho_id")
    .eq("id", id)
    .maybeSingle();
  const ranchoId = (reserva?.rancho_id as string | null) ?? null;

  if (!ranchoId || !(await gestionaElNegocio(sesion, ranchoId))) {
    return NextResponse.json(
      { ok: false, error: "No manejás la agenda de ese negocio." },
      { status: 403, headers: CORS },
    );
  }

  await otorgarPuntosPorCita(id);

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}
