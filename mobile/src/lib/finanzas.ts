/**
 * Cálculo económico del negocio — espejo EXACTO de src/lib/finanzas.ts
 * en /web. Son dos proyectos npm independientes, en paridad a mano: si
 * cambiás una regla de plata allá, copiá el archivo otra vez.
 *
 * Se copia entero en vez de adaptarlo porque no depende de nada (ni
 * React, ni Supabase, ni Next): es aritmética pura. Y porque el
 * teléfono y el sitio TIENEN que dar el mismo número — un dueño que ve
 * ₡480.000 en la compu y ₡475.000 en el celular deja de creerle a los
 * dos.
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
  estado: "pendiente" | "confirmada" | "rechazada" | "bloqueada";
  monto_total: number | null;
  monto_cobrado_final: number | null;
  deposito_monto: number | null;
  deposito_validado: boolean;
  deposito_pagado_en: string | null;
  evento_pagado: boolean;
  saldo_pagado_en: string | null;
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
 * Una reserva rechazada o bloqueada no es plata: la primera no va a
 * pasar y la segunda es un día que el dueño cerró a mano.
 */
export function cuentaParaPlata(r: ReservaFinanzas) {
  return r.estado === "confirmada" || r.estado === "pendiente";
}

/** Lo que vale el evento: manda lo cobrado de verdad sobre la cotización. */
export function totalEvento(r: ReservaFinanzas) {
  return Number(r.monto_cobrado_final ?? r.monto_total ?? 0);
}

/** El adelanto solo cuenta como plata cuando el dueño lo dio por recibido. */
export function adelantoCobrado(r: ReservaFinanzas) {
  return r.deposito_validado ? Number(r.deposito_monto ?? 0) : 0;
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
  gastosEsteMes: number;
  netoEsteMes: number;
  porCobrarProximos30: number;
  vencido: number;
  /** Eventos ya pasados con saldo sin cobrar: la lista de "te deben". */
  cobrosVencidos: ReservaFinanzas[];
  /** Eventos por venir, con el saldo que hay que cobrar ese día. */
  cobrosProximos: ReservaFinanzas[];
  /** Facturación comprometida a futuro, cobrada o no. */
  agendadoProximos30: number;
  eventosProximos30: number;
  depositosSinValidar: ReservaFinanzas[];
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
  const activas = reservas.filter(cuentaParaPlata);

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
  // cobrar, por la fecha del evento. Son ejes distintos a propósito.
  for (const r of activas) {
    const fechaEvento = aFecha(r.fecha);
    const iEvento = ubicar(fechaEvento);
    if (iEvento !== undefined) {
      semanas[iEvento].eventos += 1;
      semanas[iEvento].porCobrar += saldoPendiente(r);
    }

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

  // --- Mes en curso ---
  let entroEsteMes = 0;
  for (const r of activas) {
    const adelanto = adelantoCobrado(r);
    if (adelanto > 0) {
      const cuando = r.deposito_pagado_en
        ? new Date(r.deposito_pagado_en)
        : aFecha(r.fecha);
      if (mismoMes(cuando, hoyLimpio)) entroEsteMes += adelanto;
    }
    const saldo = saldoCobrado(r);
    if (saldo > 0) {
      const cuando = r.saldo_pagado_en
        ? new Date(r.saldo_pagado_en)
        : aFecha(r.fecha);
      if (mismoMes(cuando, hoyLimpio)) entroEsteMes += saldo;
    }
  }

  const gastosEsteMes = gastos
    .filter((g) => mismoMes(aFecha(g.fecha), hoyLimpio))
    .reduce((acc, g) => acc + Number(g.monto), 0);

  // --- Cobros por venir y vencidos ---
  const limite30 = sumarDias(hoyLimpio, 30);
  const cobrosVencidos: ReservaFinanzas[] = [];
  const cobrosProximos: ReservaFinanzas[] = [];
  let porCobrarProximos30 = 0;
  let agendadoProximos30 = 0;
  let eventosProximos30 = 0;
  let vencido = 0;

  for (const r of activas) {
    const fechaEvento = aFecha(r.fecha);
    const saldo = saldoPendiente(r);
    const yaPaso = fechaEvento < hoyLimpio;

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

  return {
    semanas,
    maximoSemanal,
    entroEsteMes,
    gastosEsteMes,
    netoEsteMes: entroEsteMes - gastosEsteMes,
    porCobrarProximos30,
    vencido,
    cobrosVencidos,
    cobrosProximos,
    agendadoProximos30,
    eventosProximos30,
    depositosSinValidar,
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
