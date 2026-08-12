/**
 * Membresías y bonos de sesiones (migración 0120). Lógica pura — sin
 * React ni Supabase — para poder usarla igual en el panel, en la
 * página pública y en la app.
 *
 * La regla de oro del módulo: el saldo NUNCA es un contador guardado.
 * Se deriva sumando `consumos_membresia`, donde una cantidad negativa
 * es una devolución. Así no existe un segundo número que pueda
 * desincronizarse el día que una cancelación no descuente.
 */

export type PeriodoPlan = "unico" | "mensual" | "trimestral" | "semestral" | "anual";

export type PlanMembresia = {
  id: string;
  nombre: string;
  precio: number;
  periodo: PeriodoPlan;
  /** null = ilimitado. */
  sesiones_incluidas: number | null;
  /** Días de vigencia desde la compra. null = lo decide el período. */
  vigencia_dias: number | null;
  activo: boolean;
};

export type EstadoMembresia = "activa" | "pausada" | "vencida" | "cancelada";

export type Membresia = {
  id: string;
  estado: EstadoMembresia;
  inicio: string; // YYYY-MM-DD
  /** null = no vence. */
  fin: string | null;
  /** null = ilimitada. Snapshot del plan al comprar. */
  sesiones_totales: number | null;
};

export type ConsumoMembresia = {
  membresia_id: string;
  /** Negativo = devolución. */
  cantidad: number;
};

/** Cuántos días dura cada período. 'unico' no aporta vencimiento. */
const DIAS_POR_PERIODO: Record<PeriodoPlan, number | null> = {
  unico: null,
  mensual: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365,
};

export const ETIQUETA_PERIODO: Record<PeriodoPlan, string> = {
  unico: "Pago único",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

/**
 * Suma días a una fecha "YYYY-MM-DD". Se hace en UTC a propósito: son
 * fechas de calendario, no instantes, y armarlas en la zona local del
 * servidor haría que un cambio de horario corriera la cuenta un día.
 */
export function sumarDias(fecha: string, dias: number): string {
  const base = Date.UTC(
    Number(fecha.slice(0, 4)),
    Number(fecha.slice(5, 7)) - 1,
    Number(fecha.slice(8, 10)),
  );
  return new Date(base + dias * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Cuándo vence una membresía que arranca hoy. `vigencia_dias` del plan
 * manda sobre el período; si no hay ninguno de los dos, no vence.
 *
 * Es una decisión del plan, no del cliente: un bono de 10 masajes con
 * vigencia_dias = 90 vence a los 90 días aunque su período sea 'unico'.
 */
export function finDeVigencia(plan: PlanMembresia, inicio: string): string | null {
  const dias = plan.vigencia_dias ?? DIAS_POR_PERIODO[plan.periodo];
  return dias === null ? null : sumarDias(inicio, dias);
}

export type Saldo = {
  /** null = ilimitada. */
  totales: number | null;
  /** Lo consumido neto: los movimientos negativos ya vienen restados. */
  usadas: number;
  /** null = ilimitada. Nunca baja de 0. */
  restantes: number | null;
  ilimitada: boolean;
};

/**
 * El saldo de una membresía. `consumos` puede traer movimientos de
 * varias membresías: se filtran por id acá para que quien llama pueda
 * cargar todo de una sola consulta.
 */
export function saldoMembresia(
  membresia: Membresia,
  consumos: ConsumoMembresia[],
): Saldo {
  const usadas = consumos
    .filter((c) => c.membresia_id === membresia.id)
    .reduce((suma, c) => suma + c.cantidad, 0);

  if (membresia.sesiones_totales === null) {
    return { totales: null, usadas, restantes: null, ilimitada: true };
  }

  return {
    totales: membresia.sesiones_totales,
    usadas,
    // Nunca negativo: si el negocio marcó de más, se muestra 0 y no un
    // número rojo que nadie sabe interpretar.
    restantes: Math.max(0, membresia.sesiones_totales - usadas),
    ilimitada: false,
  };
}

/**
 * El estado REAL a una fecha dada. `estado` en la base no se actualiza
 * solo cuando pasa el vencimiento —nadie corre un cron para eso— así
 * que la vigencia se deriva acá.
 *
 * 'cancelada' y 'pausada' mandan sobre la fecha: una pausada que ya
 * pasó su fin sigue siendo pausada, porque el negocio la va a
 * reactivar corriendo el vencimiento.
 */
export function estadoVigente(membresia: Membresia, hoy: string): EstadoMembresia {
  if (membresia.estado === "cancelada" || membresia.estado === "pausada") {
    return membresia.estado;
  }
  if (membresia.fin !== null && membresia.fin < hoy) return "vencida";
  if (membresia.inicio > hoy) return "activa"; // comprada por adelantado
  return membresia.estado;
}

export type Veredicto = { puede: true } | { puede: false; motivo: string };

/**
 * ¿Se le puede gastar una sesión a esta membresía hoy?
 *
 * Devuelve el motivo en español y listo para mostrar, igual que hacen
 * los mensajes de `crear_cita`: el panel no tiene que traducir códigos.
 */
export function puedeConsumir(
  membresia: Membresia,
  consumos: ConsumoMembresia[],
  hoy: string,
): Veredicto {
  const estado = estadoVigente(membresia, hoy);

  if (estado === "cancelada") return { puede: false, motivo: "Esta membresía está cancelada." };
  if (estado === "pausada") return { puede: false, motivo: "Esta membresía está pausada." };
  if (estado === "vencida") {
    return { puede: false, motivo: `Esta membresía venció el ${membresia.fin}.` };
  }
  if (membresia.inicio > hoy) {
    return { puede: false, motivo: `Esta membresía arranca el ${membresia.inicio}.` };
  }

  const saldo = saldoMembresia(membresia, consumos);
  if (!saldo.ilimitada && saldo.restantes === 0) {
    return { puede: false, motivo: "Ya no le quedan sesiones." };
  }

  return { puede: true };
}

/** "8 de 12 disponibles" · "Ilimitada" — la línea que ve el dueño. */
export function etiquetaSaldo(saldo: Saldo): string {
  if (saldo.ilimitada) return "Ilimitada";
  return `${saldo.restantes} de ${saldo.totales} disponibles`;
}
