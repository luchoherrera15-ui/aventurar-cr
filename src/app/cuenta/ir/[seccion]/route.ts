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
  // Sin un negocio único que ofrecer, cae en el listado «Mis negocios»
  // (/lealtad/entrar resuelve sesión y manda a /lealtad/panel). El
  // desvío directo a UN negocio se arma más abajo, con el query param
  // `negocio` que ya trae calculado quien construyó el link — este
  // puente no consulta la base, solo decide entre dos strings.
  lealtad: "/lealtad/entrar",
};

/** Solo UUID: lo que sea que traiga `?negocio=` que no tenga esta
 *  forma se ignora y cae al listado. No hace falta más — el destino
 *  (`/lealtad/panel/{id}`) vuelve a comprobar dueño/colaborador por su
 *  cuenta y rebota a quien no tenga acceso, así que esto no es la
 *  frontera de seguridad, es solo para no armar una URL con basura. */
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ seccion: string }> },
) {
  const { seccion } = await params;
  const url = new URL(request.url);

  let destino = DESTINOS[seccion];
  if (seccion === "lealtad") {
    const negocio = url.searchParams.get("negocio");
    if (negocio && RE_UUID.test(negocio)) destino = `/lealtad/panel/${negocio}`;
  }

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
