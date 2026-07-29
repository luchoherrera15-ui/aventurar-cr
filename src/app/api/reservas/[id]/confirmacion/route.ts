import { NextResponse } from "next/server";
import { notificarReservaCompletada } from "@/lib/notificaciones-reserva";

/**
 * "Mandá los correos de esta reserva" — lo llama la app móvil apenas
 * termina de guardar una reserva. La app no puede mandarlos sola: la
 * API key de Resend y la llave de servicio de Supabase son secretos de
 * servidor y no pueden viajar dentro del bundle de una app.
 *
 * Es público a propósito (se puede reservar sin cuenta), así que lo
 * importante es que NO sea un relay de correo para cualquiera:
 *
 *  - El cuerpo del pedido no se lee nunca. Los destinatarios salen
 *    únicamente de `reservas.correo` y del perfil del dueño, así que
 *    no hay ninguna entrada por donde alguien pueda decidir a quién
 *    se le escribe. Esa es la guarda que importa; el resto es apoyo.
 *  - El helper solo avisa una vez por reserva (marca la fila dentro
 *    del mismo UPDATE con que la lee), y solo si está 'pendiente' y
 *    se creó hace poco. Martillar este endpoint no manda ni un correo
 *    de más.
 *
 * Siempre responde 200 con {ok} para no servir de oráculo: desde
 * afuera no se distingue "ya se envió" de "esa reserva no existe".
 */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Margen entre que se guarda la reserva y que la app pide el correo.
// Dos horas y no diez minutos porque el teléfono puede haberse ido a
// segundo plano en el medio.
const VENTANA_MINUTOS = 120;

// La app también corre en el navegador (react-native-web) cuando se
// prueba con `npm run web`, y ahí sí aplica CORS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// El pedido no se lee a propósito — ver el comentario de arriba.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const resultado = await notificarReservaCompletada(id, {
    maxAntiguedadMinutos: VENTANA_MINUTOS,
  });

  return NextResponse.json(
    { ok: resultado.notificada },
    { status: 200, headers: CORS },
  );
}
