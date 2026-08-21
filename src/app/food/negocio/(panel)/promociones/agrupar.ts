import { fechaCorta, horaCorta } from "@/lib/food/tipos";

/**
 * DE FRANJAS A PROMOCIONES. En FOOD no existe una tabla de promos: la
 * franja con descuento ES la promoción (así se diseñó la 0190 — el
 * descuento vive en food_franjas y el público lo ve ahí). Pero el
 * dueño no piensa en "48 filas con 15 %": piensa en "la promo de cena
 * de martes a jueves". Este módulo hace esa traducción — agrupa las
 * franjas vigentes por (descuento, momento del día) y deriva de las
 * filas REALES el texto de la card: días, horario y vigencia.
 *
 * Módulo neutro a propósito (sin "use server" ni "use client"): lo
 * consume la página en servidor, y sus tipos viajan a las cards
 * cliente como `import type`. Nada de acá toca la base.
 */

/** Lo que la página lee de food_franjas para armar promociones. */
export type FranjaDescuento = {
  id: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:MM" o "HH:MM:SS", como la guarda Postgres. */
  hora: string;
  capacidad: number;
  reservado: number;
  descuento_porcentaje: number;
  activa: boolean;
};

/** Una promoción: el resumen humano de un grupo de franjas reales. */
export type Promocion = {
  /** `${descuento}|${momento}` — estable mientras exista el grupo. */
  clave: string;
  descuento: number;
  /** "Desayuno" | "Almuerzo" | "Tarde" | "Cena", según la hora. */
  momento: string;
  /** "de martes a jueves", "los sábados", "todos los días"… */
  dias: string;
  /** "6:00 p.m. – 9:00 p.m." (o una sola hora si todas coinciden). */
  horario: string;
  /** "hasta el 30 set" — la última fecha abierta del grupo. */
  vigencia: string;
  /** Los ids reales, para prender/apagar el grupo entero de un tiro. */
  franjaIds: string[];
  franjas: number;
  /** Cuántas de esas franjas están prendidas ahora mismo. */
  activas: number;
  cupoTotal: number;
  /** Cupos ya reservados — dato REAL, no utilería. */
  reservado: number;
};

/** Día de semana (0 = domingo) de un "YYYY-MM-DD", sin zona local. */
function dow(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * El momento del día de una hora de servicio. Los cortes son los de un
 * restaurante urbano de Costa Rica (almuerzo hasta las 3, cena desde
 * las 6) — los mismos que usa la distribución de demanda del demo.
 */
function momentoDe(hora: string): string {
  const h = Number(hora.split(":")[0]);
  if (h < 11) return "Desayuno";
  if (h < 15) return "Almuerzo";
  if (h < 18) return "Tarde";
  return "Cena";
}

const ORDEN_CR = [1, 2, 3, 4, 5, 6, 0];
const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "los martes" / "los sábados" — lunes..viernes son invariables en plural. */
function unDia(d: number): string {
  const nombre = NOMBRE_DIA[d];
  return `los ${nombre}${d === 0 || d === 6 ? "s" : ""}`;
}

/**
 * El texto de días tal como lo diría el dueño: un tramo contiguo se
 * lee "de martes a jueves"; un par o días sueltos se enumeran; la
 * semana entera es "todos los días".
 */
function diasTexto(dows: Set<number>): string {
  if (dows.size >= 7) return "todos los días";
  const presentes = ORDEN_CR.filter((d) => dows.has(d));
  if (presentes.length === 1) return unDia(presentes[0]);

  const posiciones = presentes.map((d) => ORDEN_CR.indexOf(d));
  const contiguo = posiciones.every((v, i) => i === 0 || v === posiciones[i - 1] + 1);
  if (contiguo && presentes.length >= 3) {
    return `de ${NOMBRE_DIA[presentes[0]]} a ${NOMBRE_DIA[presentes[presentes.length - 1]]}`;
  }
  const nombres = presentes.map((d) => NOMBRE_DIA[d]);
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * Agrupa las franjas vigentes en promociones, ordenadas del descuento
 * mayor al menor (la oferta más fuerte encabeza la pantalla, igual que
 * encabezaría la vitrina).
 */
export function agruparPromociones(franjas: FranjaDescuento[]): Promocion[] {
  const grupos = new Map<string, FranjaDescuento[]>();
  for (const f of franjas) {
    const clave = `${f.descuento_porcentaje}|${momentoDe(f.hora)}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(f);
    else grupos.set(clave, [f]);
  }

  const promos: Promocion[] = [];
  for (const [clave, filas] of grupos) {
    const dows = new Set(filas.map((f) => dow(f.fecha)));
    const horas = [...new Set(filas.map((f) => f.hora))].sort();
    const ultimaFecha = filas.reduce((max, f) => (f.fecha > max ? f.fecha : max), filas[0].fecha);
    promos.push({
      clave,
      descuento: filas[0].descuento_porcentaje,
      momento: momentoDe(filas[0].hora),
      dias: diasTexto(dows),
      horario:
        horas.length === 1
          ? horaCorta(horas[0])
          : `${horaCorta(horas[0])} – ${horaCorta(horas[horas.length - 1])}`,
      vigencia: `hasta el ${fechaCorta(ultimaFecha)}`,
      franjaIds: filas.map((f) => f.id),
      franjas: filas.length,
      activas: filas.filter((f) => f.activa).length,
      cupoTotal: filas.reduce((a, f) => a + f.capacidad, 0),
      reservado: filas.reduce((a, f) => a + f.reservado, 0),
    });
  }

  return promos.sort((a, b) => b.descuento - a.descuento || a.momento.localeCompare(b.momento));
}
