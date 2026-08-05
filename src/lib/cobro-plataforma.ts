import {
  aFecha,
  claveFecha,
  inicioDeSemana,
  rangoSemana,
  sumarDias,
  totalEvento,
} from "@/lib/finanzas";

/**
 * Lo que la PLATAFORMA gana (o ganaría) por cada negocio — no confundir
 * con src/lib/finanzas.ts, que son las finanzas del dueño del negocio.
 * De ahí solo se importan helpers puros (fechas, totalEvento).
 *
 * Módulo neutral sin "use client": lo importan el server component de
 * /admin/finanzas y los componentes cliente del balance. Todo puro,
 * probado en cobro-plataforma.test.ts.
 *
 * Mientras no exista pasarela, TODO lo que sale de acá es PROYECCIÓN
 * según la tarifa configurada — la UI lo dice siempre.
 */

export const MODELOS_COBRO = [
  "comision_por_persona",
  "comision_porcentaje",
  "comision_fija_reserva",
  "membresia_mensual",
  "gratis",
] as const;

export type ModeloCobro = (typeof MODELOS_COBRO)[number];

export const MODELO_COBRO_LABEL: Record<ModeloCobro, string> = {
  comision_por_persona: "Comisión por persona",
  comision_porcentaje: "% del evento",
  comision_fija_reserva: "Monto fijo por reserva",
  membresia_mensual: "Membresía mensual",
  gratis: "Gratis",
};

export type CobroNegocio = {
  rancho_id: string;
  modelo: ModeloCobro;
  valor: number;
  notas?: string | null;
};

export type CobroResuelto = CobroNegocio & {
  /** true = no tiene tarifa propia; aplica el default global (₡/persona). */
  esGlobal: boolean;
};

/** Lo mínimo que necesita el cálculo de una reserva. */
export type ReservaCobro = {
  id: string;
  fecha: string;
  invitados: number | null;
  rancho_id: string | null;
  monto_total?: number | null;
  monto_cobrado_final?: number | null;
};

/** Etiqueta corta del modelo para el ranking: "₡150/persona (global)". */
export function etiquetaCobro(cobro: CobroResuelto): string {
  const colones = (n: number) => `₡${Math.round(n).toLocaleString("es-CR")}`;
  const base =
    cobro.modelo === "comision_por_persona"
      ? `${colones(cobro.valor)}/persona`
      : cobro.modelo === "comision_porcentaje"
        ? `${cobro.valor}% del evento`
        : cobro.modelo === "comision_fija_reserva"
          ? `${colones(cobro.valor)}/reserva`
          : cobro.modelo === "membresia_mensual"
            ? `${colones(cobro.valor)}/mes`
            : "Gratis";
  return cobro.esGlobal ? `${base} (global)` : base;
}

/**
 * La tarifa que le aplica a un negocio: la suya propia si la tiene,
 * o el default global (₡ por persona, configuracion_plataforma).
 */
export function resolverCobro(
  ranchoId: string,
  cobrosPorRancho: Map<string, CobroNegocio>,
  comisionGlobal: number,
): CobroResuelto {
  const propio = cobrosPorRancho.get(ranchoId);
  if (propio) return { ...propio, esGlobal: false };
  return {
    rancho_id: ranchoId,
    modelo: "comision_por_persona",
    valor: comisionGlobal,
    esGlobal: true,
  };
}

/**
 * Personas que cuentan para la comisión: mínimo 1 por reserva — una
 * cita sin invitados es UNA persona atendida, no cero. (Unifica la
 * convención: el cálculo viejo de comisión real usaba `invitados ?? 0`
 * y el simulado `max(1, ...)`; gana el segundo, que es el honesto.)
 */
export function personasDeReserva(r: ReservaCobro): number {
  return Math.max(1, r.invitados ?? 1);
}

/** Lo que esta reserva le deja a la plataforma según la tarifa del negocio. */
export function ingresoPorReserva(r: ReservaCobro, cobro: CobroResuelto): number {
  switch (cobro.modelo) {
    case "comision_por_persona":
      return personasDeReserva(r) * cobro.valor;
    case "comision_porcentaje":
      // totalEvento: manda lo cobrado real sobre la cotización. Una
      // reserva sin monto aporta ₡0 — la UI avisa cuántas hay así,
      // para que el modelo de % no parezca "no funcionar".
      return (
        (totalEvento({
          monto_total: r.monto_total ?? null,
          monto_cobrado_final: r.monto_cobrado_final ?? null,
        } as Parameters<typeof totalEvento>[0]) *
          cobro.valor) /
        100
      );
    case "comision_fija_reserva":
      return cobro.valor;
    // La membresía no depende de reservas: se calcula aparte, por mes.
    case "membresia_mensual":
    case "gratis":
      return 0;
  }
}

/** Meses calendario (YYYY-MM) que toca el rango, inclusivo. */
export function mesesDelRango(desde: Date, hasta: Date): string[] {
  const meses: string[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  while (cursor <= fin) {
    meses.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}

/**
 * Lo que deja la membresía en el rango: valor × meses calendario que
 * el rango toca. Un mes parcialmente cubierto cuenta ENTERO — se cobra
 * el mes, no los días; prorratear inventaría una precisión que el
 * cobro real no tiene.
 */
export function ingresoMembresia(cobro: CobroResuelto, desde: Date, hasta: Date): number {
  if (cobro.modelo !== "membresia_mensual") return 0;
  return cobro.valor * mesesDelRango(desde, hasta).length;
}

export type GranularidadDesglose = "dia" | "semana" | "mes";

export type BucketDesglose = {
  clave: string;
  etiqueta: string;
  reservas: number;
  personas: number;
  ingreso: number;
};

function claveMes(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function etiquetaMes(clave: string): string {
  const [y, m] = clave.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CR", {
    month: "long",
    year: "numeric",
  });
}

function etiquetaDia(clave: string): string {
  return aFecha(clave).toLocaleDateString("es-CR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * El desglose temporal de un negocio: qué dejó (proyectado) cada día,
 * semana o mes del rango. Incluye buckets vacíos para que la tabla no
 * tenga huecos. La membresía NO se reparte acá — se muestra como línea
 * fija aparte (ingresoMembresia), porque no depende de las reservas.
 */
export function desglose(
  reservas: ReservaCobro[],
  cobro: CobroResuelto,
  desde: Date,
  hasta: Date,
  granularidad: GranularidadDesglose,
): BucketDesglose[] {
  const buckets = new Map<string, BucketDesglose>();

  // Primero el esqueleto completo del rango, para no dejar huecos.
  if (granularidad === "mes") {
    for (const clave of mesesDelRango(desde, hasta)) {
      buckets.set(clave, { clave, etiqueta: etiquetaMes(clave), reservas: 0, personas: 0, ingreso: 0 });
    }
  } else if (granularidad === "semana") {
    let cursor = inicioDeSemana(desde);
    const fin = inicioDeSemana(hasta);
    while (cursor <= fin) {
      const clave = claveFecha(cursor);
      buckets.set(clave, { clave, etiqueta: rangoSemana(cursor), reservas: 0, personas: 0, ingreso: 0 });
      cursor = sumarDias(cursor, 7);
    }
  } else {
    let cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    while (cursor <= hasta) {
      const clave = claveFecha(cursor);
      buckets.set(clave, { clave, etiqueta: etiquetaDia(clave), reservas: 0, personas: 0, ingreso: 0 });
      cursor = sumarDias(cursor, 1);
    }
  }

  for (const r of reservas) {
    const fecha = aFecha(r.fecha);
    if (fecha < desde || fecha > hasta) continue;
    const clave =
      granularidad === "mes"
        ? claveMes(fecha)
        : granularidad === "semana"
          ? claveFecha(inicioDeSemana(fecha))
          : claveFecha(fecha);
    const bucket = buckets.get(clave);
    if (!bucket) continue;
    bucket.reservas += 1;
    bucket.personas += personasDeReserva(r);
    bucket.ingreso += ingresoPorReserva(r, cobro);
  }

  return [...buckets.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

export type IngresoRancho = {
  reservas: number;
  personas: number;
  /** Lo proyectado por reservas + membresía del rango, según SU tarifa. */
  ingreso: number;
  /** Cuántas reservas del rango no tienen monto (solo importa con %). */
  sinMonto: number;
  cobro: CobroResuelto;
};

/**
 * Lo que deja cada negocio en el rango, con la tarifa que le aplique
 * (propia o global). Reemplaza el cálculo inline del balance-panel.
 */
export function ingresoPorRancho(
  reservas: ReservaCobro[],
  cobros: Map<string, CobroNegocio>,
  comisionGlobal: number,
  desde: Date,
  hasta: Date,
): Map<string, IngresoRancho> {
  const acc = new Map<string, IngresoRancho>();
  for (const r of reservas) {
    if (!r.rancho_id) continue;
    const fecha = aFecha(r.fecha);
    if (fecha < desde || fecha > hasta) continue;
    let fila = acc.get(r.rancho_id);
    if (!fila) {
      fila = {
        reservas: 0,
        personas: 0,
        ingreso: 0,
        sinMonto: 0,
        cobro: resolverCobro(r.rancho_id, cobros, comisionGlobal),
      };
      acc.set(r.rancho_id, fila);
    }
    fila.reservas += 1;
    fila.personas += personasDeReserva(r);
    fila.ingreso += ingresoPorReserva(r, fila.cobro);
    if (!Number(r.monto_cobrado_final ?? r.monto_total ?? 0)) fila.sinMonto += 1;
  }

  // La membresía entra aunque el negocio no haya tenido reservas en el
  // rango — es lo que la hace membresía. Se agregan los negocios con
  // tarifa de membresía que quedaron fuera del loop de reservas.
  for (const [ranchoId, cobro] of cobros) {
    if (cobro.modelo !== "membresia_mensual") continue;
    let fila = acc.get(ranchoId);
    if (!fila) {
      fila = {
        reservas: 0,
        personas: 0,
        ingreso: 0,
        sinMonto: 0,
        cobro: { ...cobro, esGlobal: false },
      };
      acc.set(ranchoId, fila);
    }
    fila.ingreso += ingresoMembresia(fila.cobro, desde, hasta);
  }

  return acc;
}
