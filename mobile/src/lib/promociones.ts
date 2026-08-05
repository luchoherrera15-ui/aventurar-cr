import type { PromocionDia } from "@/lib/types";

/**
 * `dias_semana` es un integer[] de Postgres, pero según de dónde venga
 * la fila a veces llega ya parseado y a veces como el string JSON
 * crudo — normalizarlo acá, en el único lugar que lo lee (mismo fix
 * que `src/lib/promociones.ts` en la web).
 */
function diasDe(p: PromocionDia): number[] {
  const dias = p.dias_semana as unknown;
  if (Array.isArray(dias)) return dias;
  if (typeof dias === "string") {
    try {
      const parsed = JSON.parse(dias);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function elegirMejor(candidatas: PromocionDia[]): PromocionDia | null {
  const preciosFijos = candidatas.filter(
    (p) => p.tipo === "precio_fijo" && p.precio_fijo !== null,
  );
  if (preciosFijos.length > 0) {
    return preciosFijos.reduce((mejor, p) =>
      p.precio_fijo! < mejor.precio_fijo! ? p : mejor,
    );
  }
  const porcentajes = candidatas.filter(
    (p) => p.tipo === "porcentaje" && p.porcentaje_descuento !== null,
  );
  if (porcentajes.length === 0) return null;
  return porcentajes.reduce((mejor, p) =>
    p.porcentaje_descuento! > mejor.porcentaje_descuento! ? p : mejor,
  );
}

/**
 * La mejor promo de cada día de la semana, para el badge del
 * calendario — se pinta ANTES de saber cuántos invitados va a traer
 * quien reserva, así que acá se ignora personas_max a propósito: es
 * publicidad del día, no la cotización final. Esa la decide
 * promoAplicableDelDia, ya con invitados en mano.
 */
export function mejorPromoPorDiaSemana(
  promociones: PromocionDia[],
): Record<number, PromocionDia> {
  const candidatasPorDia: Record<number, PromocionDia[]> = {};
  promociones
    .filter((p) => p.activo)
    .forEach((p) => {
      diasDe(p).forEach((dow) => {
        (candidatasPorDia[dow] ??= []).push(p);
      });
    });

  const mapa: Record<number, PromocionDia> = {};
  for (const dow of Object.keys(candidatasPorDia)) {
    const mejor = elegirMejor(candidatasPorDia[Number(dow)]);
    if (mejor) mapa[Number(dow)] = mejor;
  }
  return mapa;
}

/**
 * La promo que aplica de verdad para un día + cantidad de invitados
 * ya elegidos. El precio fijo es más específico y gana siempre que su
 * tope de personas lo permita (o no tenga tope); si no aplica por
 * exceso de personas, cae al mejor % disponible ese día.
 */
export function promoAplicableDelDia(
  promociones: PromocionDia[],
  dow: number,
  invitadosNum: number,
): PromocionDia | null {
  const activas = promociones.filter((p) => p.activo && diasDe(p).includes(dow));
  if (activas.length === 0) return null;

  const preciosFijos = activas.filter(
    (p) =>
      p.tipo === "precio_fijo" &&
      p.precio_fijo !== null &&
      (p.personas_max === null || invitadosNum <= p.personas_max),
  );
  if (preciosFijos.length > 0) {
    return preciosFijos.reduce((mejor, p) =>
      p.precio_fijo! < mejor.precio_fijo! ? p : mejor,
    );
  }

  const porcentajes = activas.filter(
    (p) => p.tipo === "porcentaje" && p.porcentaje_descuento !== null,
  );
  if (porcentajes.length === 0) return null;
  return porcentajes.reduce((mejor, p) =>
    p.porcentaje_descuento! > mejor.porcentaje_descuento! ? p : mejor,
  );
}
