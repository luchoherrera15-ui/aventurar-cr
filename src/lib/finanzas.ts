/**
 * Cálculo económico del negocio.
 *
 * Vive aparte de la pantalla a propósito: son las reglas de plata del
 * negocio y tienen que poder probarse sin montar React.
 *
 * La regla que ordena todo: el negocio cobra en DOS tiempos.
 *   1. Un adelanto al reservar (el depósito).
 *   2. El saldo el día del evento.
 * Por eso "lo que entró" y "lo que se facturó" son números distintos y
 * nunca se mezclan: un evento de ₡500.000 con ₡25.000 de adelanto ya
 * entró ₡25.000 y todavía debe ₡475.000.
 */

export type ReservaFinanzas = {
  id: string;
  fecha: string;
  nombre: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  /** Los tres últimos son de la vertical Citas (0061), pero llegan
   *  igual por el select("*") — el tipo los admite para no mentir. */
  estado:
    | "pendiente"
    | "confirmada"
    | "rechazada"
    | "bloqueada"
    | "temporal"
    | "cancelada"
    | "cumplida"
    | "no_asistio";
  monto_total: number | null;
  monto_cobrado_final: number | null;
  deposito_monto: number | null;
  deposito_validado: boolean;
  deposito_pagado_en: string | null;
  evento_pagado: boolean;
  saldo_pagado_en: string | null;
  /** true = el negocio devolvió el adelanto al cancelar (0097) y esa
   *  plata deja de contar como ingreso. Opcional: tolera una base sin
   *  la migración corrida (undefined = no devuelto). */
  adelanto_devuelto?: boolean;
};

export type Gasto = {
  id: string;
  fecha: string;
  concepto: string;
  categoria: CategoriaGasto;
  monto: number;
  nota: string | null;
};

export const CATEGORIAS_GASTO = [
  { id: "personal", label: "Personal" },
  { id: "insumos", label: "Insumos" },
  { id: "mantenimiento", label: "Mantenimiento" },
  { id: "servicios", label: "Servicios (agua, luz, internet)" },
  { id: "publicidad", label: "Publicidad" },
  { id: "otro", label: "Otro" },
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]["id"];

export const GASTO_LABEL: Record<CategoriaGasto, string> = Object.fromEntries(
  CATEGORIAS_GASTO.map((c) => [c.id, c.label]),
) as Record<CategoriaGasto, string>;

/**
 * ¿Esta reserva sigue viva (puede deber plata a futuro)? Gobierna todo
 * lo PROSPECTIVO: por cobrar, vencidos, depósitos por validar. Una
 * rechazada/cancelada no debe nada, y una bloqueada es un día cerrado
 * a mano, no un cliente.
 */
export function esReservaViva(r: ReservaFinanzas) {
  return r.estado === "confirmada" || r.estado === "pendiente";
}

/** Nombre viejo de esReservaViva — lo retrospectivo ya no pasa por acá. */
export const cuentaParaPlata = esReservaViva;

/**
 * ¿Los cobros de esta reserva cuentan como ingreso REAL? Gobierna todo
 * lo RETROSPECTIVO (lo que ya entró): se decide por los flags de pago,
 * no por el estado — cancelar una reserva no des-cobra su adelanto. La
 * política de los términos es no devolver: si el negocio igual lo
 * devuelve, lo marca (`adelanto_devuelto`) y ahí sí sale de los
 * números. Bloqueos y holds temporales nunca son plata.
 */
export function esIngresoReal(r: ReservaFinanzas) {
  return r.estado !== "bloqueada" && r.estado !== "temporal";
}

/** Lo que vale el evento: manda lo cobrado de verdad sobre la cotización. */
export function totalEvento(r: ReservaFinanzas) {
  return Number(r.monto_cobrado_final ?? r.monto_total ?? 0);
}

/**
 * El adelanto cuenta como plata cuando el dueño lo dio por recibido —
 * y deja de contar solo si lo devolvió (cancelaciones, 0097).
 */
export function adelantoCobrado(r: ReservaFinanzas) {
  if (!r.deposito_validado || r.adelanto_devuelto) return 0;
  return Number(r.deposito_monto ?? 0);
}

/**
 * Lo que falta cobrar el día del evento.
 *
 * Se descuenta el adelanto aunque todavía no esté validado: el cliente
 * ya lo transfirió, y contarlo dos veces inflaría la deuda.
 */
export function saldoPendiente(r: ReservaFinanzas) {
  if (r.evento_pagado) return 0;
  const total = totalEvento(r);
  const adelanto = Number(r.deposito_monto ?? 0);
  return Math.max(0, total - adelanto);
}

/** Lo que se cobró del saldo, una vez marcado como pagado. */
export function saldoCobrado(r: ReservaFinanzas) {
  if (!r.evento_pagado) return 0;
  return Math.max(0, totalEvento(r) - Number(r.deposito_monto ?? 0));
}

// ------------------------------------------------------------
// Fechas — todo en hora local, que es como el dueño piensa su semana.
// ------------------------------------------------------------

export function aFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function claveFecha(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** La semana arranca el lunes: es como se factura y se paga al personal. */
export function inicioDeSemana(d: Date) {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = copia.getDay();
  const retroceso = dow === 0 ? 6 : dow - 1;
  copia.setDate(copia.getDate() - retroceso);
  return copia;
}

export function sumarDias(d: Date, dias: number) {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function mismoMes(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function rangoSemana(inicio: Date) {
  const fin = sumarDias(inicio, 6);
  const mismoMesAmbos = inicio.getMonth() === fin.getMonth();
  const mesInicio = inicio.toLocaleDateString("es-CR", { month: "short" });
  const mesFin = fin.toLocaleDateString("es-CR", { month: "short" });
  return mismoMesAmbos
    ? `${inicio.getDate()} – ${fin.getDate()} ${mesFin}`
    : `${inicio.getDate()} ${mesInicio} – ${fin.getDate()} ${mesFin}`;
}

// ------------------------------------------------------------
// Resumen
// ------------------------------------------------------------

export type SemanaFinanzas = {
  clave: string;
  inicio: Date;
  fin: Date;
  rango: string;
  esActual: boolean;
  esFutura: boolean;
  eventos: number;
  adelantosCobrados: number;
  saldosCobrados: number;
  /** Lo que efectivamente entró a caja en esa semana. */
  entro: number;
  /** Saldos de eventos de esa semana que todavía no se cobraron. */
  porCobrar: number;
  gastos: number;
};

export type ResumenFinanzas = {
  semanas: SemanaFinanzas[];
  maximoSemanal: number;
  entroEsteMes: number;
  /** Desglose del mes: cuánto de lo que entró fue adelantos y cuánto saldos. */
  entroEsteMesAdelantos: number;
  entroEsteMesSaldos: number;
  gastosEsteMes: number;
  netoEsteMes: number;
  /** Histórico completo de lo que entró de verdad, desglosado. */
  cobradoAdelantos: number;
  cobradoSaldos: number;
  cobradoTotal: number;
  porCobrarProximos30: number;
  /** TODO el saldo pendiente de reservas vivas (vencido + futuro), sin
   *  recorte de 30 días. */
  porCobrarTotal: number;
  /** Cobrado real + por cobrar: la facturación total comprometida. */
  totalComprometido: number;
  vencido: number;
  /** Eventos ya pasados con saldo sin cobrar: la lista de "te deben". */
  cobrosVencidos: ReservaFinanzas[];
  /** Eventos por venir, con el saldo que hay que cobrar ese día. */
  cobrosProximos: ReservaFinanzas[];
  /** Facturación comprometida a futuro, cobrada o no. */
  agendadoProximos30: number;
  eventosProximos30: number;
  depositosSinValidar: ReservaFinanzas[];
  /** Canceladas/rechazadas cuyo adelanto validado quedó retenido (la
   *  política de no-devolución): explican por qué "cobrado" puede
   *  incluir reservas que ya no están en el calendario. */
  adelantosRetenidos: ReservaFinanzas[];
};

export function resumenFinanciero({
  reservas,
  gastos,
  hoy = new Date(),
  semanasAtras = 7,
  semanasAdelante = 6,
}: {
  reservas: ReservaFinanzas[];
  gastos: Gasto[];
  hoy?: Date;
  semanasAtras?: number;
  semanasAdelante?: number;
}): ResumenFinanzas {
  const hoyLimpio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  // Dos ejes, dos filtros: lo por cobrar mira solo reservas vivas; lo
  // ya cobrado mira los flags de pago aunque la reserva se haya
  // cancelado después — cancelar no des-cobra un adelanto retenido.
  const activas = reservas.filter(esReservaViva);
  const conPlata = reservas.filter(esIngresoReal);

  const semanaActual = inicioDeSemana(hoyLimpio);
  const semanas: SemanaFinanzas[] = [];
  const indicePorClave = new Map<string, number>();

  for (let i = -semanasAtras; i <= semanasAdelante; i++) {
    const inicio = sumarDias(semanaActual, i * 7);
    const fin = sumarDias(inicio, 6);
    const clave = claveFecha(inicio);
    indicePorClave.set(clave, semanas.length);
    semanas.push({
      clave,
      inicio,
      fin,
      rango: rangoSemana(inicio),
      esActual: i === 0,
      esFutura: i > 0,
      eventos: 0,
      adelantosCobrados: 0,
      saldosCobrados: 0,
      entro: 0,
      porCobrar: 0,
      gastos: 0,
    });
  }

  const ubicar = (d: Date) => indicePorClave.get(claveFecha(inicioDeSemana(d)));

  // Lo que ENTRÓ se ubica por la fecha en que se cobró; lo que está por
  // cobrar, por la fecha del evento. Son ejes distintos a propósito —
  // y recorren listas distintas: la deuda solo existe en reservas
  // vivas, pero un cobro ya hecho no se borra al cancelar.
  for (const r of activas) {
    const fechaEvento = aFecha(r.fecha);
    const iEvento = ubicar(fechaEvento);
    if (iEvento !== undefined) {
      semanas[iEvento].eventos += 1;
      semanas[iEvento].porCobrar += saldoPendiente(r);
    }
  }

  for (const r of conPlata) {
    const fechaEvento = aFecha(r.fecha);
    const adelanto = adelantoCobrado(r);
    if (adelanto > 0) {
      const cuando = r.deposito_pagado_en
        ? new Date(r.deposito_pagado_en)
        : fechaEvento;
      const i = ubicar(cuando);
      if (i !== undefined) {
        semanas[i].adelantosCobrados += adelanto;
        semanas[i].entro += adelanto;
      }
    }

    const saldo = saldoCobrado(r);
    if (saldo > 0) {
      const cuando = r.saldo_pagado_en ? new Date(r.saldo_pagado_en) : fechaEvento;
      const i = ubicar(cuando);
      if (i !== undefined) {
        semanas[i].saldosCobrados += saldo;
        semanas[i].entro += saldo;
      }
    }
  }

  for (const g of gastos) {
    const i = ubicar(aFecha(g.fecha));
    if (i !== undefined) semanas[i].gastos += Number(g.monto);
  }

  const maximoSemanal = semanas.reduce(
    (max, s) => Math.max(max, s.entro, s.porCobrar),
    0,
  );

  // --- Mes en curso + histórico de lo cobrado ---
  let entroEsteMesAdelantos = 0;
  let entroEsteMesSaldos = 0;
  let cobradoAdelantos = 0;
  let cobradoSaldos = 0;
  for (const r of conPlata) {
    const adelanto = adelantoCobrado(r);
    if (adelanto > 0) {
      cobradoAdelantos += adelanto;
      const cuando = r.deposito_pagado_en
        ? new Date(r.deposito_pagado_en)
        : aFecha(r.fecha);
      if (mismoMes(cuando, hoyLimpio)) entroEsteMesAdelantos += adelanto;
    }
    const saldo = saldoCobrado(r);
    if (saldo > 0) {
      cobradoSaldos += saldo;
      const cuando = r.saldo_pagado_en
        ? new Date(r.saldo_pagado_en)
        : aFecha(r.fecha);
      if (mismoMes(cuando, hoyLimpio)) entroEsteMesSaldos += saldo;
    }
  }
  const entroEsteMes = entroEsteMesAdelantos + entroEsteMesSaldos;

  const gastosEsteMes = gastos
    .filter((g) => mismoMes(aFecha(g.fecha), hoyLimpio))
    .reduce((acc, g) => acc + Number(g.monto), 0);

  // --- Cobros por venir y vencidos ---
  const limite30 = sumarDias(hoyLimpio, 30);
  const cobrosVencidos: ReservaFinanzas[] = [];
  const cobrosProximos: ReservaFinanzas[] = [];
  let porCobrarProximos30 = 0;
  let porCobrarTotal = 0;
  let agendadoProximos30 = 0;
  let eventosProximos30 = 0;
  let vencido = 0;

  for (const r of activas) {
    const fechaEvento = aFecha(r.fecha);
    const saldo = saldoPendiente(r);
    const yaPaso = fechaEvento < hoyLimpio;

    porCobrarTotal += saldo;
    if (saldo > 0 && yaPaso) {
      vencido += saldo;
      cobrosVencidos.push(r);
    } else if (saldo > 0 && !yaPaso) {
      cobrosProximos.push(r);
      if (fechaEvento <= limite30) porCobrarProximos30 += saldo;
    }

    if (!yaPaso && fechaEvento <= limite30) {
      agendadoProximos30 += totalEvento(r);
      eventosProximos30 += 1;
    }
  }

  cobrosVencidos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  cobrosProximos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Un adelanto sin validar es plata que el cliente dice haber mandado y
  // el dueño todavía no confirmó. Es lo primero que hay que resolver.
  const depositosSinValidar = activas
    .filter((r) => !r.deposito_validado && Number(r.deposito_monto ?? 0) > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Adelantos que quedaron retenidos al cancelar/rechazar (política de
  // no-devolución): siguen contando en "cobrado" y esta lista es la
  // que lo hace auditable — y donde se marca una devolución si pasa.
  const adelantosRetenidos = reservas
    .filter(
      (r) =>
        !esReservaViva(r) &&
        esIngresoReal(r) &&
        r.deposito_validado &&
        !r.adelanto_devuelto &&
        Number(r.deposito_monto ?? 0) > 0,
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const cobradoTotal = cobradoAdelantos + cobradoSaldos;

  return {
    semanas,
    maximoSemanal,
    entroEsteMes,
    entroEsteMesAdelantos,
    entroEsteMesSaldos,
    gastosEsteMes,
    netoEsteMes: entroEsteMes - gastosEsteMes,
    cobradoAdelantos,
    cobradoSaldos,
    cobradoTotal,
    porCobrarProximos30,
    porCobrarTotal,
    totalComprometido: cobradoTotal + porCobrarTotal,
    vencido,
    cobrosVencidos,
    cobrosProximos,
    agendadoProximos30,
    eventosProximos30,
    depositosSinValidar,
    adelantosRetenidos,
  };
}

export function fmtColones(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

/** Versión corta para los ejes y las barras: ₡1,2 M / ₡450 k. */
export function fmtColonesCorto(n: number) {
  if (n >= 1_000_000) return "₡" + (n / 1_000_000).toFixed(1).replace(".", ",") + " M";
  if (n >= 1_000) return "₡" + Math.round(n / 1_000) + " k";
  return "₡" + Math.round(n);
}
