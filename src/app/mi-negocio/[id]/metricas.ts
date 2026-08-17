import {
  adelantoCobrado,
  saldoCobrado,
  saldoPendiente,
  aFecha,
  mismoMes,
  type ReservaFinanzas,
} from "@/lib/finanzas";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";
import { formatearHora, mostrarHorarioReserva } from "@/app/mi-negocio/types";

/**
 * Los estados que son "alguien que viene hoy". Cancelada y rechazada ya
 * no son el día de nadie; `bloqueada` es un compromiso traído del
 * calendario del dueño (0072), no un cliente; `temporal` es un carrito a
 * medio pagar. Es exactamente el mismo conjunto que usa
 * `citas/metricas-dia.ts`, para que las dos pantallas no cuenten
 * distinto el mismo día.
 */
const ESTADOS_DEL_DIA = new Set(["pendiente", "confirmada", "cumplida", "no_asistio"]);

export type Metricas = {
  /**
   * Lo que hay HOY: el número que se mira al abrir el panel en la
   * mañana. Sale de la misma lista de reservas que todo lo demás — no
   * hay una consulta extra ni un dato de ejemplo.
   */
  reservasHoy: number;
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
  hoyISO,
}: {
  reservas: ReservaFinanzas[];
  esLugar: boolean;
  hoy?: Date;
  /**
   * El día de hoy EN LA ZONA DEL NEGOCIO ("YYYY-MM-DD"). Se pide aparte
   * y no se deriva de `hoy` porque `hoy` es la hora del servidor: en
   * Vercel eso es UTC, y entre las 6 p.m. y la medianoche de Costa Rica
   * el "hoy" derivado ya es mañana. La página pasa `hoyISOCR()`, que es
   * el mismo día que usa el resto del panel.
   */
  hoyISO?: string;
}): Metricas {
  const hoyLimpio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const mesAnteriorRef = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const diaDeHoy = hoyISO ?? fechaISO(hoyLimpio);

  const confirmadas = reservas.filter((r) => r.estado === "confirmada");

  const reservasHoy = reservas.filter(
    (r) => r.fecha === diaDeHoy && ESTADOS_DEL_DIA.has(r.estado),
  ).length;

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
    reservasHoy,
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

/** "YYYY-MM-DD" de una fecha local, sin pasar por UTC (que la corre). */
function fechaISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * La reserva tal como llega del `select("*")` de la tabla: además de lo
 * que declara `Reserva`, trae las columnas de plata y de descuento que
 * el tipo del admin no lista. Van opcionales para tolerar una base sin
 * las migraciones nuevas corridas.
 */
export type ReservaAuditoria = Reserva & {
  monto_cobrado_final?: number | null;
  deposito_pagado_en?: string | null;
  saldo_pagado_en?: string | null;
  adelanto_devuelto?: boolean;
  descuento_monto?: number | null;
  codigo_descuento?: string | null;
};

export type ActividadItem = {
  id: string;
  clienteId: string | null;
  nombre: string | null;
  monto: number | null;
  // "bloqueada" queda afuera a propósito: el filtro de abajo nunca deja
  // pasar una, así el componente que lo pinta no tiene que contemplarla.
  estado: Exclude<Reserva["estado"], "bloqueada">;
  creadoEn: string;
  /** Fecha del evento (distinta de cuándo se hizo la reserva). */
  fechaEvento: string;
  /** Adelanto ya recibido — 0 si el dueño todavía no lo dio por válido. */
  adelanto: number;
  /** Lo que falta cobrar el día del evento. */
  pendiente: number;
  /** La nota que dejó el cliente (o el dueño al cargarla a mano). */
  nota: string | null;

  // --- El detalle de auditoría: quién, cómo y cuándo entró la plata ---
  /** El correo con el que se hizo la reserva — la traza de quién fue. */
  correo: string | null;
  whatsapp: string | null;
  /** Campo viejo, de antes de separar correo y WhatsApp. */
  contacto: string | null;
  cedula: string | null;
  /** El bloque de alquiler o la hora de inicio, ya legible. */
  horario: string | null;
  tipoEvento: string | null;
  invitados: number | null;
  /** Lo que el cliente dijo que iba a depositar (validado o no). */
  depositoMonto: number | null;
  depositoValidado: boolean;
  /** Cuándo se dio por recibido el adelanto. */
  depositoPagadoEn: string | null;
  /** Cuándo se cobró el saldo del día del evento. */
  saldoPagadoEn: string | null;
  eventoPagado: boolean;
  /** El adelanto se devolvió al cancelar y ya no cuenta como ingreso. */
  adelantoDevuelto: boolean;
  metodoPago: Reserva["metodo_pago"];
  origen: Reserva["origen"];
  codigoDescuento: string | null;
  descuentoMonto: number | null;
  /** El comprobante subido por el cliente, para poder abrirlo. */
  comprobanteUrl: string | null;
};

/**
 * Últimas reservas/solicitudes creadas, para la AUDITORÍA de Inicio:
 * cuándo se hizo cada una, con qué correo, cuánto se depositó y cuánto
 * queda pendiente. No es una query nueva: `reservas` ya viene de
 * page.tsx con select("*") — esto solo reordena lo que ya está en
 * memoria por fecha de CREACIÓN (no de evento) y calcula la plata con
 * las mismas reglas que Finanzas (adelantoCobrado/saldoPendiente), para
 * que los números no se contradigan entre pantallas.
 */
export function actividadReciente(
  reservas: ReservaAuditoria[],
  limite = 40,
): ActividadItem[] {
  return [...reservas]
    // Un bloqueo no es actividad de un cliente. El type guard deja el
    // "bloqueada" afuera también para TypeScript, no solo en runtime.
    .filter(
      (r): r is ReservaAuditoria & { estado: ActividadItem["estado"] } =>
        r.estado !== "bloqueada",
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limite)
    .map((r) => {
      const paraPlata = r as unknown as ReservaFinanzas;
      return {
        id: r.id,
        clienteId: r.cliente_id,
        nombre: r.nombre,
        monto: r.monto_cobrado_final ?? r.monto_total,
        estado: r.estado,
        creadoEn: r.created_at,
        fechaEvento: r.fecha,
        adelanto: adelantoCobrado(paraPlata),
        pendiente: saldoPendiente(paraPlata),
        nota: r.notas?.trim() ? r.notas.trim() : null,
        correo: r.correo,
        whatsapp: r.whatsapp,
        contacto: r.contacto,
        cedula: r.cedula,
        horario: horarioLegible(r),
        tipoEvento: r.tipo_evento,
        invitados: r.invitados,
        depositoMonto: r.deposito_monto,
        depositoValidado: r.deposito_validado,
        depositoPagadoEn: r.deposito_pagado_en ?? null,
        saldoPagadoEn: r.saldo_pagado_en ?? null,
        eventoPagado: r.evento_pagado,
        adelantoDevuelto: r.adelanto_devuelto === true,
        metodoPago: r.metodo_pago,
        origen: r.origen,
        codigoDescuento: r.codigo_descuento ?? null,
        descuentoMonto: r.descuento_monto ?? null,
        comprobanteUrl: r.deposito_comprobante_url,
      };
    });
}

/** El bloque de alquiler (Lugares) o la hora de inicio (servicios/citas). */
function horarioLegible(r: ReservaAuditoria): string | null {
  if (r.horario_bloque) return mostrarHorarioReserva(r.horario_bloque);
  if (r.hora_inicio) {
    const hora = formatearHora(r.hora_inicio.slice(0, 5));
    return r.duracion_horas ? `${hora} · ${r.duracion_horas} h` : hora;
  }
  return null;
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
