import { TIPOS_CELEBRACION, type TipoCelebracionId } from "./marca";
import { veredictoSlug } from "./slug";

/**
 * La validación del asistente de creación y de la edición básica, como
 * función PURA (sin base, sin red) para que se pueda probar. La base
 * vuelve a validar lo suyo (slug libre, dueño, tipos); acá se atajan los
 * errores antes de ir a la red y se les da voz en español.
 */

export type DatosCelebracion = {
  tipo: string;
  nombre: string;
  slug: string;
  fecha: string; // "YYYY-MM-DD" o ""
  hora: string; // "HH:MM" o ""
  lugarNombre: string;
  direccion: string;
  mapsUrl: string;
};

export type Errores = Partial<Record<keyof DatosCelebracion, string>>;

export type ResultadoValidacion =
  | { ok: true; datos: DatosCelebracion & { tipo: TipoCelebracionId } }
  | { ok: false; errores: Errores };

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function esTipoCelebracion(valor: unknown): valor is TipoCelebracionId {
  return TIPOS_CELEBRACION.some((t) => t.id === valor);
}

export function validarCelebracion(entrada: Record<string, unknown>): ResultadoValidacion {
  const texto = (k: string) => (typeof entrada[k] === "string" ? (entrada[k] as string).trim() : "");
  const datos: DatosCelebracion = {
    tipo: texto("tipo"),
    nombre: texto("nombre"),
    slug: texto("slug").toLowerCase(),
    fecha: texto("fecha"),
    hora: texto("hora"),
    lugarNombre: texto("lugarNombre"),
    direccion: texto("direccion"),
    mapsUrl: texto("mapsUrl"),
  };
  const errores: Errores = {};

  if (!esTipoCelebracion(datos.tipo)) errores.tipo = "Elegí qué están celebrando.";
  if (datos.nombre.length < 2) errores.nombre = "Contanos cómo se llama la celebración.";
  if (datos.nombre.length > 120) errores.nombre = "Máximo 120 caracteres.";

  const slug = veredictoSlug(datos.slug);
  if (!slug.ok) errores.slug = slug.motivo;

  if (datos.fecha && !FECHA_ISO.test(datos.fecha)) errores.fecha = "La fecha no tiene el formato esperado.";
  if (datos.hora && !HORA.test(datos.hora)) errores.hora = "La hora no tiene el formato esperado.";
  if (datos.lugarNombre.length > 160) errores.lugarNombre = "Máximo 160 caracteres.";
  if (datos.direccion.length > 300) errores.direccion = "Máximo 300 caracteres.";
  if (datos.mapsUrl && !/^https?:\/\/\S+$/i.test(datos.mapsUrl)) {
    errores.mapsUrl = "Pegá el link completo de Google Maps o Waze (empieza con https://).";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos: { ...datos, tipo: datos.tipo as TipoCelebracionId } };
}
