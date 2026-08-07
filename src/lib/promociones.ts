import type { PromocionDia } from "@/app/mi-negocio/types";

/**
 * DICIEMBRE NO LLEVA DESCUENTO (decisión del dueño).
 *
 * Los lugares de alquiler tienen precios propios de diciembre, más
 * altos, porque es temporada alta. Las promociones automáticas por día
 * de la semana se los comían: un lunes de diciembre con la promo de
 * −30 % quedaba en ₡140.000 cuando el mismo lunes de setiembre salía
 * ₡136.000 — el recargo de temporada desaparecía y encima el
 * calendario anunciaba "30% OFF" en todo diciembre.
 *
 * Por eso las dos funciones de acá aceptan `esDiciembre` y en ese caso
 * no devuelven promo: ni el badge del calendario ni el descuento del
 * precio. Los códigos de descuento manuales no pasan por acá y siguen
 * funcionando — esto es solo lo automático por día.
 */
export function esFechaDeDiciembre(iso: string): boolean {
  // "YYYY-MM-DD" → el mes sin construir un Date (que se corre por UTC).
  return iso.slice(5, 7) === "12";
}

/**
 * `dias_semana` es un integer[] de Postgres, pero según de dónde venga
 * la fila (distintas versiones de PostgREST/cliente) a veces llega ya
 * parseado y a veces como el string JSON crudo — normalizarlo acá,
 * en el único lugar que lo lee, en vez de en cada sitio que arma el
 * fetch (evita el bug real que hizo que un descuento se viera en el
 * calendario pero no se aplicara al precio).
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
 * quien reserva (esa cantidad recién se pide después de elegir
 * fecha), así que acá se ignora personas_max a propósito: es
 * publicidad del día, no la cotización final. Esa la decide
 * promoAplicableDelDia, ya con invitados en mano.
 */
export function mejorPromoPorDiaSemana(
  promociones: PromocionDia[],
  opciones: { esDiciembre?: boolean } = {},
): Record<number, PromocionDia> {
  // Diciembre no lleva promo: ni un badge en el calendario.
  if (opciones.esDiciembre) return {};

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
  opciones: { esDiciembre?: boolean } = {},
): PromocionDia | null {
  // Diciembre se cobra a precio de temporada, sin descuento encima.
  if (opciones.esDiciembre) return null;

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
