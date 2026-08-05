import {
  adelantoCobrado,
  saldoCobrado,
  saldoPendiente,
  aFecha,
  mismoMes,
  type ReservaFinanzas,
} from "@/lib/finanzas";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";

export type Metricas = {
  reservasEsteMes: number;
  reservasMesAnterior: number;
  ingresosEsteMes: number;
  ingresosMesAnterior: number;
  proximaReserva: { fecha: string; nombre: string | null } | null;
  /** 0-100, o null si la categoría no reserva por fecha (no es "lugares"). */
  ocupacionProximos30: number | null;
  porCobrarProximos30: number;
  totalReservasHistorico: number;
};

/**
 * Todo lo que arma el dashboard del panel del proveedor, en un solo
 * lugar y sin depender de React — así se puede probar con datos
 * de mentira sin montar la pantalla.
 */
export function calcularMetricas({
  reservas,
  esLugar,
  hoy = new Date(),
}: {
  reservas: ReservaFinanzas[];
  esLugar: boolean;
  hoy?: Date;
}): Metricas {
  const hoyLimpio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const mesAnteriorRef = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);

  const confirmadas = reservas.filter((r) => r.estado === "confirmada");

  const reservasEsteMes = confirmadas.filter((r) => mismoMes(aFecha(r.fecha), hoy)).length;
  const reservasMesAnterior = confirmadas.filter((r) =>
    mismoMes(aFecha(r.fecha), mesAnteriorRef),
  ).length;

  // Lo que "entró" se cuenta por la fecha en que se cobró (el depósito o
  // el saldo), no por la fecha del evento — son ejes distintos, igual
  // que en el resumen financiero semanal.
  let ingresosEsteMes = 0;
  let ingresosMesAnterior = 0;
  for (const r of reservas) {
    const adelanto = adelantoCobrado(r);
    if (adelanto > 0) {
      const cuando = r.deposito_pagado_en ? new Date(r.deposito_pagado_en) : aFecha(r.fecha);
      if (mismoMes(cuando, hoy)) ingresosEsteMes += adelanto;
      else if (mismoMes(cuando, mesAnteriorRef)) ingresosMesAnterior += adelanto;
    }
    const saldo = saldoCobrado(r);
    if (saldo > 0) {
      const cuando = r.saldo_pagado_en ? new Date(r.saldo_pagado_en) : aFecha(r.fecha);
      if (mismoMes(cuando, hoy)) ingresosEsteMes += saldo;
      else if (mismoMes(cuando, mesAnteriorRef)) ingresosMesAnterior += saldo;
    }
  }

  const proxima = confirmadas
    .filter((r) => aFecha(r.fecha) >= hoyLimpio)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  const limite30 = new Date(hoyLimpio);
  limite30.setDate(limite30.getDate() + 30);

  const confirmadasProximos30 = confirmadas.filter((r) => {
    const f = aFecha(r.fecha);
    return f >= hoyLimpio && f <= limite30;
  });

  // Solo "lugares" reserva por fecha en línea — para el resto, un
  // porcentaje de "ocupación" no significaría nada real.
  const ocupacionProximos30 = esLugar
    ? Math.round(
        (new Set(confirmadasProximos30.map((r) => r.fecha)).size / 30) * 100,
      )
    : null;

  const porCobrarProximos30 = confirmadasProximos30.reduce(
    (acc, r) => acc + saldoPendiente(r),
    0,
  );

  return {
    reservasEsteMes,
    reservasMesAnterior,
    ingresosEsteMes,
    ingresosMesAnterior,
    proximaReserva: proxima ? { fecha: proxima.fecha, nombre: proxima.nombre } : null,
    ocupacionProximos30,
    porCobrarProximos30,
    totalReservasHistorico: confirmadas.length,
  };
}

export type ActividadItem = {
  id: string;
  nombre: string | null;
  monto: number | null;
  // "bloqueada" queda afuera a propósito: el filtro de abajo nunca deja
  // pasar una, así el componente que lo pinta no tiene que contemplarla.
  estado: Exclude<Reserva["estado"], "bloqueada">;
  creadoEn: string;
};

/**
 * Últimas reservas/solicitudes creadas, para el feed de "actividad
 * reciente" de Inicio. No es una query nueva: `reservas` ya viene de
 * page.tsx con select("*") — esto solo reordena lo que ya está en
 * memoria por fecha de CREACIÓN (no de evento).
 */
export function actividadReciente(reservas: Reserva[], limite = 6): ActividadItem[] {
  return [...reservas]
    // Un bloqueo no es actividad de un cliente. El type guard deja el
    // "bloqueada" afuera también para TypeScript, no solo en runtime.
    .filter(
      (r): r is Reserva & { estado: ActividadItem["estado"] } => r.estado !== "bloqueada",
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limite)
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      monto: r.monto_total,
      estado: r.estado,
      creadoEn: r.created_at,
    }));
}

/** "3× más que el mes pasado" / "+40% vs. el mes pasado" / etc. */
export function compararTexto(actual: number, anterior: number): string {
  if (anterior === 0 && actual === 0) return "Sin datos todavía";
  if (anterior === 0) return "Recién arrancando este mes";
  const factor = actual / anterior;
  if (factor >= 1.5) {
    const texto = factor.toFixed(1).replace(/\.0$/, "");
    return `${texto}× más que el mes pasado`;
  }
  const cambio = Math.round((factor - 1) * 100);
  if (cambio > 0) return `+${cambio}% vs. el mes pasado`;
  if (cambio < 0) return `${cambio}% vs. el mes pasado`;
  return "Igual que el mes pasado";
}
