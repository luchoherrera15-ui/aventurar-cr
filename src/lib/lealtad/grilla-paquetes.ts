/**
 * LAS COLUMNAS DE UNA GRILLA DE PAQUETES, SEGÚN CUÁNTOS HAYA.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * Las tres pantallas que pintan paquetes tenían `lg:grid-cols-4`
 * escrito a mano, de cuando el catálogo tenía cuatro. Al retirar
 * «Ilimitado» (1 sep 2026) quedaron tres tarjetas en una grilla de
 * cuatro columnas: la cuarta se quedó vacía y las tres se corrieron a
 * la izquierda, con un hueco enorme a la derecha.
 *
 * El número de columnas es una consecuencia del catálogo, no una
 * decisión de cada pantalla. Acá se calcula una vez y las tres lo usan,
 * así que el día que se agregue o se retire un paquete las tres se
 * acomodan solas.
 *
 * ------------------------------------------------------------------
 * POR QUÉ UN MAPA Y NO `lg:grid-cols-${n}`
 * ------------------------------------------------------------------
 * Tailwind lee las clases del código fuente como TEXTO: una clase
 * construida con una plantilla nunca llega al CSS final, y la grilla
 * saldría sin columnas. Las cinco posibles se escriben enteras.
 */
const COLUMNAS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

/**
 * Las clases de la grilla para `cuantos` paquetes.
 *
 * Móvil siempre en una columna y `sm` en dos —una tarjeta de paquete
 * con su lista de beneficios no entra en menos de ~260px—, y recién en
 * `lg` se abren todas. Es el patrón de grillas del repo.
 *
 * Con más de cinco cae a cuatro columnas y la fila se parte: es
 * preferible a una grilla de siete columnas ilegibles, y avisa sola de
 * que hay que mirar el diseño.
 */
export function grillaDePaquetes(cuantos: number): string {
  return `grid grid-cols-1 sm:grid-cols-2 ${COLUMNAS[cuantos] ?? "lg:grid-cols-4"}`;
}
