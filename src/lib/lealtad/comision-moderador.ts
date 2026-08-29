/**
 * LA COMISIÓN DEL MODERADOR (vendedor de referidos), por paquete.
 *
 * Regla del dueño (29 ago 2026), en dólares y RECURRENTE cada mes:
 *
 *  · STARTER: se paga en GRUPOS DE 3. Mientras el moderador tenga 1 o 2
 *    Starter, cada uno vale $1/mes. En cuanto completa un trío, esos 3
 *    pasan a valer $6/mes cada uno ($18 el trío). Los que sobran de un
 *    trío incompleto siguen a $1.
 *      2 Starter  → $2/mes     (2 × $1)
 *      3 Starter  → $18/mes    (3 × $6)
 *      4 Starter  → $19/mes    ($18 + 1 × $1)
 *      6 Starter  → $36/mes    (2 tríos × $18)
 *
 *  · IMPULSO: $10/mes cada uno, sin agrupar.
 *
 *  · PRUEBA (gratis) e ILIMITADO: sin comisión definida todavía → $0.
 *    (Si el dueño define un valor para Ilimitado, se agrega acá.)
 *
 * Es una función pura para poder testearla y para que el número salga
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

/** Normaliza el `plan_lealtad` de un negocio a su casillero de conteo. */
export function casilleroDePlan(plan: string | null | undefined): keyof ConteoPlanes {
  const p = (plan ?? "prueba").trim().toLowerCase();
  if (p === "arranque") return "arranque";
  if (p === "impulso") return "impulso";
  if (p === "ilimitado") return "ilimitado";
  if (p === "prueba" || p === "") return "prueba";
  return "otros";
}

/** Comisión mensual en dólares para un conteo de negocios activos. */
export function comisionMensualUSD(c: ConteoPlanes): number {
  const trios = Math.floor(c.arranque / 3);
  const sueltos = c.arranque % 3;
  const starter = trios * 3 * 6 + sueltos * 1; // $6 en trío, $1 suelto
  const impulso = c.impulso * 10;
  return starter + impulso;
}

/** Suma un plan al conteo (mutando una copia). */
export function sumarPlan(c: ConteoPlanes, plan: string | null | undefined): ConteoPlanes {
  const k = casilleroDePlan(plan);
  return { ...c, [k]: c[k] + 1 };
}
