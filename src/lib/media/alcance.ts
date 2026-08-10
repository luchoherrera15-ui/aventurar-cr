/**
 * BOOKEA MEDIA — qué está habilitado HOY (piloto 3.1A).
 *
 * `MIMES_PERMITIDOS` y `ENTIDADES` (tipos.ts) describen lo que el
 * SISTEMA sabe manejar. Esto describe lo que el flujo nuevo atiende hoy,
 * que es menos a propósito.
 *
 * La diferencia importa para el usuario: pedir algo que el sistema no
 * conoce es un error del cliente (400); pedir algo que existe pero
 * todavía no está encendido es otra cosa (**422**), y merece un mensaje
 * distinto porque va a funcionar más adelante sin que nadie cambie su
 * petición.
 *
 * ── LO QUE SIGUE EN EL FLUJO LEGACY, Y ES TEMPORAL ───────────────────
 *
 *   album         los invitados suben sin cuenta; necesita el token
 *                 compartido, que es el bloque siguiente. Es el mayor
 *                 volumen medido (118,5 MB en un solo álbum).
 *   comprobante   también anónimo.
 *   invitacion    solo admin; entra después.
 *   verificacion  cédulas; entra después.
 *   video/audio   su firma siempre da `inconcluso` (no se puede
 *                 demostrar que haya pista sin parsear `moov`), así que
 *                 no podrían llegar a `listo`. Se rechazan en la puerta
 *                 en vez de dejar archivos atascados.
 *
 * Módulo neutral: sin red, sin secretos, sin server-only.
 */

import { esEntidad, esMimePermitido, type EntidadMedia, type MimePermitido } from "./tipos";

/** Las tres entidades del piloto. */
export const ENTIDADES_3_1A = ["rancho", "rancho_item", "equipo"] as const;

export type EntidadPiloto = (typeof ENTIDADES_3_1A)[number];

/** Solo imágenes: los seis formatos aprobados. */
export const MIMES_3_1A = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export type MimePiloto = (typeof MIMES_3_1A)[number];

/**
 * Los límites de producto, tal como están HOY en el código.
 *
 *   rancho       8, que es `FOTOS_MAX` de src/app/mi-negocio/types.tsx.
 *   rancho_item  1, porque `rancho_items.foto_url` es UNA columna.
 *   equipo       1, ídem con `equipo_rancho.foto_url`.
 *
 * Se repiten acá y en la 0112 a propósito: la base es la que manda —es
 * la única que puede contar sin carreras— y esto sirve para que el
 * endpoint pueda avisar antes de ir a la base. Si alguna vez difieren,
 * gana la base y el usuario ve un 409; nunca al revés.
 */
export const LIMITE_POR_ENTIDAD: Record<EntidadPiloto, number> = {
  rancho: 8,
  rancho_item: 1,
  equipo: 1,
};

export const esEntidadPiloto = (v: unknown): v is EntidadPiloto =>
  typeof v === "string" && (ENTIDADES_3_1A as readonly string[]).includes(v);

export const esMimePiloto = (v: unknown): v is MimePiloto =>
  typeof v === "string" && (MIMES_3_1A as readonly string[]).includes(v);

export type MotivoFueraDeAlcance =
  | "entidad-desconocida"
  | "entidad-no-habilitada"
  | "mime-desconocido"
  | "mime-no-habilitado";

export type RevisionAlcance =
  | { ok: true; entidad: EntidadPiloto; mime: MimePiloto }
  | { ok: false; motivo: MotivoFueraDeAlcance; http: 400 | 422; mensaje: string };

/**
 * Decide si una petición entra en el piloto, y con qué código.
 *
 * Distingue las cuatro razones porque el HTTP y el mensaje cambian:
 * "esto no existe" (400) no es lo mismo que "esto todavía no está
 * encendido" (422), y un usuario que sube un video merece que se lo
 * digan así y no con un "datos inválidos".
 */
export function revisarAlcance(entidad: unknown, mime: unknown): RevisionAlcance {
  const mimeLimpio = typeof mime === "string" ? mime.toLowerCase().split(";")[0].trim() : mime;

  if (!esEntidad(entidad)) {
    return {
      ok: false,
      motivo: "entidad-desconocida",
      http: 400,
      mensaje: "Datos inválidos.",
    };
  }
  if (!esEntidadPiloto(entidad)) {
    return {
      ok: false,
      motivo: "entidad-no-habilitada",
      http: 422,
      mensaje: "Todavía no se pueden subir fotos así por acá.",
    };
  }
  if (!esMimePermitido(mimeLimpio)) {
    return {
      ok: false,
      motivo: "mime-desconocido",
      http: 400,
      mensaje: "Ese tipo de archivo no se puede subir.",
    };
  }
  if (!esMimePiloto(mimeLimpio)) {
    return {
      ok: false,
      motivo: "mime-no-habilitado",
      http: 422,
      mensaje: "Por ahora solo se pueden subir fotos por acá.",
    };
  }
  return { ok: true, entidad, mime: mimeLimpio };
}

/**
 * El límite de producto de una entidad del piloto. Sirve para avisar
 * antes de ir a la base; la cuenta de verdad la hace `media_reservar`
 * con el advisory lock tomado.
 */
export function limiteDe(entidad: EntidadPiloto): number {
  return LIMITE_POR_ENTIDAD[entidad];
}

/** Para el informe de lo que falta: qué quedó fuera y por qué. */
export const PENDIENTES_FUERA_DE_3_1A: Readonly<Record<Exclude<EntidadMedia, EntidadPiloto>, string>> =
  {
    album: "Necesita el token compartido: los invitados suben sin cuenta.",
    invitacion: "Solo admin; entra en un bloque posterior.",
    comprobante: "Subida anónima; necesita el mismo trabajo que los álbumes.",
    verificacion: "Documentos privados; entra en un bloque posterior.",
  };

/** Los MIME que el sistema conoce pero el piloto no atiende. */
export function mimesPendientes(): MimePermitido[] {
  return (
    ["video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/ogg"] as const
  ).slice();
}
