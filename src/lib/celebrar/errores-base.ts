import type { Errores } from "./validar-celebracion";

export type RespuestaDeBase = { errores?: Errores; mensaje?: string };

/**
 * Qué decirle a la persona según lo que devolvió la base al crear o
 * guardar una celebración. Primero lo técnico (tabla o función ausente:
 * falta la migración), después los mensajes que la propia base escribe
 * para la persona («Esa dirección…»), que van al campo del slug.
 *
 * El orden importa: el texto crudo de un error técnico puede contener
 * «p_direccion» y, con una regla ingenua, se mostraba entero dentro del
 * campo de la dirección. Pasó de verdad el 20 sep 2026.
 */
export function traducirErrorDeBase(mensaje: string, codigo?: string | null): RespuestaDeBase {
  if (/does not exist|Could not find|schema cache/i.test(mensaje)) {
    return {
      mensaje:
        "La base de datos de CELEBRAR todavía no está lista en este entorno: falta aplicar la migración 0242. Hasta entonces no se pueden crear ni guardar celebraciones.",
    };
  }
  if (codigo === "23505" || /duplicate key/i.test(mensaje)) {
    return { errores: { slug: "Esa dirección ya está tomada. Probá con otra." } };
  }
  if (/^Esa direcci[oó]n/i.test(mensaje)) return { errores: { slug: mensaje } };
  return { mensaje: mensaje || "No se pudo guardar. Probá de nuevo." };
}
