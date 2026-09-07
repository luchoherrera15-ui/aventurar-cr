import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { claveDesdeTexto, descifrar } from "./cifrado";
import type { ConfigMeta } from "./config";
import { marcarEstadoCuenta } from "./cuentas";
import { enviarRespuestaPrivada, responderComentario } from "./meta";
import type { AutomatizacionMotor, CuentaMotor, DepsMotor, RegistroEvento } from "./motor";
import { MAX_INTENTOS } from "./motor";
import { disparadorDe, modoCoincidenciaDe, TOPES_IG, type CodigoErrorMeta } from "./tipos";

/**
 * LAS DEPENDENCIAS REALES DEL MOTOR — Supabase con la llave de servicio
 * y Graph. Es la única implementación de `DepsMotor` que habla con el
 * mundo; motor.test.ts usa fingidas. Nada de acá decide reglas: las
 * reglas viven en motor.ts.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const TRANSITORIOS: ReadonlySet<CodigoErrorMeta> = new Set(["rate_limit", "api_no_disponible"]);

export function depsReales(admin: Admin, cfg: ConfigMeta): DepsMotor {
  const clave = claveDesdeTexto(cfg.claveTokens);

  return {
    async buscarCuenta(igUserId): Promise<CuentaMotor | null> {
      const { data } = await admin
        .from("solutions_instagram_cuentas")
        .select("id, negocio_id, ig_user_id, activa, estado, token_vence_en, token_cifrado")
        .eq("ig_user_id", igUserId)
        .maybeSingle();
      if (!data) return null;
      const f = data as Record<string, unknown>;
      const blob = typeof f.token_cifrado === "string" ? f.token_cifrado : "";
      return {
        id: String(f.id),
        negocioId: String(f.negocio_id),
        igUserId: String(f.ig_user_id),
        activa: f.activa === true,
        estado: (f.estado as CuentaMotor["estado"]) ?? "conectada",
        tokenVenceEn: String(f.token_vence_en),
        token: clave && blob ? descifrar(blob, clave) : null,
      };
    },

    async automatizaciones(cuentaId, mediaId): Promise<AutomatizacionMotor[]> {
      if (!mediaId) return [];
      const { data } = await admin
        .from("solutions_instagram_automatizaciones")
        .select("id, activa, media_id, disparador, modo_coincidencia, mensaje_privado, enlace, respuesta_publica, mensaje_publico")
        .eq("cuenta_id", cuentaId)
        .eq("media_id", mediaId)
        .eq("activa", true)
        .order("creada_en", { ascending: true });
      const filas = (data ?? []) as Record<string, unknown>[];
      if (filas.length === 0) return [];
      const ids = filas.map((f) => String(f.id));
      const { data: palabras } = await admin.from("solutions_instagram_palabras").select("automatizacion_id, palabra").in("automatizacion_id", ids);
      const porAuto = new Map<string, string[]>();
      for (const p of (palabras ?? []) as Record<string, unknown>[]) {
        const k = String(p.automatizacion_id);
        porAuto.set(k, [...(porAuto.get(k) ?? []), String(p.palabra)]);
      }
      return filas.map((f) => ({
        id: String(f.id),
        activa: f.activa === true,
        mediaId: String(f.media_id),
        disparador: disparadorDe(f.disparador),
        modo: modoCoincidenciaDe(f.modo_coincidencia),
        palabras: porAuto.get(String(f.id)) ?? [],
        mensajePrivado: String(f.mensaje_privado ?? ""),
        enlace: (f.enlace as string | null) ?? null,
        respuestaPublica: f.respuesta_publica === true,
        mensajePublico: (f.mensaje_publico as string | null) ?? null,
      }));
    },

    /**
     * El INSERT que hace la idempotencia. Si el índice único lo frena
     * (23505), se mira la fila que ya existe: un error transitorio con
     * intentos de sobra es un «reintento»; cualquier otra cosa es un
     * «duplicado» y no se toca.
     */
    async registrar(r: RegistroEvento) {
      const fila = {
        negocio_id: r.negocioId,
        cuenta_id: r.cuentaId,
        automatizacion_id: r.automatizacionId,
        comentario_id: r.comentario.comentarioId,
        ig_usuario_id: r.comentario.deId,
        ig_usuario_username: r.comentario.deUsername ? r.comentario.deUsername.slice(0, 80) : null,
        media_id: r.comentario.mediaId,
        texto_comentario: r.comentario.texto ? r.comentario.texto.slice(0, TOPES_IG.textoComentario) : null,
        palabra_coincidente: r.palabra,
        resultado: r.resultado,
        intentos: 1,
        procesado_en: r.resultado === "pendiente" ? null : new Date().toISOString(),
      };
      const { data, error } = await admin.from("solutions_instagram_eventos").insert(fila).select("id").single();
      if (!error && data) return { estado: "nuevo" as const, eventoId: String(data.id), intentos: 1 };
      if (error?.code !== "23505") {
        // Sin fila no hay idempotencia: mejor no mandar que mandar dos veces.
        return { estado: "duplicado" as const, eventoId: null, intentos: 0 };
      }
      let consulta = admin
        .from("solutions_instagram_eventos")
        .select("id, resultado, error_codigo, intentos")
        .eq("cuenta_id", r.cuentaId)
        .eq("comentario_id", r.comentario.comentarioId);
      consulta = r.automatizacionId ? consulta.eq("automatizacion_id", r.automatizacionId) : consulta.is("automatizacion_id", null);
      const { data: previa } = await consulta.maybeSingle();
      if (!previa) return { estado: "duplicado" as const, eventoId: null, intentos: 0 };
      const p = previa as Record<string, unknown>;
      const intentos = Number(p.intentos ?? 1);
      const transitorio = p.resultado === "error" && TRANSITORIOS.has(p.error_codigo as CodigoErrorMeta);
      if (!transitorio || intentos >= MAX_INTENTOS) return { estado: "duplicado" as const, eventoId: String(p.id), intentos };
      await admin.from("solutions_instagram_eventos").update({ intentos: intentos + 1, resultado: "pendiente" }).eq("id", String(p.id));
      return { estado: "reintento" as const, eventoId: String(p.id), intentos: intentos + 1 };
    },

    async enviosUltimaHora(cuentaId) {
      const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("solutions_instagram_eventos")
        .select("id", { count: "exact", head: true })
        .eq("cuenta_id", cuentaId)
        .eq("dm_enviado", true)
        .gte("procesado_en", desde);
      return count ?? 0;
    },

    async enviarPrivada(cuenta, comentarioId, texto) {
      if (!cuenta.token) return { ok: false, error: { codigo: "token_vencido", mensaje: "Sin token.", transitorio: false } };
      const r = await enviarRespuestaPrivada(cfg, cuenta.igUserId, cuenta.token, comentarioId, texto);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, mensajeId: String(r.data.message_id ?? "") };
    },

    async responderPublico(cuenta, comentarioId, texto) {
      if (!cuenta.token) return { ok: false, error: { codigo: "token_vencido", mensaje: "Sin token.", transitorio: false } };
      const r = await responderComentario(cfg, comentarioId, cuenta.token, texto);
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, id: String(r.data.id ?? "") };
    },

    async marcar(eventoId, cambios) {
      await admin.from("solutions_instagram_eventos").update(cambios).eq("id", eventoId);
    },

    async marcarCuenta(cuentaId, estado, nota) {
      await marcarEstadoCuenta(admin, cuentaId, estado, nota);
    },
  };
}
