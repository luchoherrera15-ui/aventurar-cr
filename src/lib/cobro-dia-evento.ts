import { aFecha, claveFecha, inicioDeSemana } from "@/lib/finanzas";
import { fechaISOEnZona, sumarDiasISO } from "@/lib/fechas";

/**
 * EL COBRO DE PLATAFORMA SE DEVENGA EL DÍA DEL EVENTO — las reglas.
 *
 * Antes la comisión que Bookea le cobra al negocio nacía al CONFIRMARSE
 * la reserva. Desde la migración 0171 nace el día en que el evento
 * ocurre, y su semana de corte es la semana del evento.
 *
 * QUIÉN MANDA DE VERDAD: la función `devengar_cobros_del_dia` de la
 * 0171. Ahí, en la base, es donde se decide a quién se le cobra y
 * cuánto, en UNA sola sentencia atómica e idempotente. Este módulo es
 * su ESPEJO en TypeScript — el mismo patrón que ya usa
 * scripts/backfill-cobros-plataforma.mjs con el trigger de la 0106.
 *
 * Para qué sirve el espejo, si la base ya lo hace:
 *   1. Es lo que se puede probar con vitest sin montar un Postgres
 *      (cobro-dia-evento.test.ts).
 *   2. Es el motor del modo SIMULACIÓN de /api/cobro-plataforma:
 *      "¿qué se devengaría si el barrido corriera ahora?", sin escribir
 *      nada. Con eso el dueño puede mirar antes de confiar.
 *   3. Arma el aviso: agrupa lo devengado por negocio para el correo.
 *
 * SI ALGÚN DÍA CAMBIA UNA REGLA, CAMBIA EN LOS DOS LADOS. Las reglas
 * están todas juntas acá arriba a propósito.
 *
 * Módulo neutral (sin "use client"): lo importan la ruta de cron (que
 * corre en el servidor) y los tests. Todo puro — no toca la base, no
 * lee variables de entorno, no manda correos.
 */

// ------------------------------------------------------------
// LAS REGLAS
// ------------------------------------------------------------

/** Zona de la que se parte cuando el negocio no tiene una válida. */
export const ZONA_POR_DEFECTO = "America/Costa_Rica";

/**
 * Los estados de reserva que devengan comisión el día del evento.
 *
 * 'confirmada' es el caso normal. 'cumplida' y 'no_asistio' entran
 * porque las citas (vertical Citas) pasan a esos estados el MISMO día
 * del evento: si el barrido solo mirara 'confirmada', una cita marcada
 * a las 10 de la mañana ya no calificaría a la hora del barrido y no
 * pagaría comisión NUNCA.
 *
 * Antes de este cambio esas reservas SÍ cobraban —lo hacían al
 * confirmarse, mucho antes de marcarse— así que dejarlas fuera no
 * sería "una regla nueva": sería perder plata que hoy se cobra, en
 * silencio. Por eso están.
 */
export const ESTADOS_QUE_DEVENGAN = [
  "confirmada",
  "cumplida",
  "no_asistio",
] as const;

/** Modelos de tarifa que no dejan cobro por reserva. */
export const MODELOS_SIN_COBRO_POR_RESERVA = ["membresia_mensual", "gratis"];

/** Cuántos días hacia atrás barre el cron por defecto. */
export const VENTANA_BARRIDO_DIAS = 7;

/**
 * Tope duro de la ventana. Existe para que una corrida a mano con un
 * número grande no facture de golpe un año de histórico: recuperar
 * cobros viejos es trabajo del backfill, que se corre a conciencia y
 * en simulación primero.
 */
export const VENTANA_BARRIDO_MAX = 90;

/**
 * Deja la ventana dentro de límites sanos (0 … 90).
 *
 * Ausente, vacía o ilegible => el default de 7, igual que el
 * `coalesce(p_dias_atras, 7)` del SQL. OJO: `Number(null)` es 0, y un 0
 * silencioso acá significaría "no devengar NADA" — un cron que no cobra
 * y no se queja. Por eso lo ausente se separa a mano de lo que de
 * verdad vale cero.
 */
export function ventanaValida(dias: unknown): number {
  if (dias === null || dias === undefined || dias === "") return VENTANA_BARRIDO_DIAS;
  const n = Number(dias);
  if (!Number.isFinite(n)) return VENTANA_BARRIDO_DIAS;
  return Math.max(0, Math.min(Math.trunc(n), VENTANA_BARRIDO_MAX));
}

/**
 * Personas que cuentan para la comisión: mínimo 1 — una cita sin
 * invitados es UNA persona atendida, no cero. Misma convención que
 * `personasDeReserva` (cobro-plataforma.ts), que `personasCobrables`
 * del backfill y que el `greatest(1, coalesce(invitados, 1))` del SQL.
 */
export function personasCobrables(invitados: number | null | undefined): number {
  const n = Number(invitados ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

/** La tarifa que aplica: la propia del negocio o el default global. */
export type TarifaAplicada = {
  modelo: string;
  valor: number;
  /** true = no tiene fila en cobro_negocio; aplica el global. */
  esGlobal: boolean;
};

export function resolverTarifa(
  ranchoId: string,
  tarifasPorRancho: Map<string, { modelo: string; valor: number }>,
  comisionGlobal: number,
): TarifaAplicada {
  const propia = tarifasPorRancho.get(ranchoId);
  if (propia) {
    return { modelo: propia.modelo, valor: Number(propia.valor ?? 0), esGlobal: false };
  }
  return {
    modelo: "comision_por_persona",
    valor: Number(comisionGlobal ?? 0),
    esGlobal: true,
  };
}

/** Lo mínimo que hace falta de una reserva para saber qué devenga. */
export type ReservaDevengable = {
  id: string;
  /** La fecha del EVENTO (YYYY-MM-DD), no la de la reserva. */
  fecha: string;
  estado: string;
  invitados: number | null;
  monto_total: number | null;
  monto_cobrado_final: number | null;
  rancho_id: string | null;
  /** Nombre del cliente — se copia al asiento para que se lea solo. */
  nombre: string | null;
  /** `ranchos.zona_horaria` del negocio. Vacía o inválida => Costa Rica. */
  zona_horaria?: string | null;
  /** true = ya tiene asiento concepto='reserva'. En la base esto lo
   *  resuelve el índice único; acá hace falta para la simulación. */
  yaDevengada?: boolean;
};

/**
 * Lo que devenga UNA reserva con esa tarifa. Espejo exacto del
 * `case c.modelo` de `devengar_cobros_del_dia` (0171), que a su vez es
 * el mismo `case` que traía el trigger de la 0106 — la fórmula del
 * monto NO cambió al mover el disparo.
 *
 * OJO CON EL PORCENTAJE: `coalesce(monto_cobrado_final, monto_total)`
 * siempre estuvo en la fórmula, pero al confirmar la reserva
 * `monto_cobrado_final` todavía es null, así que en la práctica el
 * trigger cobraba SIEMPRE sobre la cotización. Devengar el día del
 * evento hace que el coalesce por fin signifique algo: si el dueño ya
 * registró lo que cobró de verdad (más invitados, horas extra), la
 * comisión sale de ahí. Es una diferencia real en la plata; está
 * anotada como pregunta para el dueño en el reporte.
 */
export function montoDevengado(
  r: Pick<ReservaDevengable, "invitados" | "monto_total" | "monto_cobrado_final">,
  tarifa: TarifaAplicada,
): number {
  const valor = Number(tarifa.valor ?? 0);
  if (!Number.isFinite(valor)) return 0;
  if (MODELOS_SIN_COBRO_POR_RESERVA.includes(tarifa.modelo)) return 0;

  switch (tarifa.modelo) {
    case "comision_por_persona":
      return personasCobrables(r.invitados) * valor;
    case "comision_fija_reserva":
      return valor;
    case "comision_porcentaje": {
      const total = Number(r.monto_cobrado_final ?? r.monto_total ?? 0);
      if (!Number.isFinite(total) || total <= 0) return 0;
      return Math.round((total * valor) / 100);
    }
    default:
      return 0;
  }
}

/**
 * El LUNES de la semana a la que pertenece el asiento: la del EVENTO.
 *
 * Antes era la semana de la CONFIRMACIÓN. Se cambió a propósito: si el
 * barrido se atrasa un día (el cron no corrió, hubo un deploy), el
 * asiento igual cae en la semana en que el servicio se prestó, y la
 * cuenta que se le pasa al negocio no se corre de lugar por un
 * problema de infraestructura.
 */
export function semanaDelEvento(fechaEventoIso: string): string {
  return claveFecha(inicioDeSemana(aFecha(fechaEventoIso)));
}

/** Por qué una reserva NO devengó — para el modo simulación. */
export type MotivoNoDevenga =
  | "ya_devengada"
  | "estado_no_devenga"
  | "sin_negocio"
  | "evento_futuro"
  | "fuera_de_ventana"
  | "modelo_sin_cobro"
  | "monto_cero";

export const MOTIVO_LABEL: Record<MotivoNoDevenga, string> = {
  ya_devengada: "Ya tiene su cobro anotado",
  estado_no_devenga: "El estado de la reserva no devenga comisión",
  sin_negocio: "La reserva no está atada a ningún negocio",
  evento_futuro: "El evento todavía no llegó (en la hora del negocio)",
  fuera_de_ventana: "El evento quedó fuera de la ventana del barrido",
  modelo_sin_cobro: "La tarifa del negocio no cobra por reserva",
  monto_cero: "La cuenta da ₡0",
};

export type Veredicto =
  | {
      devenga: true;
      /** El día que es HOY donde está el negocio (YYYY-MM-DD). */
      hoyAlla: string;
      personas: number;
      modelo: string;
      tarifa: number;
      monto: number;
      semana: string;
    }
  | { devenga: false; hoyAlla: string; motivo: MotivoNoDevenga };

/**
 * ¿A esta reserva le toca cobro en esta corrida?
 *
 * "El día del evento" se evalúa SIEMPRE en la zona del negocio, nunca
 * en UTC ni en la del servidor. Vercel corre en UTC, seis horas
 * adelantado a Costa Rica: a las 6 de la tarde de un martes tico el
 * servidor ya cree que es miércoles. Con esa cuenta, un evento del
 * miércoles se cobraría el martes por la tarde — un día antes de que
 * el servicio se preste.
 *
 * La ventana hacia atrás (`diasAtras`) no es un lujo: cubre la reserva
 * que se creó y se confirmó el mismo día del evento después de que el
 * barrido ya había corrido, y el día que el cron no corrió.
 */
export function evaluarDevengo(
  r: ReservaDevengable,
  tarifa: TarifaAplicada,
  ahora: Date,
  diasAtras: number = VENTANA_BARRIDO_DIAS,
): Veredicto {
  const hoyAlla = fechaISOEnZona(ahora, r.zona_horaria ?? ZONA_POR_DEFECTO);

  if (r.yaDevengada) return { devenga: false, hoyAlla, motivo: "ya_devengada" };
  if (!r.rancho_id) return { devenga: false, hoyAlla, motivo: "sin_negocio" };
  if (!(ESTADOS_QUE_DEVENGAN as readonly string[]).includes(r.estado)) {
    return { devenga: false, hoyAlla, motivo: "estado_no_devenga" };
  }

  const fecha = r.fecha.slice(0, 10);
  if (fecha > hoyAlla) return { devenga: false, hoyAlla, motivo: "evento_futuro" };

  const ventana = ventanaValida(diasAtras);
  // El piso es EXCLUSIVO, igual que el `> hoy - v_dias` del SQL: con
  // ventana 7 entran hoy y los seis días anteriores.
  const piso = sumarDiasISO(hoyAlla, -ventana);
  if (fecha <= piso) return { devenga: false, hoyAlla, motivo: "fuera_de_ventana" };

  if (MODELOS_SIN_COBRO_POR_RESERVA.includes(tarifa.modelo)) {
    return { devenga: false, hoyAlla, motivo: "modelo_sin_cobro" };
  }

  const monto = montoDevengado(r, tarifa);
  if (monto <= 0) return { devenga: false, hoyAlla, motivo: "monto_cero" };

  return {
    devenga: true,
    hoyAlla,
    personas: personasCobrables(r.invitados),
    modelo: tarifa.modelo,
    tarifa: Number(tarifa.valor ?? 0),
    monto,
    semana: semanaDelEvento(fecha),
  };
}

// ------------------------------------------------------------
// EL AVISO: agrupar lo devengado para contarlo en un correo
// ------------------------------------------------------------

/** Una fila tal como la devuelve `devengar_cobros_del_dia` (0171). */
export type FilaDevengada = {
  cobro_id: string;
  reserva: string | null;
  negocio_id: string | null;
  negocio: string | null;
  cliente: string | null;
  fecha_evento: string | null;
  personas: number;
  tarifa: number;
  modelo: string;
  monto: number;
  semana: string;
};

export type NegocioDevengado = {
  negocioId: string | null;
  negocio: string;
  reservas: number;
  total: number;
  filas: FilaDevengada[];
};

export type ResumenDevengo = {
  /** Colones devengados en esta corrida. */
  total: number;
  /** Cuántos asientos nuevos se anotaron. */
  reservas: number;
  /** Un renglón por negocio, el que más deja primero. */
  negocios: NegocioDevengado[];
  /** Las semanas de corte que tocó esta corrida (lunes, YYYY-MM-DD). */
  semanas: string[];
};

/**
 * Agrupa por negocio lo que acaba de devengarse. Es lo que va en el
 * correo diario al equipo de Bookea: un renglón por negocio, ordenado
 * por plata, y el total arriba.
 */
export function agruparDevengo(filas: FilaDevengada[]): ResumenDevengo {
  const porNegocio = new Map<string, NegocioDevengado>();
  const semanas = new Set<string>();
  let total = 0;

  for (const f of filas) {
    const monto = Number(f.monto ?? 0);
    total += Number.isFinite(monto) ? monto : 0;
    if (f.semana) semanas.add(f.semana);

    const clave = f.negocio_id ?? "sin-negocio";
    let fila = porNegocio.get(clave);
    if (!fila) {
      fila = {
        negocioId: f.negocio_id,
        negocio: f.negocio ?? "Negocio dado de baja",
        reservas: 0,
        total: 0,
        filas: [],
      };
      porNegocio.set(clave, fila);
    }
    fila.reservas += 1;
    fila.total += Number.isFinite(monto) ? monto : 0;
    fila.filas.push(f);
  }

  const negocios = [...porNegocio.values()].sort(
    (a, b) => b.total - a.total || a.negocio.localeCompare(b.negocio),
  );

  return {
    total,
    reservas: filas.length,
    negocios,
    semanas: [...semanas].sort(),
  };
}

/**
 * ¿El error es "esa función no existe"? Pasa mientras la 0171 no se
 * haya pegado en el SQL Editor: el cron ya llama a
 * `devengar_cobros_del_dia` pero la función no está. Vienen por dos
 * caminos y hay que reconocer los dos (mismo criterio que
 * `esTablaCobrosInexistente` en libro-cobros.ts): el 42883 de Postgres
 * y el PGRST202 de PostgREST, que ni llega a la base.
 */
export function esFuncionDevengoInexistente(error: {
  code?: string;
  message?: string;
}): boolean {
  const mensaje = (error.message ?? "").toLowerCase();
  if (
    mensaje.includes("devengar_cobros_del_dia") &&
    (mensaje.includes("does not exist") || mensaje.includes("could not find"))
  ) {
    return true;
  }
  return error.code === "42883" || error.code === "PGRST202";
}

/** El archivo que hay que pegar en el SQL Editor si la función no está. */
export const MIGRACION_DEVENGO = "supabase/migrations/0171_cobro_el_dia_del_evento.sql";
