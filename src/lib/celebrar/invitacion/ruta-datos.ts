/**
 * Asignación por RUTA dentro de los `datos` de una sección, para la
 * edición en vivo desde el visualizador: el renderizador sabe qué texto
 * está pintando («items.2.titulo»), y el editor lo escribe en el
 * documento sin conocer la forma de cada sección.
 *
 * Inmutable: devuelve copias de cada nivel tocado. Los segmentos
 * numéricos entran a un arreglo por índice; el resto son llaves de
 * objeto. Una ruta que no existe en el objeto se crea (objeto vacío),
 * nunca se rompe.
 */
export function asignarRuta<T>(objeto: T, ruta: string, valor: unknown): T {
  const partes = ruta.split(".").filter(Boolean);
  if (partes.length === 0) return objeto;
  return asignar(objeto, partes, valor) as T;
}

function asignar(actual: unknown, partes: string[], valor: unknown): unknown {
  const [cabeza, ...resto] = partes;
  if (Array.isArray(actual)) {
    const i = Number(cabeza);
    if (!Number.isInteger(i) || i < 0 || i >= actual.length) return actual;
    const copia = actual.slice();
    copia[i] = resto.length === 0 ? valor : asignar(actual[i], resto, valor);
    return copia;
  }
  const base = actual && typeof actual === "object" ? (actual as Record<string, unknown>) : {};
  return { ...base, [cabeza]: resto.length === 0 ? valor : asignar(base[cabeza], resto, valor) };
}

/** Lee por ruta; `undefined` si algo del camino no existe. */
export function leerRuta(objeto: unknown, ruta: string): unknown {
  let actual = objeto;
  for (const parte of ruta.split(".").filter(Boolean)) {
    if (actual === null || actual === undefined) return undefined;
    if (Array.isArray(actual)) actual = actual[Number(parte)];
    else if (typeof actual === "object") actual = (actual as Record<string, unknown>)[parte];
    else return undefined;
  }
  return actual;
}
