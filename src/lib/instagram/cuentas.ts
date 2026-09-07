import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { cifrar, claveDesdeTexto, descifrar } from "./cifrado";
import type { ConfigMeta } from "./config";
import { refrescarTokenLargo, type PerfilIg } from "./meta";
import { debeRefrescar, venceEnDesde } from "./tokens";
import { tipoCuentaDe, type CuentaIg, type EstadoCuentaIg } from "./tipos";

/**
 * LA CUENTA CONECTADA — guardar, leer con el token, refrescar, apagar.
 *
 * Lo único de todo el módulo que toca `token_cifrado`. Todo lo demás
 * lee `CuentaIg`, que no lo tiene. `server-only`: importar esto desde
 * un componente de cliente rompe el build a propósito.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const COLUMNAS_SEGURAS =
  "id, negocio_id, ig_user_id, username, nombre, tipo_cuenta, foto_url, token_vence_en, token_refrescado_en, permisos, suscrito_webhook, activa, estado, estado_nota, conectada_en";

export function cuentaSegura(fila: Record<string, unknown>): CuentaIg {
  return {
    id: String(fila.id),
    negocio_id: String(fila.negocio_id),
    ig_user_id: String(fila.ig_user_id),
    username: String(fila.username ?? ""),
    nombre: (fila.nombre as string | null) ?? null,
    tipo_cuenta: tipoCuentaDe(fila.tipo_cuenta) ?? "BUSINESS",
    foto_url: (fila.foto_url as string | null) ?? null,
    token_vence_en: String(fila.token_vence_en),
    token_refrescado_en: (fila.token_refrescado_en as string | null) ?? null,
    permisos: Array.isArray(fila.permisos) ? (fila.permisos as string[]) : [],
    suscrito_webhook: fila.suscrito_webhook === true,
    activa: fila.activa === true,
    estado: (fila.estado as EstadoCuentaIg) ?? "conectada",
    estado_nota: (fila.estado_nota as string | null) ?? null,
    conectada_en: String(fila.conectada_en),
  };
}

/** La cuenta del negocio, sin token. null si no hay. */
export async function cuentaDelNegocio(admin: Admin, negocioId: string): Promise<CuentaIg | null> {
  const { data } = await admin.from("solutions_instagram_cuentas").select(COLUMNAS_SEGURAS).eq("negocio_id", negocioId).maybeSingle();
  return data ? cuentaSegura(data as Record<string, unknown>) : null;
}

/** La cuenta Y su token descifrado, para hablar con Meta en nombre del negocio. */
export async function cuentaConToken(admin: Admin, cfg: ConfigMeta, negocioId: string): Promise<{ cuenta: CuentaIg; token: string | null } | null> {
  const { data } = await admin.from("solutions_instagram_cuentas").select(`${COLUMNAS_SEGURAS}, token_cifrado`).eq("negocio_id", negocioId).maybeSingle();
  if (!data) return null;
  const fila = data as Record<string, unknown>;
  const clave = claveDesdeTexto(cfg.claveTokens);
  const blob = typeof fila.token_cifrado === "string" ? fila.token_cifrado : "";
  const token = clave && blob ? descifrar(blob, clave) : null;
  return { cuenta: cuentaSegura(fila), token };
}

export type DatosConexion = {
  negocioId: string;
  usuarioId: string;
  perfil: PerfilIg;
  token: string;
  expiresIn: number;
  permisos: string[];
  suscrito: boolean;
  notaSuscripcion: string | null;
};

/**
 * Guarda (o reemplaza) la cuenta conectada a la página. Un negocio, una
 * cuenta: reconectar es un upsert por `negocio_id`. Si ese Instagram ya
 * estaba conectado a OTRA página, el unique de `ig_user_id` lo frena y
 * se devuelve un motivo legible.
 */
export async function guardarCuentaConectada(admin: Admin, cfg: ConfigMeta, d: DatosConexion): Promise<{ ok: true; cuenta: CuentaIg } | { ok: false; motivo: string }> {
  const clave = claveDesdeTexto(cfg.claveTokens);
  if (!clave) return { ok: false, motivo: "META_TOKEN_ENCRYPTION_KEY no es una clave de 32 bytes." };
  const igUserId = String(d.perfil.user_id ?? d.perfil.id ?? "");
  const tipo = tipoCuentaDe(d.perfil.account_type);
  if (!igUserId || !tipo) return { ok: false, motivo: "Instagram no devolvió una cuenta profesional válida." };

  const ahora = new Date().toISOString();
  const fila = {
    negocio_id: d.negocioId,
    conectada_por: d.usuarioId,
    ig_user_id: igUserId,
    username: String(d.perfil.username ?? "").slice(0, 80) || igUserId,
    nombre: typeof d.perfil.name === "string" ? d.perfil.name.slice(0, 120) : null,
    tipo_cuenta: tipo,
    foto_url: typeof d.perfil.profile_picture_url === "string" && d.perfil.profile_picture_url.startsWith("https://") ? d.perfil.profile_picture_url : null,
    token_cifrado: cifrar(d.token, clave),
    token_vence_en: venceEnDesde(d.expiresIn),
    token_refrescado_en: null,
    permisos: d.permisos,
    suscrito_webhook: d.suscrito,
    activa: true,
    estado: "conectada",
    estado_nota: d.notaSuscripcion,
    conectada_en: ahora,
    actualizada_en: ahora,
  };
  const { data, error } = await admin
    .from("solutions_instagram_cuentas")
    .upsert(fila, { onConflict: "negocio_id" })
    .select(COLUMNAS_SEGURAS)
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, motivo: "Esa cuenta de Instagram ya está conectada a otra página de Linksy." };
    return { ok: false, motivo: "No se pudo guardar la conexión." };
  }
  return { ok: true, cuenta: cuentaSegura(data as Record<string, unknown>) };
}

/** Apaga la cuenta y BORRA el token: no se guarda una credencial sin uso. */
export async function desconectarCuenta(admin: Admin, negocioId: string): Promise<boolean> {
  const { error } = await admin
    .from("solutions_instagram_cuentas")
    .update({ activa: false, estado: "desconectada", estado_nota: null, token_cifrado: null, actualizada_en: new Date().toISOString() })
    .eq("negocio_id", negocioId);
  return !error;
}

export async function marcarEstadoCuenta(admin: Admin, cuentaId: string, estado: EstadoCuentaIg, nota: string | null): Promise<void> {
  await admin
    .from("solutions_instagram_cuentas")
    .update({ estado, estado_nota: nota ? nota.slice(0, 300) : null, actualizada_en: new Date().toISOString() })
    .eq("id", cuentaId);
}

/**
 * Refresca el token largo si toca (Meta: ≥24 h y no vencido). Devuelve
 * qué pasó, para el cron y para el panel. Nunca lanza.
 */
export async function refrescarSiToca(admin: Admin, cfg: ConfigMeta, cuentaId: string): Promise<"refrescado" | "no_toca" | "sin_token" | "error"> {
  const { data } = await admin
    .from("solutions_instagram_cuentas")
    .select("id, token_cifrado, token_vence_en, token_refrescado_en, conectada_en, activa")
    .eq("id", cuentaId)
    .maybeSingle();
  if (!data || data.activa !== true) return "no_toca";
  const fila = data as Record<string, unknown>;
  if (!debeRefrescar({ venceEn: String(fila.token_vence_en), refrescadoEn: (fila.token_refrescado_en as string | null) ?? null, conectadaEn: String(fila.conectada_en) })) {
    return "no_toca";
  }
  const clave = claveDesdeTexto(cfg.claveTokens);
  const token = clave && typeof fila.token_cifrado === "string" ? descifrar(fila.token_cifrado, clave) : null;
  if (!token || !clave) return "sin_token";

  const r = await refrescarTokenLargo(token);
  if (!r.ok) {
    if (r.error.codigo === "token_vencido" || r.error.codigo === "permisos") {
      await marcarEstadoCuenta(admin, cuentaId, "reconectar", r.error.mensaje);
    }
    return "error";
  }
  const ahora = new Date().toISOString();
  const { error } = await admin
    .from("solutions_instagram_cuentas")
    .update({
      token_cifrado: cifrar(r.data.access_token, clave),
      token_vence_en: venceEnDesde(r.data.expires_in),
      token_refrescado_en: ahora,
      estado: "conectada",
      estado_nota: null,
      actualizada_en: ahora,
    })
    .eq("id", cuentaId);
  return error ? "error" : "refrescado";
}

/** Las cuentas activas cuyo token está por vencer: lo que recorre el cron. */
export async function cuentasPorRefrescar(admin: Admin): Promise<string[]> {
  const limite = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("solutions_instagram_cuentas")
    .select("id")
    .eq("activa", true)
    .lte("token_vence_en", limite)
    .limit(200);
  return (data ?? []).map((f) => String(f.id));
}
