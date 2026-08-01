import { NextResponse } from "next/server";
import { verificarBaja } from "@/lib/correo/baja";
import { registrarConsentimiento } from "@/lib/correo/marketing";

/**
 * La baja "de un clic" del estándar List-Unsubscribe (RFC 8058): los
 * correos de marketing llevan este endpoint en sus cabeceras, y Gmail
 * o Apple Mail lo llaman con POST cuando la persona toca "Cancelar
 * suscripción" en la interfaz del buzón — sin abrir ninguna página.
 *
 * GET (una persona pegó la URL en el navegador) redirige a la página
 * /baja de siempre, donde se confirma con un botón.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const datos = verificarBaja({
    e: url.searchParams.get("e") ?? undefined,
    r: url.searchParams.get("r") ?? undefined,
    t: url.searchParams.get("t") ?? undefined,
  });
  // Siempre 200: este endpoint no puede servir de oráculo de firmas.
  if (!datos) return NextResponse.json({ ok: true });

  const { error } = await registrarConsentimiento({
    correo: datos.correo,
    ranchoId: datos.ranchoId,
    estado: "revocado",
    origen: "link_baja",
    detalle: "one-click (List-Unsubscribe)",
  });
  // Al buzón se le responde 200 igual (un 500 haría que Gmail marque
  // la baja como fallida), pero el fallo queda en el log: una
  // revocación perdida en silencio es justo lo que no puede pasar.
  if (error) {
    console.error(`[baja] No se pudo registrar la baja one-click: ${error}`);
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(`/baja?${url.searchParams.toString()}`, url.origin));
}
