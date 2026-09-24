import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Celebracion, Invitacion, NivelPlantilla, PerfilCelebrar, Plantilla } from "./tipos";

/**
 * Las lecturas del panel de CELEBRAR. Todas van con el cliente de la
 * persona (su token, sus cookies): RLS decide qué ve. Ninguna usa
 * service_role.
 *
 * `tablaFalta`: mientras la migración 0242 no esté aplicada en la base
 * que usa este entorno, PostgREST responde «relation does not exist»
 * (42P01) o «Could not find the table» (PGRST205). En vez de reventar
 * el panel, se devuelve vacío y se avisa una vez por proceso — así el
 * shell se puede mirar antes de tocar la base.
 */

let avisado = false;
function tablaFalta(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const falta =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|Could not find the table/i.test(error.message ?? "");
  if (falta && !avisado) {
    avisado = true;
    console.warn(
      "[celebrar] Las tablas celebrar_* no existen en esta base todavía: falta aplicar la migración 0242.",
    );
  }
  return falta;
}

export const misCelebraciones = cache(async (): Promise<Celebracion[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_celebraciones")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (tablaFalta(error)) return [];
    throw error;
  }
  return (data ?? []) as Celebracion[];
});

export const celebracionPorId = cache(async (id: string): Promise<Celebracion | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_celebraciones")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    if (tablaFalta(error)) return null;
    // Un id que no es uuid válido: para la persona es «no existe».
    if (error.code === "22P02") return null;
    throw error;
  }
  return (data as Celebracion | null) ?? null;
});

export const miPerfilCelebrar = cache(async (): Promise<PerfilCelebrar | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_perfiles")
    .select("id, nombre_publico, whatsapp, pais, moneda, acepta_marketing, onboarding")
    .maybeSingle();
  if (error) {
    if (tablaFalta(error)) return null;
    throw error;
  }
  return (data as PerfilCelebrar | null) ?? null;
});

export const plantillasActivas = cache(async (): Promise<Plantilla[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_plantillas")
    .select(
      "id, slug, nombre, categoria_id, nivel, costo_creditos, tipos_evento, descripcion, preview_url, esquema, estilos, version, orden",
    )
    .eq("activa", true)
    .order("orden", { ascending: true });
  if (error) {
    if (tablaFalta(error)) return [];
    throw error;
  }
  return (data ?? []) as Plantilla[];
});

/** ¿Ya está la base de CELEBRAR en este entorno? Lo usa el panel para avisar. */
export const baseListaCelebrar = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { error } = await supabase.from("celebrar_plantilla_categorias").select("id").limit(1);
  return !tablaFalta(error);
});

/** El documento de la invitación de una celebración (tipo 'invitacion'), o null si todavía no eligió plantilla. */
export const invitacionDe = cache(async (celebracionId: string): Promise<Invitacion | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_invitaciones")
    .select("id, celebracion_id, tipo, contenido, plantilla_slug, version, publicada_en, updated_at")
    .eq("celebracion_id", celebracionId)
    .eq("tipo", "invitacion")
    .maybeSingle();
  if (error) {
    if (tablaFalta(error)) return null;
    if (error.code === "22P02") return null;
    throw error;
  }
  return (data as Invitacion | null) ?? null;
});

/**
 * ══════════════════════════════════════════════════════════════════
 *  EL CATÁLOGO — consultas livianas y paginadas
 * ══════════════════════════════════════════════════════════════════
 *
 * Son ~2 000 diseños (20 por tipo y estilo): traerlos enteros mataba la
 * página —PostgREST además corta en 1 000 filas y los conteos salían
 * mal—. Para las tarjetas alcanza con el estilo y la PORTADA (la primera
 * sección del esquema, que PostgREST sabe proyectar). El documento
 * completo se pide recién al elegir (`plantillaPorSlug`).
 */
export type PlantillaCatalogo = {
  id: string;
  slug: string;
  nombre: string;
  categoria_id: string;
  nivel: NivelPlantilla;
  tipos_evento: string[];
  descripcion: string | null;
  estilos: Record<string, unknown>;
  portada: Record<string, unknown> | null;
};

const CAMPOS_CATALOGO = "id, slug, nombre, categoria_id, nivel, tipos_evento, descripcion, estilos, portada:esquema->secciones->0";

export async function catalogoPlantillas(filtros: { tipo?: string; categoria?: string; desde?: number; limite?: number } = {}): Promise<PlantillaCatalogo[]> {
  const supabase = await createClient();
  const desde = filtros.desde ?? 0;
  const limite = filtros.limite ?? 40;
  let q = supabase.from("celebrar_plantillas").select(CAMPOS_CATALOGO).eq("activa", true);
  if (filtros.tipo) q = q.contains("tipos_evento", [filtros.tipo]);
  if (filtros.categoria) q = q.eq("categoria_id", filtros.categoria);
  const { data, error } = await q.order("orden", { ascending: true }).range(desde, desde + limite - 1);
  if (error) {
    if (tablaFalta(error)) return [];
    console.error("[celebrar] catalogoPlantillas:", error.message);
    return [];
  }
  return (data ?? []) as unknown as PlantillaCatalogo[];
}

/** Cuántos diseños hay por estilo (con el tipo elegido, si lo hay). Solo la columna de la categoría. */
export async function conteosPorCategoria(tipo?: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const cuenta = new Map<string, number>();
  for (let desde = 0; ; desde += 1000) {
    let q = supabase.from("celebrar_plantillas").select("categoria_id").eq("activa", true);
    if (tipo) q = q.contains("tipos_evento", [tipo]);
    const { data, error } = await q.range(desde, desde + 999);
    if (error) {
      if (!tablaFalta(error)) console.error("[celebrar] conteosPorCategoria:", error.message);
      return cuenta;
    }
    for (const f of data ?? []) cuenta.set(f.categoria_id, (cuenta.get(f.categoria_id) ?? 0) + 1);
    if (!data || data.length < 1000) break;
  }
  return cuenta;
}

/** Las plantillas activas recomendadas para un tipo de celebración (o todas si el tipo no tiene). */
export const plantillasParaTipo = cache(async (tipo: string, categoria?: string): Promise<PlantillaCatalogo[]> => {
  const propias = await catalogoPlantillas({ tipo, categoria, limite: 60 });
  if (propias.length > 0) return propias;
  return catalogoPlantillas({ categoria, limite: 60 });
});

export const plantillaPorSlug = cache(async (slug: string): Promise<Plantilla | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_plantillas")
    .select(
      "id, slug, nombre, categoria_id, nivel, costo_creditos, tipos_evento, descripcion, preview_url, esquema, estilos, version, orden",
    )
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  if (error) {
    if (tablaFalta(error)) return null;
    throw error;
  }
  return (data as Plantilla | null) ?? null;
});

/* ── Créditos (0245) ───────────────────────────────────────────── */

export type MovimientoCreditos = {
  id: string;
  celebracion_id: string | null;
  tipo: "compra" | "consumo" | "regalo" | "ajuste" | "reembolso";
  cantidad: number;
  concepto: string;
  referencia: string | null;
  /** Colones que entraron con este movimiento (solo compras, 0246). */
  monto_crc: number | null;
  created_at: string;
};

/** El saldo de créditos de la persona (suma de sus movimientos). */
export const saldoCreditos = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_saldo");
  if (error) {
    if (!tablaFalta(error)) console.error("[celebrar] saldoCreditos:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
});

export const movimientosCreditos = cache(async (): Promise<MovimientoCreditos[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_creditos_movimientos")
    .select("id, celebracion_id, tipo, cantidad, concepto, referencia, monto_crc, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    if (!tablaFalta(error)) console.error("[celebrar] movimientosCreditos:", error.message);
    return [];
  }
  return (data ?? []) as MovimientoCreditos[];
});

/* ── Confirmaciones (0245) ─────────────────────────────────────── */

export type Confirmacion = {
  id: string;
  celebracion_id: string;
  nombre: string;
  asiste: boolean;
  personas: number;
  respuestas: Record<string, string>;
  mensaje: string | null;
  contacto: string | null;
  origen: "pagina" | "manual" | "whatsapp";
  created_at: string;
};

export const confirmacionesDe = cache(async (celebracionId: string): Promise<Confirmacion[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_confirmaciones")
    .select("*")
    .eq("celebracion_id", celebracionId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) {
    if (!tablaFalta(error)) console.error("[celebrar] confirmacionesDe:", error.message);
    return [];
  }
  return (data ?? []).map((c) => ({ ...c, respuestas: (c.respuestas && typeof c.respuestas === "object" ? c.respuestas : {}) as Record<string, string> })) as Confirmacion[];
});

/** Cuántas confirmaciones tiene cada celebración de la persona (para las tarjetas). */
export const conteoConfirmaciones = cache(async (): Promise<Record<string, { confirmados: number; personas: number; noAsisten: number }>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("celebrar_confirmaciones").select("celebracion_id, asiste, personas").limit(5000);
  if (error) {
    if (!tablaFalta(error)) console.error("[celebrar] conteoConfirmaciones:", error.message);
    return {};
  }
  const salida: Record<string, { confirmados: number; personas: number; noAsisten: number }> = {};
  for (const r of data ?? []) {
    const s = (salida[r.celebracion_id] ??= { confirmados: 0, personas: 0, noAsisten: 0 });
    if (r.asiste) {
      s.confirmados += 1;
      s.personas += r.personas ?? 0;
    } else s.noAsisten += 1;
  }
  return salida;
});
