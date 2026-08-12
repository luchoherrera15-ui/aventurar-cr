import { NextResponse } from "next/server";

/**
 * Puente de las tarjetas del perfil: al abrir una sección se estampa
 * la cookie `visto_{seccion}` con la hora y se redirige al destino.
 * El tablero de /cuenta usa esa marca para el "+N" de novedades — todo
 * lo que llegó después de la última visita cuenta como nuevo, y abrir
 * la tarjeta lo pone en cero. Sin tablas nuevas: es un contador de
 * cortesía por navegador, no un centro de notificaciones.
 */
const DESTINOS: Record<string, string> = {
  mensajes: "/mensajes",
  proveedor: "/mi-negocio",
  invitaciones: "/cuenta/invitaciones",
  // El programa de lealtad vive dentro de cada negocio (una pestaña
  // por publicación), así que la tarjeta lleva al listado y desde ahí
  // se elige cuál. No hay una pantalla "de lealtad" global.
  lealtad: "/mi-negocio",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ seccion: string }> },
) {
  const { seccion } = await params;
  const destino = DESTINOS[seccion];
  const res = NextResponse.redirect(new URL(destino ?? "/cuenta", request.url));
  if (destino) {
    res.cookies.set(`visto_${seccion}`, String(Date.now()), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return res;
}
