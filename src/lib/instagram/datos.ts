import type { createAdminClient } from "@/lib/supabase/admin";
import type { AutomatizacionIg, EventoIg, ResumenAutomatizacion } from "./tipos";
import { codigoErrorDe, disparadorDe, modoCoincidenciaDe } from "./tipos";

/**
 * LAS LECTURAS DEL PANEL Y LAS ESTADÍSTICAS.
 *
 * Las funciones de agregación son puras (probadas en datos.test.ts);
 * las de lectura reciben el cliente admin y devuelven filas ya tipadas
 * y saneadas. Ninguna toca el token: eso es de cuentas.ts.
 */

type Consulta = NonNullable<ReturnType<typeof createAdminClient>>;

export async function automatizacionesDelNegocio(admin: Consulta, negocioId: string): Promise<AutomatizacionIg[]> {
  const { data } = await admin
    .from("solutions_instagram_automatizaciones")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("creada_en", { ascending: false })
    .limit(200);
  const filas = ((data ?? []) as Record<string, unknown>[]).map(automatizacionDe);
  if (filas.length === 0) return [];
  const { data: palabras } = await admin
    .from("solutions_instagram_palabras")
    .select("automatizacion_id, palabra, creada_en")
    .in("automatizacion_id", filas.map((f) => f.id));
  const porAuto = new Map<string, string[]>();
  for (const p of (palabras ?? []) as Record<string, unknown>[]) {
    const k = String(p.automatizacion_id);
    porAuto.set(k, [...(porAuto.get(k) ?? []), String(p.palabra)]);
  }
  return filas.map((f) => ({ ...f, palabras: porAuto.get(f.id) ?? [] }));
}

export async function eventosDelNegocio(admin: Consulta, negocioId: string, limite = 500): Promise<EventoIg[]> {
  const { data } = await admin
    .from("solutions_instagram_eventos")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  return ((data ?? []) as Record<string, unknown>[]).map(eventoDe);
}

export function automatizacionDe(f: Record<string, unknown>): AutomatizacionIg {
  return {
    id: String(f.id),
    negocio_id: String(f.negocio_id),
    cuenta_id: String(f.cuenta_id),
    nombre: String(f.nombre ?? ""),
    media_id: String(f.media_id ?? ""),
    media_permalink: (f.media_permalink as string | null) ?? null,
    media_resumen: (f.media_resumen as string | null) ?? null,
    media_miniatura_url: (f.media_miniatura_url as string | null) ?? null,
    disparador: disparadorDe(f.disparador),
    modo_coincidencia: modoCoincidenciaDe(f.modo_coincidencia),
    mensaje_privado: String(f.mensaje_privado ?? ""),
    enlace: (f.enlace as string | null) ?? null,
    respuesta_publica: f.respuesta_publica === true,
    mensaje_publico: (f.mensaje_publico as string | null) ?? null,
    activa: f.activa === true,
    creada_en: String(f.creada_en ?? ""),
    actualizada_en: String(f.actualizada_en ?? ""),
    palabras: [],
  };
}

export function eventoDe(f: Record<string, unknown>): EventoIg {
  return {
    id: String(f.id),
    negocio_id: String(f.negocio_id),
    cuenta_id: String(f.cuenta_id),
    automatizacion_id: (f.automatizacion_id as string | null) ?? null,
    comentario_id: String(f.comentario_id ?? ""),
    ig_usuario_id: (f.ig_usuario_id as string | null) ?? null,
    ig_usuario_username: (f.ig_usuario_username as string | null) ?? null,
    media_id: (f.media_id as string | null) ?? null,
    texto_comentario: (f.texto_comentario as string | null) ?? null,
    palabra_coincidente: (f.palabra_coincidente as string | null) ?? null,
    resultado: (f.resultado as EventoIg["resultado"]) ?? "pendiente",
    dm_enviado: f.dm_enviado === true,
    dm_mensaje_id: (f.dm_mensaje_id as string | null) ?? null,
    publica_enviada: f.publica_enviada === true,
    publica_comentario_id: (f.publica_comentario_id as string | null) ?? null,
    error_codigo: codigoErrorDe(f.error_codigo),
    error_mensaje: (f.error_mensaje as string | null) ?? null,
    intentos: Number(f.intentos ?? 1),
    procesado_en: (f.procesado_en as string | null) ?? null,
    creado_en: String(f.creado_en ?? ""),
  };
}

// ── Las estadísticas, puras ─────────────────────────────────────────

function vacio(): ResumenAutomatizacion {
  return { comentarios: 0, coincidencias: 0, dms: 0, publicas: 0, errores: 0, tasaExito: null, ultimaActividad: null };
}

function sumar(r: ResumenAutomatizacion, e: EventoIg): void {
  r.comentarios += 1;
  if (e.resultado !== "sin_coincidencia") r.coincidencias += 1;
  if (e.dm_enviado) r.dms += 1;
  if (e.publica_enviada) r.publicas += 1;
  if (e.resultado === "error" || e.resultado === "limite") r.errores += 1;
  if (!r.ultimaActividad || e.creado_en > r.ultimaActividad) r.ultimaActividad = e.creado_en;
}

function cerrar(r: ResumenAutomatizacion): ResumenAutomatizacion {
  r.tasaExito = r.coincidencias > 0 ? Math.round((r.dms / r.coincidencias) * 100) : null;
  return r;
}

/** Un resumen por automatización (los eventos sin automatización no cuentan acá). */
export function resumenPorAutomatizacion(eventos: readonly EventoIg[]): Map<string, ResumenAutomatizacion> {
  const m = new Map<string, ResumenAutomatizacion>();
  for (const e of eventos) {
    if (!e.automatizacion_id) continue;
    const r = m.get(e.automatizacion_id) ?? vacio();
    sumar(r, e);
    m.set(e.automatizacion_id, r);
  }
  for (const [k, r] of m) m.set(k, cerrar(r));
  return m;
}

/** El resumen de la cuenta entera: comentarios, DMs, tasa de respuesta, errores. */
export function resumenGlobal(eventos: readonly EventoIg[]): ResumenAutomatizacion {
  const r = vacio();
  for (const e of eventos) sumar(r, e);
  return cerrar(r);
}
