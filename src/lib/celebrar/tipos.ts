import type { TipoCelebracionId } from "./marca";

/** Filas de las tablas `celebrar_*` (migración 0242), tal como las devuelve Supabase. */

export type EstadoCelebracion = "borrador" | "publicada" | "finalizada" | "recuerdos" | "archivada";

export type Celebracion = {
  id: string;
  owner_id: string;
  tipo: TipoCelebracionId;
  nombre: string;
  slug: string;
  fecha: string | null;
  hora: string | null;
  zona_horaria: string;
  lugar_nombre: string | null;
  direccion: string | null;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
  portada_asset_id: string | null;
  descripcion: string | null;
  plantilla_id: string | null;
  /** Lo que se pagó por publicar: {plan, creditos, en} (0245). */
  pago_publicacion: unknown;
  plantilla_version: number | null;
  tema: Record<string, unknown>;
  config: Record<string, unknown>;
  estado: EstadoCelebracion;
  publicada_en: string | null;
  expira_en: string | null;
  created_at: string;
  updated_at: string;
};

export type PerfilCelebrar = {
  id: string;
  nombre_publico: string | null;
  whatsapp: string | null;
  pais: string;
  moneda: string;
  acepta_marketing: boolean;
  onboarding: Record<string, unknown>;
};

export type NivelPlantilla = "gratis" | "premium" | "exclusiva" | "personalizada";

export type Plantilla = {
  id: string;
  slug: string;
  nombre: string;
  categoria_id: string;
  nivel: NivelPlantilla;
  costo_creditos: number;
  tipos_evento: string[];
  descripcion: string | null;
  preview_url: string | null;
  esquema: { secciones?: string[] } & Record<string, unknown>;
  estilos: { fondo?: string; tinta?: string; acento?: string; letra?: string } & Record<string, unknown>;
  version: number;
  orden: number;
};

export const ESTADO_TEXTO: Record<EstadoCelebracion, string> = {
  borrador: "Borrador",
  publicada: "Publicada",
  finalizada: "Finalizada",
  recuerdos: "Recuerdos",
  archivada: "Archivada",
};

export type Invitacion = {
  id: string;
  celebracion_id: string;
  tipo: "invitacion" | "save_the_date" | "recuerdos";
  /** Un Documento (ver invitacion/esquema.ts), sin normalizar todavía. */
  contenido: unknown;
  plantilla_slug: string | null;
  version: number;
  publicada_en: string | null;
  updated_at: string;
};
