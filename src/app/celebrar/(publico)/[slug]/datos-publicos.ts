import "server-only";
import { cache } from "react";
import { normalizarDocumento, type Documento } from "@/lib/celebrar/invitacion/esquema";
import { createAnonClient } from "@/lib/supabase/server";

export type InvitacionPublica = {
  id: string;
  slug: string;
  slug_actual: boolean;
  tipo: string;
  nombre: string;
  fecha: string | null;
  hora: string | null;
  lugar_nombre: string | null;
  direccion: string | null;
  maps_url: string | null;
  estado: string;
  publicada_en: string | null;
  documento: Documento;
};

/**
 * Lo que un invitado puede ver, por la RPC `celebrar_invitacion_publica`
 * (security definer: solo celebraciones publicadas, nunca datos de la
 * cuenta). Con la llave anónima y sin cookies, así la página puede ser
 * estática. Cacheado por petición: la página y su metadata lo comparten.
 */
export const invitacionPublicaPorSlug = cache(async (slug: string): Promise<InvitacionPublica | null> => {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(slug)) return null;
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("celebrar_invitacion_publica", { p_slug: slug });
  if (error) {
    console.error("[celebrar] invitacion_publica:", error.message);
    return null;
  }
  const fila = (Array.isArray(data) ? data[0] : data) as (Omit<InvitacionPublica, "documento"> & { contenido: unknown }) | undefined;
  if (!fila) return null;
  const { contenido, ...resto } = fila;
  return { ...resto, documento: normalizarDocumento(contenido) };
});
