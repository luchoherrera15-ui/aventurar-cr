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
  // El desvío inteligente de lealtad: con UN negocio con programa cae
  // DERECHO en su pestaña; con varios, al listado. Mandar al listado a
  // secas dejaba a la persona frente a sus tarjetas de negocio sin
  // ninguna pista de a dónde seguir — se reportó como "no funciona",
  // y con razón.
  lealtad: "/lealtad/entrar",
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
