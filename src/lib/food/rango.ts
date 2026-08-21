/**
 * El RANGO DE FECHAS del panel de FOOD (?rango=7|30|90), en su propio
 * módulo chiquito y neutro a propósito: lo leen tanto el selector de
 * la topbar (cliente) como las pantallas que recortan series
 * (servidor). Si viviera en panel-demo.ts, importar el rótulo del
 * selector arrastraría al bundle del navegador TODA la generación de
 * series de demo — que además se ancla al reloj del servidor y en el
 * cliente podría discrepar e hidratar mal.
 */

export type RangoDias = 7 | 30 | 90;

/** Type guard para leer `?rango=` sin castear. */
export function esRangoValido(v: number): v is RangoDias {
  return v === 7 || v === 30 || v === 90;
}

/**
 * El `?rango=` del querystring → un rango del panel. Cualquier basura
 * ("?rango=999", arrays, undefined, null) cae en 30, el default del
 * selector.
 */
export function rangoDesdeParam(param: string | string[] | null | undefined): RangoDias {
  const n = Number(Array.isArray(param) ? param[0] : param);
  return esRangoValido(n) ? n : 30;
}

export const ROTULO_RANGO: Record<RangoDias, string> = {
  7: "Últimos 7 días",
  30: "Últimos 30 días",
  90: "Últimos 90 días",
};

/** Los rangos en orden, para pintar el selector sin castear llaves. */
export const RANGOS: RangoDias[] = [7, 30, 90];
