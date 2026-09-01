/**
 * LA COMISIÓN DEL MODERADOR (vendedor de referidos), por paquete.
 *
 * Regla del dueño (1 sep 2026), en dólares y RECURRENTE cada mes:
 *
 *  · IMPULSO: $15/mes por negocio.
 *  · STARTER: $1,50/mes por negocio.
 *  · PRUEBA (gratis) e ILIMITADO: sin comisión definida todavía → $0.
 *    (Si el dueño define un valor para Ilimitado, se agrega acá.)
 *
 * ------------------------------------------------------------------
 * POR QUÉ LA TARIFA ES PLANA, Y POR QUÉ IMPORTA
 * ------------------------------------------------------------------
 * Hasta el 31 de agosto Starter se pagaba EN GRUPOS DE 3 ($1 suelto,
 * $6 cada uno al completar un trío). Esa regla hacía imposible contestar
 * la pregunta que el moderador de verdad se hace —«¿cuánto me deja ESTE
 * negocio?»—: con agrupación, la plata de un negocio dependía de cuántos
 * OTROS hubiera, así que el mismo local valía $1 o $6 según el mes.
 *
 * Con tarifa plana cada negocio tiene su propio monto, y por eso ahora
 * existe `comisionDeNegocioUSD`: es lo que el panel muestra por fila.
 * `comisionMensualUSD` quedó como la suma de esas filas — con la regla
 * vieja NO era una suma, y ahí estaba la incomodidad.
 *
 * Son funciones puras para poder testearlas y para que el número salga
 * IGUAL en el panel del moderador y en el listado del admin.
 */

/** Los planes de lealtad, agrupados por lo que importa para la comisión. */
export type ConteoPlanes = {
  arranque: number; // Starter
  impulso: number;
  ilimitado: number;
  prueba: number;
  otros: number;
};

export const CONTEO_VACIO: ConteoPlanes = {
  arranque: 0,
  impulso: 0,
  ilimitado: 0,
  prueba: 0,
  otros: 0,
};

/**
 * LA TARIFA, en un solo lugar.
 *
 * Un casillero que no está acá vale $0 — y es a propósito que sea por
 * omisión y no un `0` escrito: el día que se agregue un paquete nuevo al
 * catálogo, el panel muestra $0 hasta que el dueño decida cuánto paga,
 * en vez de inventar un número.
 */
export const TARIFA_USD: Partial<Record<keyof ConteoPlanes, number>> = {
  impulso: 15,
  arranque: 1.5,
};

/** Normaliza el `plan_lealtad` de un negocio a su casillero de conteo. */
export function casilleroDePlan(plan: string | null | undefined): keyof ConteoPlanes {
  const p = (plan ?? "prueba").trim().toLowerCase();
  if (p === "arranque") return "arranque";
  if (p === "impulso") return "impulso";
  if (p === "ilimitado") return "ilimitado";
  if (p === "prueba" || p === "") return "prueba";
  return "otros";
}

/**
 * Lo que deja UN negocio por mes, por su paquete. Es la cifra que el
 * moderador ve en su fila.
 */
export function comisionDeNegocioUSD(plan: string | null | undefined): number {
  return TARIFA_USD[casilleroDePlan(plan)] ?? 0;
}

/** Comisión mensual en dólares para un conteo de negocios activos. */
export function comisionMensualUSD(c: ConteoPlanes): number {
  let total = 0;
  for (const [casillero, tarifa] of Object.entries(TARIFA_USD)) {
    total += c[casillero as keyof ConteoPlanes] * (tarifa ?? 0);
  }
  // Con $1,50 de por medio, sumar en coma flotante deja restos
  // (3 × 1.5 = 4.5 está bien, pero 0.1 + 0.2 no): se redondea a
  // centavos para que el panel nunca muestre «$4.500000000000001».
  return Math.round(total * 100) / 100;
}

/**
 * El monto, escrito como se muestra: sin decimales cuando es redondo
 * («$15») y con dos cuando no («$1,50»). Vive acá y no en cada pantalla
 * porque la tarifa de Starter es la que trae los decimales, y el día que
 * cambie no hay que acordarse de ir a arreglar el formato en dos lados.
 */
export function dolares(n: number): string {
  const decimales = Number.isInteger(n) ? 0 : 2;
  return (
    "$" +
    n.toLocaleString("es-CR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
  );
}

/** Suma un plan al conteo (mutando una copia). */
export function sumarPlan(c: ConteoPlanes, plan: string | null | undefined): ConteoPlanes {
  const k = casilleroDePlan(plan);
  return { ...c, [k]: c[k] + 1 };
}
