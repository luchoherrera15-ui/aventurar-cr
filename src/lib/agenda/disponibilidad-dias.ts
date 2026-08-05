/**
 * Disponibilidad por DÍA — para negocios que reservan por evento
 * (Lugares y servicios que cobran por fecha), no por turno de hora.
 * Es otra cosa que el motor de `disponibilidad.ts`: ese calcula huecos
 * de horario dentro de un día para la vertical Citas; este calcula qué
 * DÍAS ya no tienen cupo, con la misma regla que ya aplica el resto
 * de la agenda (`agenda-actions.ts`, migración 0049): cada negocio
 * atiende hasta `eventos_por_dia` eventos por fecha (los Lugares caen
 * en 1 si no lo configuraron), null = sin tope.
 *
 * 100% puro: no toca Supabase ni el reloj, así que se prueba con datos
 * de mentira. Quien lo llama ya trajo las reservas activas del rango
 * de fechas que le interesa.
 */

export type ReservaParaCupo = { fecha: string; estado: string };

export type ReservaConRango = ReservaParaCupo & {
  /** Último día de un alquiler multi-día (0067). null/ausente = un solo día. */
  fecha_fin?: string | null;
};

/** Suma un día a una fecha ISO sin pasar por Date (evita zonas horarias). */
function siguienteDia(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + 1));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Expande las reservas multi-día en una fila por fecha ocupada: un
 * alquiler del 20 al 22 bloquea el 20, el 21 Y el 22 — sin esto, solo
 * su primer día contaba para el cupo y los días intermedios se
 * ofrecían como libres. `topeDias` es la red de seguridad contra un
 * fecha_fin corrupto (año 3000): nunca se expande más que eso.
 */
export function expandirRangos(
  reservas: ReservaConRango[],
  topeDias = 60,
): ReservaParaCupo[] {
  const filas: ReservaParaCupo[] = [];
  for (const r of reservas) {
    filas.push({ fecha: r.fecha, estado: r.estado });
    if (!r.fecha_fin || r.fecha_fin <= r.fecha) continue;
    let dia = r.fecha;
    for (let i = 0; i < topeDias && dia < r.fecha_fin; i++) {
      dia = siguienteDia(dia);
      filas.push({ fecha: dia, estado: r.estado });
    }
  }
  return filas;
}

/**
 * Las fechas del rango que YA NO tienen cupo: alcanzaron o pasaron el
 * límite de eventos por día, contando pendientes y confirmadas (igual
 * que el chequeo de `crearReservaManual` antes de dejar cargar una
 * reserva más).
 */
export function fechasLlenas(
  reservas: ReservaParaCupo[],
  cupo: number | null,
): Set<string> {
  // Sin tope, un conteo nunca alcanza para llenar el día.
  if (cupo === null) return new Set();

  const conteo = new Map<string, number>();
  for (const r of reservas) {
    if (r.estado !== "pendiente" && r.estado !== "confirmada") continue;
    conteo.set(r.fecha, (conteo.get(r.fecha) ?? 0) + 1);
  }

  const llenas = new Set<string>();
  for (const [fecha, n] of conteo) {
    if (n >= cupo) llenas.add(fecha);
  }
  return llenas;
}

/** Fechas bloqueadas a mano o importadas de una agenda externa (0072). */
export function fechasBloqueadas(reservas: ReservaParaCupo[]): Set<string> {
  const bloqueadas = new Set<string>();
  for (const r of reservas) {
    if (r.estado === "bloqueada") bloqueadas.add(r.fecha);
  }
  return bloqueadas;
}

/** La unión ordenada: toda fecha del rango que el negocio NO puede tomar. */
export function fechasSinDisponibilidad(
  reservas: ReservaParaCupo[],
  cupo: number | null,
): string[] {
  const sinCupo = fechasLlenas(reservas, cupo);
  const bloqueadas = fechasBloqueadas(reservas);
  return [...new Set([...sinCupo, ...bloqueadas])].sort();
}

/** El cupo diario del negocio: lo que configuró, o 1 para Lugares por defecto. */
export function cupoDelNegocio(
  eventosPorDia: number | null,
  categoria: string | null,
): number | null {
  return eventosPorDia ?? (categoria === "lugares" ? 1 : null);
}
