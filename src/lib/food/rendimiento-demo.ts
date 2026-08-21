/**
 * ═══════════════════════════════════════════════════════════════════
 *  LAS DERIVACIONES DE LA PANTALLA DE RENDIMIENTO
 * ═══════════════════════════════════════════════════════════════════
 *
 * Rendimiento es la pantalla-argumento del producto ("¿Bookea me está
 * ayudando? — sí, y acá está el número") y necesita cortes que el
 * resto del panel no usa: la serie agrupada por semana, la demanda por
 * día de la semana, el mapa de calor día × hora, la conversión de
 * visita a reserva y la tasa de repetición. Nada de eso es un DATO
 * nuevo — todo se DERIVA de las anclas y series de `panel-demo.ts` —
 * pero es suficiente aritmética como para no vivir dentro de un
 * page.tsx. Este módulo la concentra y la página consume UNA función.
 *
 * Regla heredada de panel-demo: importa del reloj del servidor (la
 * serie se ancla a hoy), así que SOLO se importa desde Server
 * Components. Los componentes cliente reciben estas formas por props.
 *
 * El día que haya datos reales, este módulo se reescribe agregando
 * sobre `food_reservations` con estas MISMAS formas de salida — las
 * pantallas y los gráficos no cambian.
 */

import { fechaCorta } from "./tipos";
import {
  COMPARACION_MES_DEMO,
  HORAS_DEMANDA,
  PROMOS_DEMO,
  TICKET_PROMEDIO_DEMO,
  VISITAS_PERFIL_30_DEMO,
  rangoDe,
  type ComparacionMetrica,
  type KpisPanel,
  type PromocionDemo,
  type PuntoDia,
  type RangoDias,
} from "./panel-demo";

// ───────────────────────────────────────────────────────────────────
//  Tipos de salida (el contrato con la pantalla)
// ───────────────────────────────────────────────────────────────────

/** Un bucket del período (una semana, o un día cuando el rango es 7). */
export type BucketPeriodo = {
  etiqueta: string;
  reservas: number;
  personas: number;
  checkIns: number;
  clientesNuevos: number;
  ventasEstimadas: number;
};

/** Una barra de demanda por día de la semana (Lun..Dom). */
export type DiaDemanda = { etiqueta: string; valor: number; destacada?: boolean };

/** El mapa de calor día × hora: valores en % de la demanda total. */
export type MapaCalorDemanda = {
  /** Días en orden de Costa Rica: Lun..Dom (rótulos cortos). */
  filas: string[];
  /** Horas de servicio "HH:MM", tal como las guarda food_franjas. */
  columnas: string[];
  /** valores[fila][columna] = % de la demanda (0–100, un decimal). */
  valores: number[][];
};

/** Una promo del demo con su conversión derivada del embudo. */
export type PromoConConversion = PromocionDemo & {
  /** reservas ÷ visualizaciones, en % a un decimal. */
  conversion: number;
  /** true en la promo que mejor convierte (una sola). */
  mejor: boolean;
};

export type DatosRendimiento = {
  rango: RangoDias;
  serie: PuntoDia[];
  kpis: KpisPanel;
  /** Visitas al perfil en el rango (escala del ancla de 30 días). */
  visitasPerfil: number;
  /** % de visitas al perfil que terminaron en reserva. */
  conversion: number;
  /** % de clientes del período que ya habían venido antes. */
  repeticion: number;
  /** "semana" salvo cuando el rango es 7 días, que se agrupa por día. */
  unidadBuckets: "semana" | "día";
  buckets: BucketPeriodo[];
  diasSemana: DiaDemanda[];
  mapaCalor: MapaCalorDemanda;
  promos: PromoConConversion[];
  comparacion: { reservas: ComparacionMetrica; ventas: ComparacionMetrica };
  /** Frases calculadas de los propios datos (nunca afirmadas a mano). */
  notaHorario: string;
  notaDia: string;
};

// ───────────────────────────────────────────────────────────────────
//  Utilería interna
// ───────────────────────────────────────────────────────────────────

/** Día de semana (0 = domingo) de un "YYYY-MM-DD", sin tocar la zona local. */
function dow(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Los días en el orden en que Costa Rica lee una semana. */
const ORDEN_CR = [1, 2, 3, 4, 5, 6, 0];
const DIA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIA_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Ajusta ±1 los valores (los mayores primero) hasta que sumen EXACTO
 * la meta — la misma idea que `calibrar` en panel-demo: el redondeo
 * por bucket nunca puede dejar al gráfico sumando distinto que el KPI
 * que está al lado.
 */
function ajustarSuma(valores: number[], meta: number): void {
  const orden = valores.map((_, i) => i).sort((a, b) => valores[b] - valores[a]);
  const suma = () => valores.reduce((a, b) => a + b, 0);
  let guarda = 0;
  while (suma() !== meta && guarda++ < 200) {
    const delta = suma() < meta ? 1 : -1;
    for (const i of orden) {
      if (suma() === meta) break;
      if (valores[i] + delta >= 0) valores[i] += delta;
    }
  }
}

/** "14–20 ago", o "28 jul–3 ago" cuando la semana cruza de mes. */
function etiquetaSemana(desde: string, hasta: string): string {
  const [, mA, dA] = desde.split("-").map(Number);
  const [, mB] = hasta.split("-").map(Number);
  return mA === mB ? `${dA}–${fechaCorta(hasta)}` : `${fechaCorta(desde)}–${fechaCorta(hasta)}`;
}

// ───────────────────────────────────────────────────────────────────
//  Los cortes
// ───────────────────────────────────────────────────────────────────

/**
 * La serie agrupada en semanas ancladas al FINAL del rango (la última
 * semana siempre son los últimos 7 días, y la primera puede quedar
 * corta) — así "esta semana" del dueño coincide con la última barra.
 * Con rango de 7 días una sola barra no cuenta nada, así que se
 * agrupa por día.
 */
function agruparBuckets(
  serie: PuntoDia[],
  kpis: KpisPanel,
): { unidad: "semana" | "día"; buckets: BucketPeriodo[] } {
  const porDia = serie.length <= 7;
  const grupos: PuntoDia[][] = [];
  if (porDia) {
    for (const p of serie) grupos.push([p]);
  } else {
    for (let fin = serie.length; fin > 0; fin -= 7) {
      grupos.unshift(serie.slice(Math.max(0, fin - 7), fin));
    }
  }

  const buckets: BucketPeriodo[] = grupos.map((g) => ({
    etiqueta: porDia
      ? fechaCorta(g[0].fecha)
      : etiquetaSemana(g[0].fecha, g[g.length - 1].fecha),
    reservas: g.reduce((a, p) => a + p.reservas, 0),
    personas: g.reduce((a, p) => a + p.personas, 0),
    checkIns: g.reduce((a, p) => a + p.checkIns, 0),
    clientesNuevos: 0, // se calibra abajo
    ventasEstimadas: 0, // se calibra abajo
  }));

  // Clientes nuevos por bucket: proporcional a las personas del bucket
  // y calibrado para que la suma sea EXACTAMENTE el KPI del rango
  // (163 en 30 días) — el gráfico y la tarjeta nunca se contradicen.
  const nuevos = buckets.map((b) =>
    Math.round(b.personas * (kpis.clientesNuevos / Math.max(1, kpis.personas))),
  );
  ajustarSuma(nuevos, kpis.clientesNuevos);

  // Ventas por bucket: check-ins × ticket. El residuo del ancla (el
  // titular dice ₡1.285.000 y 76 × 16.908 = ₡1.285.008) se absorbe en
  // el bucket más grande, donde unos colones ni se notan.
  const ventas = buckets.map((b) => b.checkIns * TICKET_PROMEDIO_DEMO);
  const residuo = kpis.ventasEstimadas - ventas.reduce((a, b) => a + b, 0);
  if (ventas.length > 0) {
    const iMax = ventas.indexOf(Math.max(...ventas));
    ventas[iMax] = Math.max(0, ventas[iMax] + residuo);
  }

  buckets.forEach((b, i) => {
    b.clientesNuevos = nuevos[i];
    b.ventasEstimadas = ventas[i];
  });

  return { unidad: porDia ? "día" : "semana", buckets };
}

/** Reservas por día de la semana en el rango, con el día pico destacado. */
function demandaPorDia(serie: PuntoDia[]): DiaDemanda[] {
  const porDow = new Map<number, number>();
  for (const p of serie) porDow.set(dow(p.fecha), (porDow.get(dow(p.fecha)) ?? 0) + p.reservas);
  const valores = ORDEN_CR.map((d) => porDow.get(d) ?? 0);
  const max = Math.max(...valores);
  return ORDEN_CR.map((d, i) => ({
    etiqueta: DIA_CORTO[d],
    valor: valores[i],
    // Solo el pico lleva color (la forma "énfasis" de GraficoBarras);
    // si hubiera empate se destaca únicamente el primero en orden CR.
    destacada: max > 0 && valores[i] === max && valores.indexOf(max) === i,
  }));
}

/**
 * El mapa de calor día × hora. No hay reservas demo con día Y hora a
 * la vez, así que la celda se estima como producto de las dos
 * distribuciones que SÍ existen: el peso del día (sale de la serie
 * del rango) × el peso de la hora (HORAS_DEMANDA). Cada celda es el %
 * de la demanda total, y por construcción todas suman ~100 — es una
 * distribución, no un conteo, y así la rotula la pantalla.
 */
function mapaCalor(serie: PuntoDia[]): MapaCalorDemanda {
  const porDow = new Map<number, number>();
  let total = 0;
  for (const p of serie) {
    porDow.set(dow(p.fecha), (porDow.get(dow(p.fecha)) ?? 0) + p.reservas);
    total += p.reservas;
  }
  const totalPesos = HORAS_DEMANDA.reduce((a, h) => a + h.peso, 0);

  const valores = ORDEN_CR.map((d) => {
    const shareDia = total > 0 ? (porDow.get(d) ?? 0) / total : 0;
    return HORAS_DEMANDA.map(
      (h) => Math.round(shareDia * (h.peso / totalPesos) * 1000) / 10,
    );
  });

  return {
    filas: ORDEN_CR.map((d) => DIA_CORTO[d]),
    columnas: HORAS_DEMANDA.map((h) => h.hora),
    valores,
  };
}

// ───────────────────────────────────────────────────────────────────
//  La función que consume la página
// ───────────────────────────────────────────────────────────────────

export function datosRendimiento(rango: RangoDias): DatosRendimiento {
  const { serie, kpis } = rangoDe(rango);
  const { kpis: kpis30 } = rangoDe(30);

  // Visitas del rango: el ancla es mensual y se escala por reservas —
  // la conversión queda pareja entre rangos a propósito (es la MISMA
  // tasa de conversión vista en ventanas distintas, no tres tasas).
  const visitasPerfil = Math.max(
    kpis.reservas,
    Math.round(VISITAS_PERFIL_30_DEMO * (kpis.reservas / Math.max(1, kpis30.reservas))),
  );
  const conversion =
    visitasPerfil > 0 ? Math.round((kpis.reservas / visitasPerfil) * 1000) / 10 : 0;

  // Repetición: la otra cara de "clientes nuevos" — qué % del período
  // ya había venido antes. (214 − 163) ÷ 214 ≈ 23,8 %.
  const repeticion =
    kpis.clientes > 0
      ? Math.round(((kpis.clientes - kpis.clientesNuevos) / kpis.clientes) * 1000) / 10
      : 0;

  const { unidad, buckets } = agruparBuckets(serie, kpis);
  const dias = demandaPorDia(serie);
  const calor = mapaCalor(serie);

  // Conversión por promo, derivada del embudo de cada una; "mejor" es
  // un cálculo, no una elección editorial.
  const conversiones = PROMOS_DEMO.map((p) =>
    p.visualizaciones > 0 ? Math.round((p.reservas / p.visualizaciones) * 1000) / 10 : 0,
  );
  const mejorConversion = Math.max(...conversiones);
  const promos: PromoConConversion[] = PROMOS_DEMO.map((p, i) => ({
    ...p,
    conversion: conversiones[i],
    mejor: conversiones[i] === mejorConversion && conversiones.indexOf(mejorConversion) === i,
  }));

  // Las dos frases de la sección de demanda, calculadas de los mismos
  // cortes que los gráficos que acompañan.
  const pesoPico = HORAS_DEMANDA.filter((h) => h.hora === "19:00" || h.hora === "20:00").reduce(
    (a, h) => a + h.peso,
    0,
  );
  const totalPesos = HORAS_DEMANDA.reduce((a, h) => a + h.peso, 0);
  const pctPico = Math.round((pesoPico / totalPesos) * 100);
  const diaPico = dias.find((d) => d.destacada);
  const idxDiaPico = diaPico ? DIA_CORTO.indexOf(diaPico.etiqueta) : -1;

  return {
    rango,
    serie,
    kpis,
    visitasPerfil,
    conversion,
    repeticion,
    unidadBuckets: unidad,
    buckets,
    diasSemana: dias,
    mapaCalor: calor,
    promos,
    comparacion: COMPARACION_MES_DEMO,
    notaHorario: `Entre 7:00 p.m. y 9:00 p.m. se concentra el ${pctPico}% de tu demanda — mantené franjas abiertas en esas horas.`,
    notaDia:
      idxDiaPico >= 0
        ? `El ${DIA_LARGO[idxDiaPico]} es tu día más fuerte del período.`
        : "Todavía no hay un día dominante en el período.",
  };
}
