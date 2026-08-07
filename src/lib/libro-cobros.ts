import { aFecha, claveFecha, inicioDeSemana, mismoMes, sumarDias } from "@/lib/finanzas";

/**
 * EL LIBRO DE COBROS — lo que la plataforma YA DEVENGÓ.
 *
 * No confundir con src/lib/cobro-plataforma.ts: aquel PROYECTA lo que
 * se ganaría si se aplicara la tarifa de hoy a las reservas de un
 * rango, y se recalcula entero cada vez que se abre la pantalla. Esto
 * de acá lee filas de `cobros_plataforma` (migración 0106), donde cada
 * reserva confirmada dejó su monto CONGELADO. Uno es una simulación;
 * el otro es una cuenta por cobrar.
 *
 * La unidad de cobro es SEMANA × NEGOCIO: al negocio se le pasa la
 * cuenta de la semana completa, no reserva por reserva. Por eso todo
 * acá agrupa por ese par, y "marcar pagada" opera sobre el grupo.
 *
 * Módulo neutral (sin "use client"): lo importan el server component
 * de /admin/finanzas, la server action y el panel del navegador. Todo
 * puro y probado en libro-cobros.test.ts.
 */

export const ESTADOS_COBRO = ["pendiente", "pagado", "anulado"] as const;
export type EstadoCobro = (typeof ESTADOS_COBRO)[number];

export const CONCEPTOS_COBRO = ["reserva", "cancelacion"] as const;
export type ConceptoCobro = (typeof CONCEPTOS_COBRO)[number];

export const CONCEPTO_LABEL: Record<ConceptoCobro, string> = {
  reserva: "Reserva confirmada",
  cancelacion: "10 % del depósito retenido",
};

/** Una fila de `cobros_plataforma`, tal como sale de la base. */
export type CobroPlataforma = {
  id: string;
  reserva_id: string | null;
  rancho_id: string | null;
  concepto: ConceptoCobro;
  personas: number;
  tarifa: number;
  modelo: string;
  monto: number;
  estado: EstadoCobro;
  /** El LUNES de la semana a la que pertenece (YYYY-MM-DD). */
  semana: string;
  cliente: string | null;
  fecha_evento: string | null;
  devengado_en: string;
  pagado_en: string | null;
  notas: string | null;
};

/** Un renglón de la cuenta: semana + negocio, con sus cobros adentro. */
export type GrupoCobros = {
  /** estado|semana|negocio — estable, sirve de key de React. */
  clave: string;
  estado: Exclude<EstadoCobro, "anulado">;
  semana: string;
  semanaEtiqueta: string;
  ranchoId: string | null;
  negocio: string;
  cobros: CobroPlataforma[];
  /** Cobros de concepto 'reserva' (los de cancelación no son reservas). */
  reservas: number;
  /** Los 10 % de depósito retenido: suman plata pero no son reservas,
   *  y sin nombrarlos el total del grupo no cuadra con la cuenta. */
  cancelaciones: number;
  personas: number;
  total: number;
  /** Cuándo se marcó pagado el grupo (el más reciente de sus cobros). */
  pagadoEn: string | null;
};

export type LibroAgrupado = {
  porCobrar: GrupoCobros[];
  pagados: GrupoCobros[];
  /** Los anulados no se agrupan: se listan apagados, con su razón. */
  anulados: CobroPlataforma[];
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "Lunes 3 → domingo 9 de agosto" — la semana dicha como la dice el
 * dueño. Si la semana se parte entre dos meses (o dos años) se nombran
 * los dos, que si no queda ambigua.
 */
export function etiquetaSemana(semanaIso: string): string {
  const inicio = aFecha(semanaIso);
  const fin = sumarDias(inicio, 6);
  const mesInicio = MESES[inicio.getMonth()];
  const mesFin = MESES[fin.getMonth()];

  if (inicio.getFullYear() !== fin.getFullYear()) {
    return `Lunes ${inicio.getDate()} de ${mesInicio} ${inicio.getFullYear()} → domingo ${fin.getDate()} de ${mesFin} ${fin.getFullYear()}`;
  }
  if (inicio.getMonth() !== fin.getMonth()) {
    return `Lunes ${inicio.getDate()} de ${mesInicio} → domingo ${fin.getDate()} de ${mesFin}`;
  }
  return `Lunes ${inicio.getDate()} → domingo ${fin.getDate()} de ${mesFin}`;
}

/** La semana de corte (lunes) a la que cae una fecha, en clave YYYY-MM-DD. */
export function semanaDe(d: Date): string {
  return claveFecha(inicioDeSemana(d));
}

function nombreDe(
  ranchoId: string | null,
  nombrePorRancho: Map<string, string> | Record<string, string>,
): string {
  if (!ranchoId) return "Negocio dado de baja";
  const nombre =
    nombrePorRancho instanceof Map
      ? nombrePorRancho.get(ranchoId)
      : nombrePorRancho[ranchoId];
  return nombre ?? "Negocio dado de baja";
}

/**
 * Arma la cuenta: un grupo por semana × negocio × estado.
 *
 * El estado entra en la clave a propósito. Si alguien marcó pagada UNA
 * sola reserva de la semana, lo pagado se va al histórico y lo que
 * queda sigue en "por cobrar" — mezclarlos escondería plata.
 *
 * Orden: lo por cobrar de la semana MÁS VIEJA primero (es la deuda que
 * lleva más tiempo esperando); el histórico, lo cobrado más reciente
 * arriba.
 */
export function agruparCobros(
  cobros: CobroPlataforma[],
  nombrePorRancho: Map<string, string> | Record<string, string>,
): LibroAgrupado {
  const grupos = new Map<string, GrupoCobros>();
  const anulados: CobroPlataforma[] = [];

  for (const c of cobros) {
    if (c.estado === "anulado") {
      anulados.push(c);
      continue;
    }
    const clave = `${c.estado}|${c.semana}|${c.rancho_id ?? "sin-negocio"}`;
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = {
        clave,
        estado: c.estado,
        semana: c.semana,
        semanaEtiqueta: etiquetaSemana(c.semana),
        ranchoId: c.rancho_id,
        negocio: nombreDe(c.rancho_id, nombrePorRancho),
        cobros: [],
        reservas: 0,
        cancelaciones: 0,
        personas: 0,
        total: 0,
        pagadoEn: null,
      };
      grupos.set(clave, grupo);
    }
    grupo.cobros.push(c);
    if (c.concepto === "reserva") grupo.reservas += 1;
    else grupo.cancelaciones += 1;
    grupo.personas += Number(c.personas ?? 0);
    grupo.total += Number(c.monto ?? 0);
    if (c.pagado_en && (!grupo.pagadoEn || c.pagado_en > grupo.pagadoEn)) {
      grupo.pagadoEn = c.pagado_en;
    }
  }

  // Dentro del grupo, la reserva más vieja primero: se lee como una
  // cuenta de cobro, en el orden en que fueron cayendo.
  for (const grupo of grupos.values()) {
    grupo.cobros.sort((a, b) => a.devengado_en.localeCompare(b.devengado_en));
  }

  const todos = [...grupos.values()];
  const porCobrar = todos
    .filter((g) => g.estado === "pendiente")
    .sort((a, b) => a.semana.localeCompare(b.semana) || a.negocio.localeCompare(b.negocio));
  const pagados = todos
    .filter((g) => g.estado === "pagado")
    .sort(
      (a, b) =>
        (b.pagadoEn ?? "").localeCompare(a.pagadoEn ?? "") ||
        b.semana.localeCompare(a.semana) ||
        a.negocio.localeCompare(b.negocio),
    );

  anulados.sort((a, b) => b.devengado_en.localeCompare(a.devengado_en));

  return { porCobrar, pagados, anulados };
}

export type ResumenLibro = {
  /** Lo devengado en la semana en curso (pendiente + ya pagado). */
  devengadoSemana: number;
  reservasSemana: number;
  /** Todo lo que está por cobrar, de todas las semanas. */
  pendienteTotal: number;
  /** Cuántos grupos (semana × negocio) hay por cobrar. */
  gruposPendientes: number;
  /** Cuántas semanas distintas quedaron sin cobrar. */
  semanasPendientes: number;
  /** Lo marcado como pagado dentro del mes calendario en curso. */
  cobradoMes: number;
  /** La semana de corte en curso, en clave YYYY-MM-DD. */
  semanaActual: string;
  semanaActualEtiqueta: string;
};

/**
 * Los tres números de arriba: la semana en curso, lo que se debe en
 * total y lo cobrado en el mes. Los anulados no cuentan en ninguno —
 * dejaron de ser plata.
 */
export function resumenLibro(
  cobros: CobroPlataforma[],
  hoy: Date = new Date(),
): ResumenLibro {
  const semanaActual = semanaDe(hoy);
  let devengadoSemana = 0;
  let reservasSemana = 0;
  let pendienteTotal = 0;
  let cobradoMes = 0;
  const gruposPendientes = new Set<string>();
  const semanasPendientes = new Set<string>();

  for (const c of cobros) {
    if (c.estado === "anulado") continue;
    const monto = Number(c.monto ?? 0);

    if (c.semana === semanaActual) {
      devengadoSemana += monto;
      if (c.concepto === "reserva") reservasSemana += 1;
    }

    if (c.estado === "pendiente") {
      pendienteTotal += monto;
      gruposPendientes.add(`${c.semana}|${c.rancho_id ?? "sin-negocio"}`);
      semanasPendientes.add(c.semana);
    }

    if (c.estado === "pagado" && c.pagado_en) {
      const cuando = new Date(c.pagado_en);
      if (!Number.isNaN(cuando.getTime()) && mismoMes(cuando, hoy)) cobradoMes += monto;
    }
  }

  return {
    devengadoSemana,
    reservasSemana,
    pendienteTotal,
    gruposPendientes: gruposPendientes.size,
    semanasPendientes: semanasPendientes.size,
    cobradoMes,
    semanaActual,
    semanaActualEtiqueta: etiquetaSemana(semanaActual),
  };
}

/**
 * Cómo salió el monto de un cobro, en una línea: "40 personas × ₡150".
 * Se lee de la fila congelada, no de la tarifa de hoy.
 */
export function explicarCobro(c: CobroPlataforma): string {
  const colones = (n: number) => `₡${Math.round(n).toLocaleString("es-CR")}`;
  switch (c.modelo) {
    case "comision_por_persona":
      return `${c.personas} persona${c.personas === 1 ? "" : "s"} × ${colones(c.tarifa)}`;
    case "comision_fija_reserva":
      return `${colones(c.tarifa)} fijos por reserva`;
    case "comision_porcentaje":
      return `${c.tarifa}% del evento`;
    case "porcentaje_deposito":
      return `${c.tarifa}% del depósito retenido`;
    default:
      return c.modelo;
  }
}

/**
 * ¿El error es "esa tabla no existe"? Pasa mientras la 0106 no se haya
 * corrido: el código ya consulta `cobros_plataforma` pero la tabla no
 * está. Vienen por dos caminos y hay que reconocer los dos (igual que
 * `esColumnaInexistente` en src/lib/precios.ts): el 42P01 de Postgres
 * y el PGRST205 de PostgREST, que ni siquiera llega a la base.
 */
export function esTablaCobrosInexistente(error: {
  code?: string;
  message?: string;
}): boolean {
  const mensaje = (error.message ?? "").toLowerCase();
  if (
    mensaje.includes("cobros_plataforma") &&
    (mensaje.includes("does not exist") || mensaje.includes("could not find"))
  ) {
    return true;
  }
  return error.code === "42P01" || error.code === "PGRST205";
}

/** El archivo que hay que pegar en el SQL Editor si la tabla no está. */
export const MIGRACION_LIBRO = "supabase/migrations/0106_libro_cobros_plataforma.sql";

/** Los ids pendientes de un grupo: lo que la acción de cobrar toca. */
export function idsPendientes(grupo: GrupoCobros): string[] {
  return grupo.cobros.filter((c) => c.estado === "pendiente").map((c) => c.id);
}

/** Los ids pagados de un grupo: lo que se devolvería a pendiente. */
export function idsPagados(grupo: GrupoCobros): string[] {
  return grupo.cobros.filter((c) => c.estado === "pagado").map((c) => c.id);
}
