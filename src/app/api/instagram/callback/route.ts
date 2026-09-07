import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { configMeta } from "@/lib/instagram/config";
import { COOKIE_NONCE, verificarEstado } from "@/lib/instagram/oauth";
import { intercambiarCodigo, perfilInstagram, suscribirComentarios, tokenLargo } from "@/lib/instagram/meta";
import { guardarCuentaConectada } from "@/lib/instagram/cuentas";
import { tipoCuentaDe } from "@/lib/instagram/tipos";

/**
 * GET /api/instagram/callback?code&state — LA VUELTA DE META.
 *
 * En orden, y cada paso corta si falla:
 *   1. `state` con firma válida y no vencido, y su nonce igual al de la
 *      cookie (las dos llaves).
 *   2. La sesión actual es la MISMA persona que arrancó el flujo, y
 *      sigue pudiendo editar ese negocio.
 *   3. Código → token corto → token largo (60 días).
 *   4. /me: quién es y si es cuenta profesional (Business / Creator).
 *   5. Suscribir la cuenta a los comentarios del webhook. Si esto falla
 *      NO se aborta: la cuenta queda conectada con `suscrito_webhook =
 *      false` y una nota, y el panel ofrece «Reintentar».
 *   6. Guardar (token cifrado) y volver al panel.
 *
 * Nada de lo que devuelve Meta se escribe en logs: el `code` y los
 * tokens son credenciales. Los motivos de error que viajan en la URL
 * son nuestros códigos cortos, nunca texto de Meta.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function volver(request: Request, negocioId: string | null, params: Record<string, string>) {
  const u = new URL(negocioId ? `/solutions/panel/${negocioId}/instagram` : "/solutions/panel", request.url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const salida = NextResponse.redirect(u);
  salida.cookies.set(COOKIE_NONCE, "", { httpOnly: true, path: "/api/instagram", maxAge: 0 });
  return salida;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cfg = configMeta();
  if (!cfg) return volver(request, null, { instagram: "error", motivo: "sin_configurar" });

  // El state primero: sin él no sabemos ni a qué negocio volver.
  const estado = verificarEstado(url.searchParams.get("state"), cfg.appSecret);
  if (!estado.ok) return volver(request, null, { instagram: "error", motivo: "state" });
  const { negocioId, usuarioId, nonce } = estado.estado;

  const cookieNonce = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE_NONCE}=([^;]+)`))?.[1] ?? "";
  if (!cookieNonce || cookieNonce !== nonce) return volver(request, negocioId, { instagram: "error", motivo: "state" });

  // La persona canceló en la pantalla de permisos.
  if (url.searchParams.get("error")) return volver(request, negocioId, { instagram: "error", motivo: "cancelado" });
  const code = url.searchParams.get("code")?.trim() ?? "";
  if (!code) return volver(request, negocioId, { instagram: "error", motivo: "sin_codigo" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== usuarioId) return volver(request, negocioId, { instagram: "error", motivo: "sesion" });
  const acceso = await verificarAccesoSolutions(negocioId);
  if (!acceso.ok || !acceso.puedeEditar) return volver(request, negocioId, { instagram: "error", motivo: "acceso" });

  const admin = createAdminClient();
  if (!admin) return volver(request, negocioId, { instagram: "error", motivo: "servidor" });

  const corto = await intercambiarCodigo(cfg, code);
  if (!corto.ok) return volver(request, negocioId, { instagram: "error", motivo: corto.error.codigo });
  const largo = await tokenLargo(cfg, corto.data.access_token);
  if (!largo.ok) return volver(request, negocioId, { instagram: "error", motivo: largo.error.codigo });

  const perfil = await perfilInstagram(cfg, largo.data.access_token);
  if (!perfil.ok) return volver(request, negocioId, { instagram: "error", motivo: perfil.error.codigo });
  if (!tipoCuentaDe(perfil.data.account_type)) return volver(request, negocioId, { instagram: "error", motivo: "cuenta_incompatible" });

  const suscripcion = await suscribirComentarios(cfg, largo.data.access_token);
  const permisos = Array.isArray(corto.data.permissions)
    ? corto.data.permissions
    : typeof corto.data.permissions === "string"
      ? corto.data.permissions.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

  const guardado = await guardarCuentaConectada(admin, cfg, {
    negocioId,
    usuarioId: user.id,
    perfil: perfil.data,
    token: largo.data.access_token,
    expiresIn: Number(largo.data.expires_in),
    permisos,
    suscrito: suscripcion.ok,
    notaSuscripcion: suscripcion.ok ? null : `No se pudo suscribir al webhook: ${suscripcion.error.mensaje}`,
  });
  if (!guardado.ok) return volver(request, negocioId, { instagram: "error", motivo: "guardar", detalle: guardado.motivo.slice(0, 120) });

  return volver(request, negocioId, { instagram: "conectado" });
}
