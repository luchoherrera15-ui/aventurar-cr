import {
  adelantoCobrado,
  aFecha,
  esIngresoReal,
  esReservaViva,
  saldoCobrado,
  saldoPendiente,
  totalEvento,
  type ReservaFinanzas,
} from "@/lib/finanzas";
import {
  personasDeReserva,
  resolverCobro,
  type CobroNegocio,
  type CobroResuelto,
} from "@/lib/cobro-plataforma";
import type { CobroPlataforma } from "@/lib/libro-cobros";

/**
 * AUDITORÍA DEL DINERO — el recorrido completo de UNA reserva.
 *
 * Las otras dos pantallas de plata miran agregados: `finanzas.ts` es la
 * caja del negocio y `libro-cobros.ts` agrupa la comisión por semana ×
 * negocio. Ninguna de las dos responde la pregunta del dueño de Bookea:
 * *"esta reserva, ¿qué pasó con su plata, paso por paso?"*. Eso es lo
 * que arma este módulo.
 *
 * Módulo NEUTRO (sin "use client"): lo importan el server component de
 * /admin/auditoria y el panel del navegador. Todo puro y probado en
 * auditoria-dinero.test.ts.
 *
 * ── LA REGLA QUE ORDENA TODO ─────────────────────────────────────────
 *
 * Acá no se inventa un solo número. Si un dato no está en la base, la
 * fila lo dice ("sin fecha registrada") en vez de rellenarlo con una
 * aproximación: el propósito de una auditoría es exactamente el
 * contrario. Por eso hay cosas que este módulo NO responde, y las
 * nombra en LO_QUE_LA_BASE_NO_GUARDA — un auditor necesita saber qué
 * no es auditable tanto como lo que sí.
 */

// ------------------------------------------------------------
// Lo que entra
// ------------------------------------------------------------

/** Una reserva con lo que hace falta para reconstruir su plata. */
export type ReservaAuditoria = ReservaFinanzas & {
  rancho_id: string | null;
  metodo_pago: string | null;
  /** Solo el sí/no: la ruta del comprobante no se pasa al navegador. */
  tiene_comprobante: boolean;
  created_at: string;
};

// ------------------------------------------------------------
// Las alertas — el corazón de la pantalla
// ------------------------------------------------------------

export const ALERTAS = [
  "cobro_duplicado",
  "monto_descuadrado",
  "sin_cobro_plataforma",
  "deposito_sin_validar",
  "validado_sin_fecha",
] as const;

export type ClaveAlerta = (typeof ALERTAS)[number];

/** `hallazgo` = algo está mal y hay que arreglarlo; `revisar` = algo
 *  quedó esperando y alguien tiene que decidir. Se pintan distinto. */
export type GravedadAlerta = "hallazgo" | "revisar";

export const ALERTA_INFO: Record<
  ClaveAlerta,
  { titulo: string; gravedad: GravedadAlerta; explicacion: string }
> = {
  cobro_duplicado: {
    titulo: "Cobros duplicados",
    gravedad: "hallazgo",
    explicacion:
      "La misma reserva dejó dos cobros vivos del mismo concepto en el libro de la plataforma. Uno de los dos le está cobrando de más al negocio.",
  },
  monto_descuadrado: {
    titulo: "Montos que no cuadran",
    gravedad: "hallazgo",
    explicacion:
      "El monto congelado del cobro no coincide con su propia tarifa × personas. Se recalcula únicamente con los datos que la fila guardó, así que un descuadre acá no admite explicación: el número está mal.",
  },
  sin_cobro_plataforma: {
    titulo: "Eventos pasados sin cobro",
    gravedad: "hallazgo",
    explicacion:
      "El evento ya pasó, la reserva está confirmada o cumplida, y no dejó ningún cobro vivo. Es comisión que nunca se devengó. No se cuentan los negocios con tarifa gratis ni de membresía mensual, que por definición no dejan cobro por reserva. Ojo con las reservas anteriores a que existiera el libro de cobros: esas nunca pasaron por el disparador, y para rellenarlas está scripts/backfill-cobros-plataforma.mjs.",
  },
  deposito_sin_validar: {
    titulo: "Depósitos sin validar",
    gravedad: "revisar",
    explicacion:
      "El cliente pactó un adelanto y nadie confirmó todavía que la plata llegó. Hasta que alguien lo marque, ese adelanto no cuenta como ingreso en ningún lado.",
  },
  validado_sin_fecha: {
    titulo: "Validados sin fecha",
    gravedad: "revisar",
    explicacion:
      "El depósito figura validado pero sin la fecha en que se validó. Pasa cuando se marcó desde /admin/eventos, que escribe el sí/no y no la fecha. La plata está bien contada; lo que falta es el rastro.",
  },
};

/** Días que puede esperar un depósito sin validar antes de ser alerta. */
export const UMBRAL_DEPOSITO_DIAS = 3;

/**
 * Lo que esta pantalla NO puede responder porque la base no lo guarda.
 * Va impreso en la página: callarlo sería el peor error de una auditoría.
 */
export const LO_QUE_LA_BASE_NO_GUARDA = [
  "Cuándo se confirmó la reserva. `reservas` no tiene una columna de confirmación; lo más cercano es la fecha en que el cobro de plataforma quedó devengado.",
  "Quién validó el depósito y quién marcó el cobro como pagado. Se guarda la fecha, no la persona.",
  "Si el saldo del día del evento lo acreditó el cobro automático de las 11 p. m. o alguien a mano. No hay columna que lo distinga, así que acá no se adivina.",
] as const;

// ------------------------------------------------------------
// Una fila: el recorrido de una reserva
// ------------------------------------------------------------

export type FilaAuditoria = {
  reserva: ReservaAuditoria;
  negocio: string;
  /** Lo que vale el evento: lo cobrado final si existe, si no la cotización. */
  total: number;
  /** El adelanto PACTADO (exista o no la plata). */
  adelantoPactado: number;
  /** El adelanto que de verdad cuenta como plata del negocio. */
  adelantoEnCaja: number;
  saldoPorCobrar: number;
  saldoEnCaja: number;
  /** Los cobros de plataforma de esta reserva, del más viejo al más nuevo. */
  cobros: CobroPlataforma[];
  comisionDevengada: number;
  comisionCobrada: number;
  comisionAnulada: number;
  /** La tarifa que le aplica HOY al negocio (no la congelada en el cobro). */
  tarifaHoy: CobroResuelto | null;
  /** Días que lleva esperando el depósito sin validar; null si no aplica. */
  diasEsperandoDeposito: number | null;
  yaPaso: boolean;
  alertas: ClaveAlerta[];
  /** Una línea por alerta, con los números concretos del caso. */
  detalles: string[];
};

// ------------------------------------------------------------
// Recalcular un cobro con sus PROPIOS datos congelados
// ------------------------------------------------------------

/**
 * Cuánto tendría que decir `monto` según lo que la misma fila guardó.
 *
 * Devuelve null cuando NO se puede recalcular sin mentir: los modelos
 * por porcentaje se apoyan en el total del evento o en el depósito, y
 * esos montos pueden haber cambiado en `reservas` DESPUÉS de que el
 * cobro se congeló (un `monto_cobrado_final` cargado el día del evento,
 * por ejemplo). Comparar contra el valor de hoy señalaría como error
 * algo que es la vida normal de una reserva.
 */
export function montoEsperadoDelCobro(c: CobroPlataforma): number | null {
  switch (c.modelo) {
    case "comision_por_persona":
      return Math.round(Number(c.personas) * Number(c.tarifa));
    case "comision_fija_reserva":
      return Math.round(Number(c.tarifa));
    default:
      return null;
  }
}

/** ¿Este modelo de tarifa deja cobro por cada reserva? */
export function tarifaDejaCobroPorReserva(modelo: string): boolean {
  return modelo !== "gratis" && modelo !== "membresia_mensual";
}

const colones = (n: number) => `₡${Math.round(n).toLocaleString("es-CR")}`;

/** Días de calendario entre dos ISO (se compara solo la parte de fecha). */
export function diasEntre(desdeIso: string, hastaIso: string): number {
  const a = aFecha(desdeIso);
  const b = aFecha(hastaIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * El día calendario de un timestamp EN COSTA RICA (YYYY-MM-DD).
 *
 * `created_at` se guarda en UTC: una reserva hecha a las 8 de la noche
 * de acá figura como del día siguiente. Contar "días esperando" contra
 * la parte UTC del string daba un día de más en las reservas de la
 * tarde, justo al borde del umbral de la alerta.
 */
export function diaCR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ------------------------------------------------------------
// El armado
// ------------------------------------------------------------

export function construirAuditoria({
  reservas,
  cobros,
  nombrePorRancho,
  cobrosNegocio,
  comisionGlobal,
  hoyIso,
  umbralDeposito = UMBRAL_DEPOSITO_DIAS,
}: {
  reservas: ReservaAuditoria[];
  cobros: CobroPlataforma[];
  nombrePorRancho: Record<string, string>;
  /** Tarifas propias por negocio (0098). Vacío = todos con la global. */
  cobrosNegocio: CobroNegocio[];
  comisionGlobal: number;
  /** "Hoy" en hora de Costa Rica (YYYY-MM-DD), calculado en el servidor. */
  hoyIso: string;
  umbralDeposito?: number;
}): FilaAuditoria[] {
  const porReserva = new Map<string, CobroPlataforma[]>();
  for (const c of cobros) {
    if (!c.reserva_id) continue;
    const lista = porReserva.get(c.reserva_id);
    if (lista) lista.push(c);
    else porReserva.set(c.reserva_id, [c]);
  }

  const tarifasPorRancho = new Map(cobrosNegocio.map((c) => [c.rancho_id, c]));

  return reservas.map((r) =>
    filaDeReserva({
      reserva: r,
      cobros: (porReserva.get(r.id) ?? [])
        .slice()
        .sort((a, b) => a.devengado_en.localeCompare(b.devengado_en)),
      nombrePorRancho,
      tarifasPorRancho,
      comisionGlobal,
      hoyIso,
      umbralDeposito,
    }),
  );
}

function filaDeReserva({
  reserva,
  cobros,
  nombrePorRancho,
  tarifasPorRancho,
  comisionGlobal,
  hoyIso,
  umbralDeposito,
}: {
  reserva: ReservaAuditoria;
  cobros: CobroPlataforma[];
  nombrePorRancho: Record<string, string>;
  tarifasPorRancho: Map<string, CobroNegocio>;
  comisionGlobal: number;
  hoyIso: string;
  umbralDeposito: number;
}): FilaAuditoria {
  const total = totalEvento(reserva);
  const adelantoPactado = Number(reserva.deposito_monto ?? 0);
  const adelantoEnCaja = esIngresoReal(reserva) ? adelantoCobrado(reserva) : 0;
  const saldoPorCobrar = esReservaViva(reserva) ? saldoPendiente(reserva) : 0;
  const saldoEnCaja = esIngresoReal(reserva) ? saldoCobrado(reserva) : 0;

  const vivos = cobros.filter((c) => c.estado !== "anulado");
  const comisionDevengada = vivos.reduce((s, c) => s + Number(c.monto ?? 0), 0);
  const comisionCobrada = cobros
    .filter((c) => c.estado === "pagado")
    .reduce((s, c) => s + Number(c.monto ?? 0), 0);
  const comisionAnulada = cobros
    .filter((c) => c.estado === "anulado")
    .reduce((s, c) => s + Number(c.monto ?? 0), 0);

  const tarifaHoy = reserva.rancho_id
    ? resolverCobro(reserva.rancho_id, tarifasPorRancho, comisionGlobal)
    : null;

  const yaPaso = reserva.fecha.slice(0, 10) < hoyIso;

  const alertas: ClaveAlerta[] = [];
  const detalles: string[] = [];

  // --- 1. Cobros duplicados: dos filas vivas del mismo concepto ---
  const porConcepto = new Map<string, number>();
  for (const c of vivos) {
    porConcepto.set(c.concepto, (porConcepto.get(c.concepto) ?? 0) + 1);
  }
  for (const [concepto, cuantos] of porConcepto) {
    if (cuantos > 1) {
      if (!alertas.includes("cobro_duplicado")) alertas.push("cobro_duplicado");
      const suma = vivos
        .filter((c) => c.concepto === concepto)
        .reduce((s, c) => s + Number(c.monto ?? 0), 0);
      detalles.push(
        `${cuantos} cobros vivos de concepto «${concepto}» para la misma reserva, por ${colones(suma)} en total.`,
      );
    }
  }

  // --- 2. Montos que no cuadran con su propia tarifa congelada ---
  for (const c of vivos) {
    const esperado = montoEsperadoDelCobro(c);
    if (esperado === null) continue;
    if (Math.abs(esperado - Number(c.monto ?? 0)) < 1) continue;
    if (!alertas.includes("monto_descuadrado")) alertas.push("monto_descuadrado");
    detalles.push(
      `Un cobro dice ${colones(Number(c.monto ?? 0))} pero su propia tarifa da ${colones(esperado)}.`,
    );
  }

  // --- 3. Evento pasado sin cobro de plataforma ---
  const cuentaParaComision =
    reserva.estado === "confirmada" || reserva.estado === "cumplida";
  const tarifaCobra = tarifaHoy ? tarifaDejaCobroPorReserva(tarifaHoy.modelo) : true;
  if (yaPaso && cuentaParaComision && reserva.rancho_id && tarifaCobra && vivos.length === 0) {
    alertas.push("sin_cobro_plataforma");
    detalles.push(
      reserva.estado === "cumplida"
        ? "Evento pasado en estado «cumplida» sin ningún cobro vivo: una reserva de Citas puede haber llegado a cumplida sin pasar nunca por confirmada, y entonces el disparador del libro nunca corrió."
        : "Evento pasado y confirmado, sin ningún cobro vivo en el libro de la plataforma.",
    );
  }

  // --- 4. Depósito esperando validación ---
  let diasEsperandoDeposito: number | null = null;
  if (esReservaViva(reserva) && adelantoPactado > 0 && !reserva.deposito_validado) {
    diasEsperandoDeposito = Math.max(0, diasEntre(diaCR(reserva.created_at), hoyIso));
    if (diasEsperandoDeposito >= umbralDeposito) {
      alertas.push("deposito_sin_validar");
      detalles.push(
        `${colones(adelantoPactado)} de adelanto llevan ${diasEsperandoDeposito} día${diasEsperandoDeposito === 1 ? "" : "s"} sin que nadie confirme que llegaron.`,
      );
    }
  }

  // --- 5. Validado pero sin fecha (el rastro incompleto) ---
  if (reserva.deposito_validado && !reserva.deposito_pagado_en && adelantoPactado > 0) {
    alertas.push("validado_sin_fecha");
    detalles.push(
      "El depósito figura validado pero la base no guardó la fecha en que se validó.",
    );
  }

  return {
    reserva,
    negocio: reserva.rancho_id
      ? (nombrePorRancho[reserva.rancho_id] ?? "Negocio dado de baja")
      : "Sin negocio",
    total,
    adelantoPactado,
    adelantoEnCaja,
    saldoPorCobrar,
    saldoEnCaja,
    cobros,
    comisionDevengada,
    comisionCobrada,
    comisionAnulada,
    tarifaHoy,
    diasEsperandoDeposito,
    yaPaso,
    alertas,
    detalles,
  };
}

// ------------------------------------------------------------
// Los totales — SIEMPRE sumas de las filas que se están viendo
// ------------------------------------------------------------

export type ResumenAuditoria = {
  reservas: number;
  totalEventos: number;
  adelantosEnCaja: number;
  saldosEnCaja: number;
  saldoPorCobrar: number;
  comisionDevengada: number;
  comisionCobrada: number;
  /** Devengada menos cobrada: lo que la plataforma todavía tiene que cobrar. */
  comisionPorCobrar: number;
  conAlertas: number;
  porAlerta: Record<ClaveAlerta, number>;
};

/**
 * Suma las filas que recibe y nada más. Se le pasa siempre el MISMO
 * arreglo que la pantalla lista: un total que salga de otra consulta
 * puede no coincidir con lo listado, y ahí la auditoría deja de servir.
 */
export function resumirAuditoria(filas: FilaAuditoria[]): ResumenAuditoria {
  const porAlerta = Object.fromEntries(ALERTAS.map((a) => [a, 0])) as Record<
    ClaveAlerta,
    number
  >;
  let totalEventos = 0;
  let adelantosEnCaja = 0;
  let saldosEnCaja = 0;
  let saldoPorCobrar = 0;
  let comisionDevengada = 0;
  let comisionCobrada = 0;
  let conAlertas = 0;

  for (const f of filas) {
    totalEventos += f.total;
    adelantosEnCaja += f.adelantoEnCaja;
    saldosEnCaja += f.saldoEnCaja;
    saldoPorCobrar += f.saldoPorCobrar;
    comisionDevengada += f.comisionDevengada;
    comisionCobrada += f.comisionCobrada;
    if (f.alertas.length > 0) conAlertas += 1;
    for (const a of f.alertas) porAlerta[a] += 1;
  }

  return {
    reservas: filas.length,
    totalEventos,
    adelantosEnCaja,
    saldosEnCaja,
    saldoPorCobrar,
    comisionDevengada,
    comisionCobrada,
    comisionPorCobrar: comisionDevengada - comisionCobrada,
    conAlertas,
    porAlerta,
  };
}

// ------------------------------------------------------------
// Filtrado (lo usa el panel del navegador)
// ------------------------------------------------------------

export type FiltroAuditoria = {
  /** null = todas; una clave = solo las filas con esa alerta. */
  alerta: ClaveAlerta | null;
  /** true = solo las filas con alguna alerta. */
  soloProblemas: boolean;
  /** Texto libre: cliente o negocio. */
  busqueda: string;
};

export const FILTRO_VACIO: FiltroAuditoria = {
  alerta: null,
  soloProblemas: false,
  busqueda: "",
};

export function filtrarAuditoria(
  filas: FilaAuditoria[],
  filtro: FiltroAuditoria,
): FilaAuditoria[] {
  const texto = filtro.busqueda.trim().toLowerCase();
  return filas.filter((f) => {
    if (filtro.alerta && !f.alertas.includes(filtro.alerta)) return false;
    if (filtro.soloProblemas && f.alertas.length === 0) return false;
    if (texto) {
      const heno = `${f.reserva.nombre ?? ""} ${f.negocio}`.toLowerCase();
      if (!heno.includes(texto)) return false;
    }
    return true;
  });
}

// ------------------------------------------------------------
// Fechas para la pantalla — deterministas y en hora de Costa Rica
// ------------------------------------------------------------

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** "23 ago 2026" a partir de un YYYY-MM-DD. Sin zona horaria de por medio. */
export function fmtDia(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * "23 ago 2026, 11:04 p. m." — un timestamp leído en hora de Costa Rica.
 *
 * La hora importa en una auditoría (el cobro automático corre a las 11
 * de la noche), y la zona se fija a mano para que el servidor —que en
 * Vercel corre en UTC— y el navegador pinten exactamente lo mismo.
 */
export function fmtMomentoCR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const tomar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const anio = tomar("year");
  const mes = Number(tomar("month"));
  const dia = Number(tomar("day"));
  if (!anio || !mes || !dia) return "—";
  return `${dia} ${MESES_CORTOS[mes - 1]} ${anio}, ${tomar("hour")}:${tomar("minute")}`;
}

// ------------------------------------------------------------
// La línea de tiempo de una reserva
// ------------------------------------------------------------

export type HitoAuditoria = {
  clave: string;
  titulo: string;
  cuando: string;
  monto: string | null;
  detalle: string;
  /** `hecho` = ya ocurrió; `espera` = falta; `alerta` = algo anda mal. */
  estado: "hecho" | "espera" | "alerta";
};

/**
 * El recorrido del dinero de una reserva, hito por hito.
 *
 * Solo se agrega un hito cuando la base tiene con qué sostenerlo. Una
 * reserva sin adelanto pactado no muestra el paso del adelanto; un
 * depósito validado sin fecha dice "sin fecha registrada" en vez de
 * inventar una.
 */
export function lineaDeTiempo(f: FilaAuditoria): HitoAuditoria[] {
  const r = f.reserva;
  const hitos: HitoAuditoria[] = [];

  hitos.push({
    clave: "creada",
    titulo: "Se creó la reserva",
    cuando: fmtMomentoCR(r.created_at),
    monto: r.monto_total !== null ? colones(Number(r.monto_total)) : null,
    detalle:
      r.monto_total !== null
        ? "Monto cotizado al reservar."
        : "La reserva se creó sin monto cotizado.",
    estado: "hecho",
  });

  if (r.monto_cobrado_final !== null && r.monto_cobrado_final !== undefined) {
    hitos.push({
      clave: "monto-final",
      titulo: "Se ajustó el monto del evento",
      cuando: "sin fecha registrada",
      monto: colones(Number(r.monto_cobrado_final)),
      detalle:
        "Lo que de verdad se cobró el día del evento. Manda sobre la cotización en todos los cálculos.",
      estado: "hecho",
    });
  }

  if (f.adelantoPactado > 0) {
    hitos.push({
      clave: "adelanto-pactado",
      titulo: "Adelanto pactado",
      cuando: fmtMomentoCR(r.created_at),
      monto: colones(f.adelantoPactado),
      detalle:
        (r.metodo_pago === "sinpe"
          ? "Por SINPE Móvil. "
          : r.metodo_pago === "transferencia"
            ? "Por transferencia. "
            : "") +
        (r.tiene_comprobante
          ? "El cliente subió comprobante."
          : "Sin comprobante subido."),
      estado: "hecho",
    });

    if (r.deposito_validado) {
      hitos.push({
        clave: "adelanto-validado",
        titulo: "Se comprobó el depósito",
        cuando: r.deposito_pagado_en
          ? fmtMomentoCR(r.deposito_pagado_en)
          : "sin fecha registrada",
        monto: colones(f.adelantoPactado),
        detalle: r.deposito_pagado_en
          ? "Alguien revisó el comprobante y lo dio por recibido."
          : "Marcado como validado, pero la base no guardó cuándo.",
        estado: r.deposito_pagado_en ? "hecho" : "alerta",
      });
    } else {
      hitos.push({
        clave: "adelanto-sin-validar",
        titulo: "El depósito sigue sin comprobarse",
        cuando:
          f.diasEsperandoDeposito !== null
            ? `${f.diasEsperandoDeposito} día${f.diasEsperandoDeposito === 1 ? "" : "s"} esperando`
            : "—",
        monto: colones(f.adelantoPactado),
        detalle:
          "Mientras nadie lo marque, esta plata no cuenta como ingreso en ningún lado.",
        estado: f.diasEsperandoDeposito !== null ? "espera" : "hecho",
      });
    }

    if (r.adelanto_devuelto) {
      hitos.push({
        clave: "adelanto-devuelto",
        titulo: "El adelanto se devolvió",
        cuando: "sin fecha registrada",
        monto: colones(f.adelantoPactado),
        detalle:
          "El negocio devolvió el adelanto, así que deja de contar como plata suya. La base guarda el sí/no, no la fecha.",
        estado: "hecho",
      });
    } else if (f.adelantoEnCaja > 0 && !esReservaViva(r)) {
      hitos.push({
        clave: "adelanto-retenido",
        titulo: "Adelanto retenido tras la cancelación",
        cuando: "—",
        monto: colones(f.adelantoEnCaja),
        detalle:
          "La reserva ya no está viva pero el adelanto no se devolvió: por política sigue contando como ingreso del negocio.",
        estado: "hecho",
      });
    }
  }

  if (r.evento_pagado) {
    hitos.push({
      clave: "saldo-cobrado",
      titulo: "Se cobró el saldo del evento",
      cuando: r.saldo_pagado_en ? fmtMomentoCR(r.saldo_pagado_en) : "sin fecha registrada",
      monto: colones(f.saldoEnCaja),
      detalle:
        "La base no distingue si lo acreditó el cobro automático de las 11 p. m. o una persona a mano.",
      estado: "hecho",
    });
  } else if (f.saldoPorCobrar > 0) {
    hitos.push({
      clave: "saldo-pendiente",
      titulo: f.yaPaso ? "El saldo quedó sin cobrar" : "Saldo a cobrar el día del evento",
      cuando: fmtDia(r.fecha),
      monto: colones(f.saldoPorCobrar),
      detalle: f.yaPaso
        ? "El evento ya pasó y el saldo sigue abierto."
        : "Se cobra el día del evento.",
      estado: f.yaPaso ? "alerta" : "espera",
    });
  }

  for (const c of f.cobros) {
    hitos.push({
      clave: `cobro-${c.id}`,
      titulo:
        c.concepto === "cancelacion"
          ? "Bookea devengó el 10 % del depósito retenido"
          : "Bookea devengó su comisión",
      cuando: fmtMomentoCR(c.devengado_en),
      monto: colones(Number(c.monto ?? 0)),
      detalle:
        c.estado === "anulado"
          ? `Anulado. ${c.notas ?? ""}`.trim()
          : `Monto congelado el día que se devengó. Semana de corte: ${c.semana}.`,
      estado: c.estado === "anulado" ? "alerta" : "hecho",
    });

    if (c.estado === "pagado") {
      hitos.push({
        clave: `cobro-pagado-${c.id}`,
        titulo: "El negocio le pagó esa comisión a Bookea",
        cuando: fmtMomentoCR(c.pagado_en),
        monto: colones(Number(c.monto ?? 0)),
        detalle:
          "Marcado a mano desde Finanzas. La base guarda la fecha, no quién lo marcó.",
        estado: "hecho",
      });
    }
  }

  if (f.cobros.length === 0) {
    hitos.push({
      clave: "sin-cobro",
      titulo: "Todavía no dejó comisión",
      cuando: "—",
      monto: null,
      detalle: f.tarifaHoy
        ? tarifaDejaCobroPorReserva(f.tarifaHoy.modelo)
          ? "No hay ninguna fila en el libro de cobros para esta reserva."
          : "El negocio tiene tarifa que no cobra por reserva, así que es lo esperado."
        : "No hay ninguna fila en el libro de cobros para esta reserva.",
      estado: f.alertas.includes("sin_cobro_plataforma") ? "alerta" : "espera",
    });
  }

  return hitos;
}

/**
 * Personas con las que se congeló el cobro vs. las que dice la reserva
 * HOY. No es una alerta —cambiar la cantidad de invitados después de
 * confirmar es normal— pero es justo el dato que explica por qué una
 * comisión no se parece al evento, así que la fila lo muestra.
 */
export function personasCongeladasVsHoy(
  f: FilaAuditoria,
): { congeladas: number; hoy: number } | null {
  const cobroReserva = f.cobros.find(
    (c) => c.concepto === "reserva" && c.estado !== "anulado",
  );
  if (!cobroReserva) return null;
  if (cobroReserva.modelo !== "comision_por_persona") return null;
  const hoy = personasDeReserva({
    id: f.reserva.id,
    fecha: f.reserva.fecha,
    invitados: f.reserva.invitados,
    rancho_id: f.reserva.rancho_id,
  });
  const congeladas = Number(cobroReserva.personas);
  if (congeladas === hoy) return null;
  return { congeladas, hoy };
}
