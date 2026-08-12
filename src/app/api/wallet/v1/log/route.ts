import { NextResponse } from "next/server";

/**
 * El buzón de errores de Apple.
 *
 * Cuando un pase no se registra o no se actualiza, iOS manda acá el
 * motivo en texto plano. Es LA forma de enterarse de por qué un pase
 * falla en el teléfono de alguien más: sin este endpoint, un pase mal
 * firmado o un token equivocado fallan en absoluto silencio.
 *
 * Va a los logs del servidor y no a una tabla: es diagnóstico, no dato
 * del negocio, y guardarlo obligaría a limpiarlo.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(pedido: Request) {
  try {
    const cuerpo = (await pedido.json()) as { logs?: unknown };
    const lineas = Array.isArray(cuerpo.logs) ? cuerpo.logs : [];
    for (const linea of lineas.slice(0, 50)) {
      console.warn("[wallet] Apple reporta: " + String(linea).slice(0, 500));
    }
  } catch {
    // Un log mal formado no merece un error: se descarta.
  }
  // Apple espera 200 pase lo que pase; cualquier otra cosa lo hace
  // reintentar y llenar los logs de ruido.
  return new NextResponse(null, { status: 200 });
}
