import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { configMeta } from "@/lib/instagram/config";
import { COOKIE_NONCE, firmarEstado, nuevoNonce, urlAutorizacion, VIDA_ESTADO_MS } from "@/lib/instagram/oauth";

/**
 * GET /api/instagram/conectar?negocio=<id> — EL ARRANQUE DEL OAUTH.
 *
 * Solo con sesión y solo para quien puede EDITAR ese negocio
 * (`verificarAccesoSolutions`, la misma puerta de todo el panel). Se
 * arma el `state` firmado —con el negocio y el usuario adentro— y el
 * nonce viaja además en una cookie httpOnly, para que el callback pueda
 * exigir las dos llaves.
 *
 * `getUser()` y no `getSession()`: acá se decide un privilegio (conectar
 * una credencial a un negocio), así que se paga el viaje a Supabase.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function volverAlPanel(negocioId: string, error: string, request: Request) {
  const u = new URL(`/solutions/panel/${negocioId}/instagram`, request.url);
  u.searchParams.set("instagram", "error");
  u.searchParams.set("motivo", error);
  return NextResponse.redirect(u);
}

export async function GET(request: Request) {
  const negocioId = new URL(request.url).searchParams.get("negocio")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(negocioId)) {
    return NextResponse.redirect(new URL("/solutions/panel", request.url));
  }

  const cfg = configMeta();
  if (!cfg) return volverAlPanel(negocioId, "sin_configurar", request);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/cuenta?volver=solutions", request.url));

  const acceso = await verificarAccesoSolutions(negocioId);
  if (!acceso.ok || !acceso.puedeEditar) return NextResponse.redirect(new URL("/solutions/panel", request.url));

  const nonce = nuevoNonce();
  const state = firmarEstado({ negocioId, usuarioId: user.id, nonce }, cfg.appSecret);
  const salida = NextResponse.redirect(urlAutorizacion({ appId: cfg.igAppId, redirectUri: cfg.redirectUri, state }));
  salida.cookies.set(COOKIE_NONCE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: Math.floor(VIDA_ESTADO_MS / 1000),
  });
  return salida;
}
