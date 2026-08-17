/**
 * ZONAS HORARIAS POR PAÍS — hoy es un adaptador, no un catálogo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTE ARCHIVO YA NO TIENE SU PROPIA LISTA
 * ------------------------------------------------------------------
 * Acá vivía un `PAISES` con Costa Rica y sus zonas IANA. Al abrir la
 * plataforma a Latinoamérica apareció OTRO catálogo de países
 * (`src/lib/paises.ts`) con la moneda, el prefijo, las regiones y cómo
 * se llama la división de primer nivel en cada país.
 *
 * Dos catálogos de países es exactamente la duplicación que el proyecto
 * prohíbe, y esta era de las peores: los códigos ni siquiera coincidían
 * —acá `"CR"` en mayúscula, allá `"cr"` en minúscula, que es lo que la
 * base guarda desde la 0170 y lo que va a la URL— así que el día que
 * alguien abriera Panamá en un archivo y no en el otro, el alta habría
 * guardado un país sin zona horaria. Y de la zona horaria dependen la
 * disponibilidad, los recordatorios y los calendarios: un negocio con
 * la zona equivocada agenda citas a la hora equivocada.
 *
 * Ahora la única lista es la de `paises.ts`. Este archivo se queda
 * SOLO como adaptador para los dos lugares que ya lo importaban, con
 * la forma que ellos esperan.
 *
 * ------------------------------------------------------------------
 * TOLERA MAYÚSCULAS A PROPÓSITO
 * ------------------------------------------------------------------
 * El formulario de alta manda `"CR"` y en la base hay filas viejas con
 * `"CR"` (la 0170 las normaliza a minúscula, pero el dueño la pega a
 * mano y hay una ventana en la que conviven las dos formas). Comparar
 * sin normalizar dejaría a esos negocios sin zona horaria.
 */
import { PAISES as CATALOGO, paisDe, PAIS_POR_DEFECTO } from "@/lib/paises";

export type Pais = {
  /** ISO-3166 alfa-2, lo que guarda ranchos.pais. */
  codigo: string;
  nombre: string;
  /** Zonas IANA válidas; la primera es la que se asigna por defecto. */
  zonas: [string, ...string[]];
  /** Prefijo telefónico, para los placeholders de contacto. */
  prefijo: string;
};

/**
 * La misma lista de `paises.ts`, con la forma que espera el formulario
 * de alta. No es una copia: se deriva, así que abrir un país nuevo se
 * hace en UN lugar y esto se entera solo.
 */
export const PAISES: Pais[] = CATALOGO.map((p) => ({
  codigo: p.codigo,
  nombre: p.nombre,
  zonas: [...p.zonas] as [string, ...string[]],
  prefijo: p.prefijoTelefono,
}));

/** Sin distinguir mayúsculas: ver la nota de arriba. */
export function paisPorCodigo(codigo: string): Pais | null {
  const buscado = (codigo ?? "").trim().toLowerCase();
  return PAISES.find((p) => p.codigo === buscado) ?? null;
}

/** La zona horaria default de un país; la de Costa Rica si no se reconoce. */
export function zonaDePais(codigo: string): string {
  return paisPorCodigo(codigo)?.zonas[0] ?? paisDe(PAIS_POR_DEFECTO).zonas[0];
}
