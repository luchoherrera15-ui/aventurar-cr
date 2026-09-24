import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Documento } from "./invitacion/esquema";

/**
 * ══════════════════════════════════════════════════════════════════
 *  PARTNERS — lecturas (0247)
 * ══════════════════════════════════════════════════════════════════
 *
 * Un partner es una cuenta de CELEBRAR con ficha en `celebrar_partners`.
 * Aplica → `pendiente`; el equipo aprueba → `aprobado` (y fija su
 * descuento). Todo lo que da el programa —paquetes mayoristas, marca en
 * las invitaciones, plantillas propias, directorio— pregunta primero
 * `esPartnerAprobado()`.
 */

export const TIPOS_PARTNER = [
  ["planner", "Wedding / event planner"],
  ["agencia", "Agencia de eventos"],
  ["fotografia", "Fotografía y video"],
  ["lugar", "Salón, finca o venue"],
  ["diseno", "Diseño e invitaciones"],
  ["catering", "Catering y repostería"],
  ["otro", "Otro"],
] as const;

export type TipoPartner = (typeof TIPOS_PARTNER)[number][0];
export type EstadoPartner = "pendiente" | "aprobado" | "suspendido" | "rechazado";

export type Partner = {
  id: string;
  nombre_comercial: string;
  slug: string | null;
  tipo: TipoPartner;
  ciudad: string | null;
  sitio: string | null;
  instagram: string | null;
  whatsapp: string | null;
  descripcion: string | null;
  logo_url: string | null;
  eventos_por_anio: number | null;
  estado: EstadoPartner;
  descuento_pct: number;
  notas_admin: string | null;
  aprobado_en: string | null;
  marca_en_invitaciones: boolean;
  mostrar_en_directorio: boolean;
  created_at: string;
};

export const miPartner = cache(async (): Promise<Partner | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("celebrar_partners").select("*").eq("id", user.id).maybeSingle();
  if (error) {
    console.error("[celebrar] miPartner:", error.message);
    return null;
  }
  return (data as Partner | null) ?? null;
});

/** El partner aprobado de la sesión, o null. Lo que da el programa pregunta esto. */
export const partnerAprobado = cache(async (): Promise<Partner | null> => {
  const p = await miPartner();
  return p && p.estado === "aprobado" ? p : null;
});

/** La marca a mostrar en una invitación pública (RPC anónima). */
export type MarcaPartner = { nombre_comercial: string; slug: string | null; sitio: string | null; instagram: string | null; whatsapp: string | null; logo_url: string | null };

export async function partnerDeCelebracion(slug: string): Promise<MarcaPartner | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_partner_de", { p_slug: slug });
  if (error) {
    console.error("[celebrar] partnerDeCelebracion:", error.message);
    return null;
  }
  const fila = (Array.isArray(data) ? data[0] : data) as MarcaPartner | undefined;
  return fila ?? null;
}

export type PartnerDirectorio = MarcaPartner & { tipo: TipoPartner; ciudad: string | null; descripcion: string | null };

export async function directorioPartners(): Promise<PartnerDirectorio[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_partners_directorio");
  if (error) {
    console.error("[celebrar] directorioPartners:", error.message);
    return [];
  }
  return (data ?? []) as PartnerDirectorio[];
}

export type PartnerAdmin = Partner & { correo: string; saldo: number; celebraciones: number; publicadas: number };

export async function partnersAdmin(): Promise<PartnerAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("celebrar_admin_partners");
  if (error) {
    console.error("[celebrar] partnersAdmin:", error.message);
    return [];
  }
  return (data ?? []) as PartnerAdmin[];
}

/* ── Las plantillas propias del partner ─────────────────────────── */

export type PlantillaPartner = {
  id: string;
  partner_id: string;
  nombre: string;
  tipo: string | null;
  documento: Documento;
  created_at: string;
  updated_at: string;
};

export const misPlantillasPartner = cache(async (): Promise<PlantillaPartner[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("celebrar_partner_plantillas")
    .select("id, partner_id, nombre, tipo, documento, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[celebrar] misPlantillasPartner:", error.message);
    return [];
  }
  return (data ?? []) as PlantillaPartner[];
});

export async function plantillaPartnerPorId(id: string): Promise<PlantillaPartner | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("celebrar_partner_plantillas").select("id, partner_id, nombre, tipo, documento, created_at, updated_at").eq("id", id).maybeSingle();
  return (data as PlantillaPartner | null) ?? null;
}

/** El texto del tipo para mostrar. */
export function nombreTipoPartner(tipo: string): string {
  return TIPOS_PARTNER.find(([id]) => id === tipo)?.[1] ?? "Partner";
}

/** A dónde manda la firma del partner: su sitio, si no Instagram, si no su WhatsApp. */
export function urlDePartner(p: { sitio: string | null; instagram: string | null; whatsapp: string | null }): string | null {
  if (p.sitio) return p.sitio;
  if (p.instagram) return `https://instagram.com/${p.instagram.replace(/^@/, "")}`;
  if (p.whatsapp) {
    const n = p.whatsapp.replace(/\D/g, "");
    return n ? `https://wa.me/${n.length <= 8 ? `506${n}` : n}` : null;
  }
  return null;
}
