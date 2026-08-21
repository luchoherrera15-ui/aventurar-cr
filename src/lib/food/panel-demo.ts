/**
 * ═══════════════════════════════════════════════════════════════════
 *  UTILERÍA DE DEMO DEL PANEL DE FOOD.BOOKEA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Los números de "escaparate" del panel del restaurante: métricas,
 * series de 90 días, clientes, promociones y reservas históricas que
 * llenan las pantallas de analítica MIENTRAS el negocio todavía no
 * acumula datos reales en `food_reservations`.
 *
 * ── QUÉ ES Y QUÉ NO ES ─────────────────────────────────────────────
 * Es utilería: ningún número de acá sale de la base. Las pantallas
 * OPERATIVAS (reservas de hoy, check-in, franjas, menú) usan los datos
 * reales como siempre; este módulo alimenta solo las métricas y los
 * gráficos que hoy no existen en producción. Toda pantalla que pinte
 * algo de acá lo marca con <NotaDemo /> ("Datos de ejemplo").
 *
 * ── CÓMO SE REEMPLAZA POR DATOS REALES ─────────────────────────────
 * El contrato es la forma de los tipos exportados (PuntoDia, KpisPanel,
 * ClienteDemo…). El día que haya volumen real, se escribe un módulo
 * `panel-datos.ts` que arme las MISMAS formas desde `food_reservations`
 * (agregación por fecha para la serie, conteo de comensales para
 * clientes, etc.) y las pantallas cambian el import — los componentes
 * de src/components/food/panel no saben de dónde vienen los números.
 *
 * ── POR QUÉ TODO ESTÁ DERIVADO Y NO HARDCODEADO ────────────────────
 * Los números "cabecera" del demo (87 reservas, 76 check-ins,
 * ₡1.285.000…) son anclas, y TODO lo demás se deriva de ellas en
 * tiempo de carga: la serie diaria se calibra para que los últimos 30
 * días sumen EXACTAMENTE las anclas, el ticket promedio sale de
 * ventas ÷ check-ins, las reservas históricas se generan día por día
 * DESDE la serie (los conteos del gráfico y la lista siempre
 * coinciden), y los insights se calculan de los mismos datos. Así es
 * imposible que dos pantallas del demo se contradigan.
 *
 * ── REGLA DE HONESTIDAD ────────────────────────────────────────────
 * Bookea NO conoce la facturación real del restaurante. Todo lo
 * económico de este módulo es "estimado": check-ins × ticket promedio
 * configurado. La nota estándar vive en <NotaEstimacion /> y acompaña
 * SIEMPRE a cualquier cifra en colones.
 *
 * ── DÓNDE IMPORTARLO ───────────────────────────────────────────────
 * Solo desde Server Components. La serie se ancla a hoyISOCR() al
 * cargar el módulo; si un componente cliente lo importara, el reloj
 * del navegador podría discrepar del servidor y romper la hidratación.
 * Los componentes cliente reciben estos datos como props.
 */

import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import type { RangoDias } from "./rango";

// El rango (?rango=) vive en ./rango — módulo aparte porque también lo
// importa el selector de la topbar (cliente) y no queremos la
// generación de series dentro del bundle del navegador. Se re-exporta
// para que las pantallas de servidor tengan un solo import.
export { esRangoValido, rangoDesdeParam, ROTULO_RANGO, RANGOS, type RangoDias } from "./rango";

// ───────────────────────────────────────────────────────────────────
//  Tipos (el contrato que los datos reales deberán cumplir)
// ───────────────────────────────────────────────────────────────────

/** Un día de la serie: lo que Bookea le generó al restaurante ese día. */
export type PuntoDia = {
  /** "YYYY-MM-DD" */
  fecha: string;
  reservas: number;
  /** Comensales (suma de party_size de las reservas del día). */
  personas: number;
  /** Reservas que llegaron a la mesa (estado check_in). Siempre ≤ reservas. */
  checkIns: number;
};

/** Variación % contra el período anterior del mismo largo. */
export type DeltasPanel = {
  reservas: number;
  clientes: number;
  checkIns: number;
  ventas: number;
};

export type KpisPanel = {
  rango: RangoDias;
  reservas: number;
  personas: number;
  checkIns: number;
  /** Comensales únicos estimados que Bookea le acercó en el rango. */
  clientes: number;
  /** Cuántos de esos clientes llegaron por primera vez. ⊂ clientes. */
  clientesNuevos: number;
  /** SIEMPRE estimado: checkIns × ticket promedio. Nunca facturación real. */
  ventasEstimadas: number;
  /** Consumo estimado por mesa que configuró el restaurante. */
  ticketPromedio: number;
  deltas: DeltasPanel;
};

export type ClienteDemo = {
  id: string;
  nombre: string;
  visitas: number;
  /** "YYYY-MM-DD" de su última visita con check-in. */
  ultimaVisita: string;
  /** Consumo estimado acumulado (visitas × ticket, con variación). */
  totalEstimado: number;
  /** nuevo = primera visita en el período; recurrente = ya había venido. */
  tipo: "nuevo" | "recurrente";
};

/**
 * Estados del CICLO DE PRODUCTO, no los de la tabla real: la tabla
 * `food_reservations` usa confirmada/check_in/no_show/cancelada. Acá
 * "completada" equivale a check_in (ya pasó y llegó) y "pendiente" es
 * una reserva futura aún sin confirmar por el restaurante — existe en
 * el demo para que la pantalla de Reservas muestre el ciclo completo.
 */
export type EstadoReservaDemo =
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show";

export type ReservaDemo = {
  id: string;
  cliente: string;
  fecha: string;
  /** "HH:MM" en 24h, como guarda food_franjas.hora. */
  hora: string;
  personas: number;
  estado: EstadoReservaDemo;
  /** Solo las completadas tienen consumo estimado; el resto null. */
  totalEstimado: number | null;
};

export type PromocionDemo = {
  id: string;
  nombre: string;
  /** La franja/condición en texto, tal como la vería el cliente. */
  detalle: string;
  estado: "activa" | "pausada";
  visualizaciones: number;
  reservas: number;
  checkIns: number;
};

/** Demanda por hora de servicio (peso relativo, no un conteo). */
export type HoraDemanda = { hora: string; peso: number };

export type InsightDemo = { id: string; texto: string };

// ───────────────────────────────────────────────────────────────────
//  Las ANCLAS del demo (los números de la maqueta comercial)
// ───────────────────────────────────────────────────────────────────

/** Reservas de los últimos 30 días. La serie se calibra a esto. */
const RESERVAS_30 = 87;
/** Check-ins de los últimos 30 días (reservas que llegaron a la mesa). */
const CHECKINS_30 = 76;
/** Comensales (suma de party_size) de los últimos 30 días. */
const PERSONAS_30 = 246;
/** Comensales ÚNICOS estimados en 30 días (246 asientos, 214 personas). */
const CLIENTES_30 = 214;
/** De los 214, cuántos llegaron por primera vez vía Bookea. */
const NUEVOS_30 = 163;

/**
 * Ventas estimadas de 30 días. Es EL ancla económica: el ticket
 * promedio se deriva de ella (1.285.000 ÷ 76 = ₡16.908 por mesa) y no
 * al revés, para que el titular del dashboard diga exactamente
 * ₡1.285.000 y no un vecino feo tipo ₡1.285.008.
 */
export const VENTAS_ESTIMADAS_30_DEMO = 1_285_000;

/** Consumo estimado por mesa con check-in: 1.285.000 ÷ 76 ≈ ₡16.908. */
export const TICKET_PROMEDIO_DEMO = Math.round(VENTAS_ESTIMADAS_30_DEMO / CHECKINS_30);

/** Personas por reserva del demo (246 ÷ 87 ≈ 2,83): reparte consumos. */
const PROMEDIO_PERSONAS = PERSONAS_30 / RESERVAS_30;

/**
 * Las anclas del MES ANTERIOR. Existen porque la pantalla de
 * Rendimiento tiene una tarjeta de comparación que enseña el "antes"
 * CON NÚMERO ("87 vs 76 reservas" · "₡1.285.000 vs ₡1.084.000"), y un
 * porcentaje parado junto a dos cifras visibles TIENE que salir de
 * esas dos cifras — si se declarara aparte, cualquiera que divida
 * notaría que no cierra. Por eso los deltas de 30 días de reservas y
 * ventas ya no se declaran a mano: se derivan de estas anclas con
 * `variacionPorcentual` (quedan en +14,5 % y +18,5 %). Solo se anclan
 * las DOS métricas que la comparación muestra; el resto de deltas
 * sigue declarado sin base visible, como explica el comentario de
 * DELTAS_POR_RANGO.
 */
const RESERVAS_MES_ANTERIOR = 76;
export const VENTAS_ESTIMADAS_MES_ANTERIOR_DEMO = 1_084_000;

/**
 * Variación % entre dos cifras, a UN decimal — la única función con la
 * que este módulo (y cualquier pantalla) calcula un "+X %" que aparece
 * junto a sus dos cifras base. Un solo redondeo en un solo lugar: si
 * cada pantalla redondeara por su cuenta, la misma comparación diría
 * 14,5 en una tarjeta y 14,47 en otra.
 */
export function variacionPorcentual(actual: number, anterior: number): number {
  if (anterior <= 0) return 0;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

/**
 * Variación contra el período anterior, por rango. Salvo las dos de 30
 * días derivadas de las anclas de arriba, son utilería declarada (el
 * "período anterior" de 90 días ni siquiera cabe en la serie) y sus
 * sumas base NO se exportan: mostrar a la vez el % y un "antes: X"
 * recalculado daría redondeos que no cierran.
 */
const DELTAS_POR_RANGO: Record<RangoDias, DeltasPanel> = {
  7: { reservas: 8.6, clientes: 11.9, checkIns: 6.8, ventas: 9.2 },
  30: {
    reservas: variacionPorcentual(RESERVAS_30, RESERVAS_MES_ANTERIOR),
    clientes: 22.8,
    checkIns: 11.7,
    ventas: variacionPorcentual(VENTAS_ESTIMADAS_30_DEMO, VENTAS_ESTIMADAS_MES_ANTERIOR_DEMO),
  },
  90: { reservas: 21.5, clientes: 27.9, checkIns: 17.6, ventas: 23.1 },
};

// ───────────────────────────────────────────────────────────────────
//  Ruido determinista
// ───────────────────────────────────────────────────────────────────

/**
 * FNV-1a + mezcla final → un [0,1) estable por llave. Determinista a
 * propósito: el mismo día muestra siempre el mismo número aunque el
 * servidor re-renderice mil veces, y la serie "se mueve" sola al pasar
 * los días porque la llave es la fecha. Math.random() acá rompería la
 * coherencia entre render y render.
 */
function ruido(llave: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < llave.length; i++) {
    h ^= llave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ───────────────────────────────────────────────────────────────────
//  La serie de 90 días
// ───────────────────────────────────────────────────────────────────

/**
 * Peso por día de semana (índice getUTCDay: dom..sáb). La forma que
 * pidió producto: jueves-sábado por encima, lunes el valle. El domingo
 * queda medio (almuerzos familiares).
 */
const PESO_SEMANA = [2.6, 1.5, 1.7, 2.1, 3.3, 4.4, 5.2];

/**
 * Reparte ±1 sobre los días (los de mayor peso primero) hasta que el
 * tramo [desde..fin] sume EXACTAMENTE la meta. Es lo que garantiza que
 * "87 reservas" del KPI y la suma del gráfico sean el mismo número, en
 * cualquier fecha en que se cargue el demo — el redondeo día a día
 * nunca vuelve a desalinearlos.
 */
function calibrar(
  valores: number[],
  crudo: number[],
  desde: number,
  meta: number,
  valido: (v: number, i: number) => boolean,
): void {
  const orden: number[] = [];
  for (let i = desde; i < valores.length; i++) orden.push(i);
  orden.sort((a, b) => crudo[b] - crudo[a]);
  const suma = () => orden.reduce((a, i) => a + valores[i], 0);
  let guarda = 0;
  while (suma() !== meta && guarda++ < 500) {
    const delta = suma() < meta ? 1 : -1;
    for (const i of orden) {
      if (suma() === meta) break;
      const nuevo = valores[i] + delta;
      if (valido(nuevo, i)) valores[i] = nuevo;
    }
  }
}

function generarSerie(hoyISO: string): PuntoDia[] {
  const fechas: { fecha: string; dow: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const fecha = sumarDiasISO(hoyISO, -i);
    const [y, m, d] = fecha.split("-").map(Number);
    fechas.push({ fecha, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() });
  }

  // Tendencia creciente (la historia del demo es "Bookea te está
  // generando cada vez más"), con el JUEVES creciendo más fuerte que
  // el resto — es la base del primer insight, que se CALCULA de esta
  // serie más abajo en vez de afirmarse porque sí.
  const crudo = fechas.map((f, i) => {
    const avance = i / 89;
    const tendencia = f.dow === 4 ? 0.42 + 1.1 * avance : 0.88 + 0.24 * avance;
    return PESO_SEMANA[f.dow] * tendencia * (0.86 + 0.28 * ruido(f.fecha + "|r"));
  });

  // Escalar para que los últimos 30 días queden en el orden del ancla
  // y calibrar el residuo del redondeo hasta la igualdad exacta.
  const suma30 = crudo.slice(60).reduce((a, b) => a + b, 0);
  const escala = RESERVAS_30 / suma30;
  const reservas = crudo.map((v) => Math.max(0, Math.round(v * escala)));
  calibrar(reservas, crudo, 60, RESERVAS_30, (v) => v >= 0);

  // Check-ins: ~80-94% de las reservas del día, nunca más que ellas.
  const checkIns = reservas.map((r, i) =>
    Math.min(r, Math.round(r * (0.78 + 0.16 * ruido(fechas[i].fecha + "|c")))),
  );
  calibrar(checkIns, crudo, 60, CHECKINS_30, (v, i) => v >= 0 && v <= reservas[i]);

  // Personas: 2,45-3,3 por reserva, nunca menos de 1 por reserva.
  const personas = reservas.map((r, i) =>
    r === 0 ? 0 : Math.max(r, Math.round(r * (2.45 + 0.85 * ruido(fechas[i].fecha + "|p")))),
  );
  calibrar(personas, crudo, 60, PERSONAS_30, (v, i) =>
    reservas[i] === 0 ? v === 0 : v >= reservas[i],
  );

  return fechas.map((f, i) => ({
    fecha: f.fecha,
    reservas: reservas[i],
    personas: personas[i],
    checkIns: checkIns[i],
  }));
}

const HOY_DEMO = hoyISOCR();

/**
 * 90 días terminando HOY (hora de Costa Rica). Los últimos 30 suman
 * exactamente las anclas: 87 reservas, 76 check-ins, 246 personas.
 */
export const SERIE_90_DIAS: PuntoDia[] = generarSerie(HOY_DEMO);

// ───────────────────────────────────────────────────────────────────
//  KPIs por rango
// ───────────────────────────────────────────────────────────────────

/**
 * Recorta la serie al rango pedido y deriva los KPIs de esa tajada.
 * Para 30 días devuelve EXACTAMENTE los números de la maqueta (87,
 * 214, 76, ₡1.285.000) porque la serie está calibrada a ellos; para 7
 * y 90 todo se recalcula de las mismas sumas, así el selector de rango
 * nunca muestra un número que el gráfico no respalde.
 */
export function rangoDe(dias: RangoDias): { serie: PuntoDia[]; kpis: KpisPanel } {
  const serie = SERIE_90_DIAS.slice(SERIE_90_DIAS.length - dias);
  const reservas = serie.reduce((a, p) => a + p.reservas, 0);
  const personas = serie.reduce((a, p) => a + p.personas, 0);
  const checkIns = serie.reduce((a, p) => a + p.checkIns, 0);

  // Únicos y nuevos mantienen las proporciones del ancla de 30 días
  // (214/246 únicos por asiento, 163/214 nuevos por único); con la
  // serie calibrada, en 30 días el redondeo devuelve 214 y 163 exactos.
  const clientes = Math.round(personas * (CLIENTES_30 / PERSONAS_30));
  const clientesNuevos = Math.round(clientes * (NUEVOS_30 / CLIENTES_30));

  const ventasEstimadas =
    dias === 30 ? VENTAS_ESTIMADAS_30_DEMO : checkIns * TICKET_PROMEDIO_DEMO;

  return {
    serie,
    kpis: {
      rango: dias,
      reservas,
      personas,
      checkIns,
      clientes,
      clientesNuevos,
      ventasEstimadas,
      ticketPromedio: TICKET_PROMEDIO_DEMO,
      deltas: DELTAS_POR_RANGO[dias],
    },
  };
}

// ───────────────────────────────────────────────────────────────────
//  Demanda por hora
// ───────────────────────────────────────────────────────────────────

/**
 * La forma de la demanda de un restaurante urbano: pico de almuerzo
 * (12-13) y pico fuerte de cena (19-21). Los pesos están elegidos para
 * que 19:00-21:00 concentre ~41% — el segundo insight se calcula de
 * acá, no se afirma a mano.
 */
export const HORAS_DEMANDA: HoraDemanda[] = [
  { hora: "11:00", peso: 5 },
  { hora: "12:00", peso: 10 },
  { hora: "13:00", peso: 8 },
  { hora: "14:00", peso: 3 },
  { hora: "15:00", peso: 2 },
  { hora: "16:00", peso: 2 },
  { hora: "17:00", peso: 3 },
  { hora: "18:00", peso: 8 },
  { hora: "19:00", peso: 18 },
  { hora: "20:00", peso: 16 },
  { hora: "21:00", peso: 7 },
];

/** Elige una hora de servicio con la distribución de HORAS_DEMANDA. */
function horaSegunDemanda(llave: string): string {
  const total = HORAS_DEMANDA.reduce((a, h) => a + h.peso, 0);
  let resto = ruido(llave) * total;
  for (const h of HORAS_DEMANDA) {
    resto -= h.peso;
    if (resto <= 0) return h.hora;
  }
  return HORAS_DEMANDA[HORAS_DEMANDA.length - 1].hora;
}

// ───────────────────────────────────────────────────────────────────
//  Clientes
// ───────────────────────────────────────────────────────────────────

const NOMBRES_DEMO = [
  "María Fernanda Rojas",
  "José Pablo Vargas",
  "Andrea Solano",
  "Luis Diego Chaves",
  "Daniela Mora",
  "Carlos Jiménez",
  "Karla Ramírez",
  "Esteban Castro",
  "Natalia Herrera",
  "Randall Araya",
  "Pamela Quirós",
  "Marco Villalobos",
  "Silvia Campos",
  "Greivin Salas",
  "Adriana Brenes",
  "Óscar Madrigal",
  "Viviana Alfaro",
  "Johan Segura",
  "Melissa Cordero",
  "Alonso Picado",
  "Rebeca Monge",
  "Diego Sandí",
  "Laura Espinoza",
  "Kevin Fallas",
  "Sofía Granados",
  "Allan Zúñiga",
  "Priscilla Arias",
  "Gerardo Montero",
  "Valeria Calderón",
  "Jorge Umaña",
  "Nicole Barrantes",
  "Fabián Cascante",
];

/**
 * La muestra CON NOMBRE de los 214 clientes del período: los que
 * reservaron con cuenta de Bookea (el resto entró como invitado y solo
 * cuenta en el agregado). La muestra se inclina a recurrentes a
 * propósito: quien repite es quien se hace la cuenta. Los primeros 12
 * son recurrentes (2-6 visitas), los otros 20 son nuevos (1 visita) —
 * misma dirección que el agregado 163 nuevos / 51 recurrentes.
 */
export const CLIENTES_DEMO: ClienteDemo[] = NOMBRES_DEMO.map((nombre, i) => {
  const recurrente = i < 12;
  const visitas = recurrente ? 2 + Math.floor(ruido(nombre + "|v") * 5) : 1;
  const ultimaVisita = sumarDiasISO(HOY_DEMO, -Math.floor(ruido(nombre + "|u") * 28) - 1);
  // Consumo estimado: visitas × ticket por mesa, con ±15% de variación
  // determinista y redondeado a la centena — es una estimación y
  // mostrarla al colón la haría parecer un dato contable que no es.
  const totalEstimado =
    Math.round((visitas * TICKET_PROMEDIO_DEMO * (0.85 + 0.3 * ruido(nombre + "|t"))) / 100) * 100;
  return {
    id: "cli-" + String(i + 1).padStart(2, "0"),
    nombre,
    visitas,
    ultimaVisita,
    totalEstimado,
    tipo: recurrente ? "recurrente" : "nuevo",
  };
});

// ───────────────────────────────────────────────────────────────────
//  Promociones
// ───────────────────────────────────────────────────────────────────

/**
 * Cuatro promos con embudo completo (vistas → reservas → check-ins).
 * Los números están elegidos con una relación exacta: la conversión de
 * la promo de cena (32/697) es ~18% mayor que la del resto junto
 * (35/900) — el tercer insight DERIVA ese 18%, no lo inventa. Las
 * reservas por promo (67) son un subconjunto de las 87 del período y
 * sus check-ins (59) de los 76.
 */
export const PROMOS_DEMO: PromocionDemo[] = [
  {
    id: "promo-cena",
    nombre: "Cena entre semana −15%",
    detalle: "De 6:00 p.m. a 9:00 p.m. · martes a jueves",
    estado: "activa",
    visualizaciones: 697,
    reservas: 32,
    checkIns: 28,
  },
  {
    id: "promo-almuerzo",
    nombre: "Almuerzo ejecutivo −10%",
    detalle: "De 11:30 a.m. a 1:30 p.m. · lunes a viernes",
    estado: "activa",
    visualizaciones: 450,
    reservas: 18,
    checkIns: 16,
  },
  {
    id: "promo-postre",
    nombre: "Postre de cortesía en parejas",
    detalle: "Mesas de 2 · viernes y sábado",
    estado: "activa",
    visualizaciones: 240,
    reservas: 9,
    checkIns: 8,
  },
  {
    id: "promo-happy",
    nombre: "Happy hour −20% en barra",
    detalle: "De 4:00 p.m. a 6:00 p.m. · jueves y viernes",
    estado: "pausada",
    visualizaciones: 210,
    reservas: 8,
    checkIns: 7,
  },
];

// ───────────────────────────────────────────────────────────────────
//  Reservas históricas
// ───────────────────────────────────────────────────────────────────

/**
 * Se generan DESDE la serie, día por día hacia atrás: cada día aporta
 * exactamente serie.reservas filas y exactamente serie.checkIns de
 * ellas quedan "completada" — la lista y el gráfico nunca se
 * contradicen. Las personas del día se reparten entre sus filas hasta
 * sumar exactamente serie.personas.
 *
 * HOY no aparece a propósito: la sección "Hoy" del dashboard usa las
 * reservas REALES de food_reservations y mezclarle filas de utilería
 * al lado sería mentirle al dueño en la única pantalla operativa.
 * Además hay unas pocas futuras (confirmada/pendiente) para que la
 * pantalla de Reservas muestre el ciclo completo.
 */
function generarReservas(): ReservaDemo[] {
  const filas: ReservaDemo[] = [];

  // Futuras: mañana a +3 días.
  const FUTURAS: { offset: number; personas: number }[] = [
    { offset: 1, personas: 2 },
    { offset: 1, personas: 4 },
    { offset: 1, personas: 2 },
    { offset: 2, personas: 6 },
    { offset: 2, personas: 3 },
    { offset: 3, personas: 2 },
    { offset: 3, personas: 4 },
    { offset: 3, personas: 5 },
  ];
  FUTURAS.forEach((f, j) => {
    const fecha = sumarDiasISO(HOY_DEMO, f.offset);
    filas.push({
      id: "res-f" + j,
      cliente: NOMBRES_DEMO[(j * 7 + 3) % NOMBRES_DEMO.length],
      fecha,
      hora: horaSegunDemanda(fecha + "|hf" + j),
      personas: f.personas,
      estado: j % 3 === 2 ? "pendiente" : "confirmada",
      totalEstimado: null,
    });
  });

  // Pasadas: de ayer hacia atrás hasta juntar 50+.
  let pasadas = 0;
  for (let i = SERIE_90_DIAS.length - 2; i >= 0 && pasadas < 52; i--) {
    const dia = SERIE_90_DIAS[i];
    if (dia.reservas === 0) continue;

    // Repartir las personas del día entre sus reservas (suma exacta).
    const base = Math.floor(dia.personas / dia.reservas);
    const resto = dia.personas - base * dia.reservas;

    const filasDia: ReservaDemo[] = [];
    for (let j = 0; j < dia.reservas; j++) {
      const completada = j < dia.checkIns;
      const r = ruido(dia.fecha + "|e" + j);
      // Las que no llegaron a la mesa se reparten entre canceladas y
      // no-shows; sesgo a cancelada, que es lo más común.
      const estado: EstadoReservaDemo = completada
        ? "completada"
        : r < 0.4
          ? "no_show"
          : "cancelada";
      const personas = base + (j < resto ? 1 : 0);
      filasDia.push({
        id: "res-" + dia.fecha + "-" + j,
        cliente: NOMBRES_DEMO[(ruido(dia.fecha + "|n" + j) * NOMBRES_DEMO.length) | 0],
        fecha: dia.fecha,
        hora: horaSegunDemanda(dia.fecha + "|h" + j),
        personas,
        estado,
        // Consumo estimado por mesa, escalado por el tamaño del grupo
        // respecto del promedio (2,83) y redondeado a la centena.
        totalEstimado: completada
          ? Math.round((TICKET_PROMEDIO_DEMO * personas) / PROMEDIO_PERSONAS / 100) * 100
          : null,
      });
    }
    filasDia.sort((a, b) => b.hora.localeCompare(a.hora));
    filas.push(...filasDia);
    pasadas += filasDia.length;
  }

  return filas;
}

/** 60+ reservas: futuras primero, luego el histórico de ayer hacia atrás. */
export const RESERVAS_DEMO: ReservaDemo[] = generarReservas();

// ───────────────────────────────────────────────────────────────────
//  Insights (calculados, no afirmados)
// ───────────────────────────────────────────────────────────────────

/** Crecimiento % de los jueves: últimos 30 días vs los 30 anteriores. */
function crecimientoJueves(): number {
  const dow = (fecha: string) => {
    const [y, m, d] = fecha.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  };
  const suma = (desde: number, hasta: number) =>
    SERIE_90_DIAS.slice(desde, hasta)
      .filter((p) => dow(p.fecha) === 4)
      .reduce((a, p) => a + p.reservas, 0);
  const actual = suma(60, 90);
  const anterior = suma(30, 60);
  return anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : 0;
}

/** % de reservas que caen entre 7:00 p.m. y 9:00 p.m. (pesos 19 y 20). */
function porcentajePicoCena(): number {
  const total = HORAS_DEMANDA.reduce((a, h) => a + h.peso, 0);
  const pico = HORAS_DEMANDA.filter((h) => h.hora === "19:00" || h.hora === "20:00").reduce(
    (a, h) => a + h.peso,
    0,
  );
  return Math.round((pico / total) * 100);
}

/** Cuánto más convierte la promo de cena que el resto de promos, en %. */
function ventajaPromoCena(): number {
  const cena = PROMOS_DEMO[0];
  const resto = PROMOS_DEMO.slice(1);
  const convCena = cena.reservas / cena.visualizaciones;
  const convResto =
    resto.reduce((a, p) => a + p.reservas, 0) / resto.reduce((a, p) => a + p.visualizaciones, 0);
  return Math.round((convCena / convResto - 1) * 100);
}

/**
 * Los tres insights del "Resumen de tu mes". Cada número sale de los
 * datos de arriba (la serie, la distribución horaria, las promos) —
 * si alguien recalibra las anclas, los insights se recalculan solos y
 * el resumen nunca queda contando una historia vieja.
 */
export const INSIGHTS_DEMO: InsightDemo[] = [
  {
    id: "jueves",
    texto:
      crecimientoJueves() > 0
        ? "Los jueves son tu día que más crece: +" +
          crecimientoJueves() +
          "% de reservas frente a los 30 días anteriores."
        : "Los jueves se mantienen estables frente a los 30 días anteriores.",
  },
  {
    id: "pico-cena",
    texto:
      "Entre 7:00 p.m. y 9:00 p.m. se concentra el " +
      porcentajePicoCena() +
      "% de tus reservas — mantené franjas abiertas en esas horas.",
  },
  {
    id: "promo-cena",
    texto:
      "La promo de cena convierte un " +
      ventajaPromoCena() +
      "% más que el resto de tus promociones.",
  },
];

// ───────────────────────────────────────────────────────────────────
//  Comparación mensual y visitas al perfil (pantalla de Rendimiento)
// ───────────────────────────────────────────────────────────────────

/** Un "antes vs ahora" de una métrica, con su % derivado de ambas cifras. */
export type ComparacionMetrica = {
  actual: number;
  anterior: number;
  /** SIEMPRE variacionPorcentual(actual, anterior) — nunca un % declarado aparte. */
  variacion: number;
};

/**
 * La tarjeta "¿Bookea te está ayudando?" de Rendimiento: este mes
 * contra el anterior. Solo tiene las dos métricas cuyo "antes" está
 * anclado arriba (reservas y ventas estimadas) — agregar acá una
 * métrica exige anclar su mes anterior primero, para que el % siga
 * saliendo de las dos cifras que la tarjeta enseña. Es SIEMPRE
 * 30 vs 30 días, aunque el selector de rango esté en 7 o 90: "el mes"
 * es la unidad en la que un dueño decide si algo le está funcionando.
 */
export const COMPARACION_MES_DEMO: {
  reservas: ComparacionMetrica;
  ventas: ComparacionMetrica;
} = {
  reservas: {
    actual: RESERVAS_30,
    anterior: RESERVAS_MES_ANTERIOR,
    variacion: variacionPorcentual(RESERVAS_30, RESERVAS_MES_ANTERIOR),
  },
  ventas: {
    actual: VENTAS_ESTIMADAS_30_DEMO,
    anterior: VENTAS_ESTIMADAS_MES_ANTERIOR_DEMO,
    variacion: variacionPorcentual(VENTAS_ESTIMADAS_30_DEMO, VENTAS_ESTIMADAS_MES_ANTERIOR_DEMO),
  },
};

/**
 * Visitas al perfil público del restaurante en 30 días. Es el
 * denominador de la "conversión" del panel de Rendimiento: de cada
 * visita que Bookea le acerca al restaurante, cuántas terminan en
 * reserva — 87 ÷ 680 ≈ 12,8 %. El ancla es la visita (lo que un día
 * saldrá de analítica real del perfil) y el % se deriva, no al revés.
 */
export const VISITAS_PERFIL_30_DEMO = 680;
