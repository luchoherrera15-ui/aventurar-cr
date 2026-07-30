/**
 * Países donde opera Bookea y la zona horaria de cada uno.
 *
 * Arrancamos solo con Costa Rica, pero todo el sistema de horarios se
 * apoya acá: al dar de alta un negocio se guarda su país y su zona
 * horaria IANA (ranchos.pais / ranchos.zona_horaria, migración 0062),
 * y los motores de disponibilidad, recordatorios y calendarios deben
 * leer ESA zona en vez de asumir CR. Para abrir un país nuevo:
 * agregarlo a esta lista y listo — el alta lo ofrece solo.
 *
 * Nota: países con varias zonas (México, EE. UU.) van a necesitar
 * elegir la zona por región al darse de alta; la estructura ya lo
 * permite (zonas: string[], la primera es la default).
 */

export type Pais = {
  /** ISO-3166 alpha-2, lo que guarda ranchos.pais. */
  codigo: string;
  nombre: string;
  /** Zonas IANA válidas; la primera es la que se asigna por defecto. */
  zonas: [string, ...string[]];
  /** Prefijo telefónico, para los placeholders de contacto. */
  prefijo: string;
};

export const PAISES: Pais[] = [
  {
    codigo: "CR",
    nombre: "Costa Rica",
    zonas: ["America/Costa_Rica"],
    prefijo: "+506",
  },
  // Próximos: agregar acá y el alta los ofrece solo. Ejemplos listos:
  // { codigo: "PA", nombre: "Panamá", zonas: ["America/Panama"], prefijo: "+507" },
  // { codigo: "MX", nombre: "México", zonas: ["America/Mexico_City", "America/Cancun", "America/Tijuana"], prefijo: "+52" },
];

export function paisPorCodigo(codigo: string): Pais | null {
  return PAISES.find((p) => p.codigo === codigo) ?? null;
}

/** La zona horaria default de un país; CR si el código no existe. */
export function zonaDePais(codigo: string): string {
  return paisPorCodigo(codigo)?.zonas[0] ?? "America/Costa_Rica";
}
