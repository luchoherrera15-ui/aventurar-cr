import { esInactivo, esReincidente, type ClienteCRM } from "./crm-citas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  SEGMENTACIÓN DE CLIENTES — el cerebro del módulo Clientes
 * ════════════════════════════════════════════════════════════════════
 *
 * Parte de la transformación CRM (1 sep 2026). `crm-citas.ts` ya sabe
 * DERIVAR la ficha (visitas, gasto, no-shows) desde las reservas; acá
 * vive la pregunta siguiente: ¿qué clase de cliente es este, y a cuál
 * hay que prestarle atención HOY?
 *
 * ------------------------------------------------------------------
 * POR QUÉ LOS SEGMENTOS SON FUNCIONES Y NO FILAS
 * ------------------------------------------------------------------
 * Un segmento guardado («este cliente ES vip») miente en cuanto los
 * números cambian: el VIP que dejó de venir seis meses sigue marcado
 * VIP. Calculado, el segmento siempre dice la verdad de hoy — y como
 * la ficha entera ya se deriva (decisión D-3), esto no agrega ninguna
 * consulta nueva.
 *
 * Lo que el negocio quiera declarar A MANO («vip» porque es la suegra
 * del dueño) va en las ETIQUETAS de `fichas_cliente` (0228), que son
 * suyas y no se recalculan. Los dos ejes conviven a propósito:
 * el sistema opina con números, el negocio opina con etiquetas.
 *
 * ------------------------------------------------------------------
 * EL ORDEN DE PRIORIDAD IMPORTA
 * ------------------------------------------------------------------
 * Un cliente puede calzar en varios («frecuente» que ahora está «en
 * riesgo»). `segmentoDe()` devuelve UNO, el más accionable: primero lo
 * que pide acción (riesgo, inactivo), después lo descriptivo (vip,
 * frecuente, nuevo). La lista de la pantalla filtra por ese uno y el
 * negocio no ve al mismo cliente repetido en tres pestañas.
 */

export type Segmento =
  | "en_riesgo"
  | "inactivo"
  | "vip"
  | "frecuente"
  | "nuevo"
  | "ocasional";

export const SEGMENTOS: readonly Segmento[] = [
  "en_riesgo",
  "inactivo",
  "vip",
  "frecuente",
  "nuevo",
  "ocasional",
];

export const NOMBRE_SEGMENTO: Record<Segmento, string> = {
  en_riesgo: "En riesgo",
  inactivo: "Inactivos",
  vip: "VIP",
  frecuente: "Frecuentes",
  nuevo: "Nuevos",
  ocasional: "Ocasionales",
};

/** Una línea que explica el criterio — se muestra en la pantalla. */
export const CRITERIO_SEGMENTO: Record<Segmento, string> = {
  en_riesgo: "Faltó a sus últimas citas o se está enfriando: venía seguido y dejó de venir.",
  inactivo: "Sin venir hace más de 60 días.",
  vip: "El 10 % que más ha gastado en el negocio.",
  frecuente: "Tres visitas o más, y sigue activo.",
  nuevo: "Su primera visita fue hace 30 días o menos.",
  ocasional: "Vino una o dos veces.",
};

/** Umbral de «nuevo»: primera visita hace ≤ 30 días. */
const DIAS_NUEVO = 30;

/**
 * «Se está enfriando»: venía cada X días y ya pasó el DOBLE de su
 * ritmo sin volver. Es la señal de riesgo más valiosa que el CRM puede
 * dar — el inactivo ya se fue; el que se enfría todavía se recupera.
 * Se exige ritmo conocido (≥3 visitas) para no acusar al ocasional.
 */
export function seEstaEnfriando(c: ClienteCRM): boolean {
  if (c.cumplidas < 3 || c.ultimaVisita === null) return false;
  const ritmo = ritmoDeVisitaDias(c);
  if (ritmo === null) return false;
  const sinVenir = c.diasSinVenir ?? 0;
  // Con próxima cita agendada no hay enfriamiento que valga.
  if (c.proximaCita !== null) return false;
  return sinVenir > ritmo * 2;
}

/**
 * Cada cuántos días viene, en promedio: el largo del período entre su
 * primera y su última visita cumplida, repartido entre los intervalos.
 * null si no hay al menos dos visitas cumplidas con fecha.
 */
export function ritmoDeVisitaDias(c: ClienteCRM): number | null {
  if (c.cumplidas < 2 || c.ultimaVisita === null || c.primeraVisita == null) return null;
  const primera = Date.parse(`${c.primeraVisita}T12:00:00Z`);
  const ultima = Date.parse(`${c.ultimaVisita}T12:00:00Z`);
  if (!Number.isFinite(primera) || !Number.isFinite(ultima) || ultima <= primera) return null;
  return Math.round((ultima - primera) / 86_400_000 / (c.cumplidas - 1));
}

/**
 * El corte de VIP: el gasto del percentil 90 de la cartera. Se calcula
 * contra TODOS los clientes del negocio y no con un monto fijo — ₡50 000
 * es un VIP en una barbería y un martes cualquiera en un spa.
 */
export function corteVip(clientes: readonly ClienteCRM[]): number {
  const gastos = clientes
    .map((c) => c.gastoTotal)
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  if (gastos.length < 10) return Number.POSITIVE_INFINITY; // sin cartera no hay VIP
  return gastos[Math.floor(gastos.length * 0.9)];
}

/** ¿Es nuevo? Primera visita (o primer contacto) hace ≤ 30 días. */
export function esNuevo(c: ClienteCRM, hoyISO: string): boolean {
  const primera = c.primeraVisita ?? null;
  if (primera === null) return false;
  const dias = (Date.parse(`${hoyISO}T12:00:00Z`) - Date.parse(`${primera}T12:00:00Z`)) / 86_400_000;
  return dias >= 0 && dias <= DIAS_NUEVO;
}

/**
 * EL segmento de un cliente — uno solo, el más accionable.
 * El corte de VIP llega ya calculado para no reordenar la cartera
 * entera por cada fila.
 */
export function segmentoDe(c: ClienteCRM, hoyISO: string, vipDesde: number): Segmento {
  if (esReincidente(c) || seEstaEnfriando(c)) return "en_riesgo";
  if (esInactivo(c)) return "inactivo";
  if (c.gastoTotal >= vipDesde) return "vip";
  if (c.cumplidas >= 3) return "frecuente";
  if (esNuevo(c, hoyISO)) return "nuevo";
  return "ocasional";
}

/** La cartera entera, segmentada de una pasada. */
export function segmentarCartera(
  clientes: readonly ClienteCRM[],
  hoyISO: string,
): { cliente: ClienteCRM; segmento: Segmento }[] {
  const vipDesde = corteVip(clientes);
  return clientes.map((cliente) => ({
    cliente,
    segmento: segmentoDe(cliente, hoyISO, vipDesde),
  }));
}

/** Cuántos hay en cada segmento — para las pestañas y el dashboard. */
export function conteoPorSegmento(
  segmentados: readonly { segmento: Segmento }[],
): Record<Segmento, number> {
  const conteo = Object.fromEntries(SEGMENTOS.map((s) => [s, 0])) as Record<Segmento, number>;
  for (const { segmento } of segmentados) conteo[segmento]++;
  return conteo;
}
