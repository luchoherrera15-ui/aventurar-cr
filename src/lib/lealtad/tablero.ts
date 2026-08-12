/**
 * El estado del programa de lealtad de un negocio: cuánta gente hay,
 * quién está por ganarse algo y quién se está enfriando.
 *
 * Lógica pura. Todo se DERIVA del ledger (`transacciones_puntos`), que
 * es la única verdad del saldo — igual que el CRM de citas se deriva de
 * las reservas (decisión D-3). Acá no se guarda ningún número.
 */

export type MiembroCrudo = {
  id: string;
  cliente_id: string | null;
  estado: string;
  created_at: string;
};

export type TransaccionCruda = {
  miembro_id: string;
  puntos: number;
  tipo: string;
  created_at: string;
};

/** Un pase emitido, para saber quién lo lleva en el teléfono. */
export type PaseCrudo = { miembro_id: string; plataforma: string };

export type FichaMiembro = {
  miembroId: string;
  clienteId: string | null;
  nombre: string;
  saldo: number;
  /** Cuántos le faltan para la recompensa. null = no hay meta. */
  faltan: number | null;
  /** Ya puede canjear. */
  puedeCanjear: boolean;
  /** Tiene la tarjeta agregada al Wallet. */
  conPase: boolean;
  /** Días desde su último movimiento. null = nunca tuvo ninguno. */
  diasSinVenir: number | null;
  estado: string;
};

export type ResumenLealtad = {
  miembros: number;
  /** Cuántos llevan la tarjeta en el teléfono. */
  conPase: number;
  /** Movimientos ganados en la ventana mirada. */
  sellosRecientes: number;
  /** Cuántos canjearon alguna vez. */
  canjes: number;
  /** Los que ya pueden pedir su recompensa. */
  listosParaCanjear: number;
  /** Sin movimientos en 60 días o más: los que se están yendo. */
  enRiesgo: number;
};

/** Días desde una fecha ISO hasta `hoy` (YYYY-MM-DD). */
function diasDesde(iso: string, hoy: string): number {
  const aUtc = (f: string) =>
    Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
  return Math.max(0, Math.round((aUtc(hoy) - aUtc(iso.slice(0, 10))) / 86_400_000));
}

/** Sin movimientos en este tiempo, el cliente se está yendo. */
const DIAS_EN_RIESGO = 60;

export function fichasDeMiembros({
  miembros,
  transacciones,
  pases,
  nombres,
  meta,
  hoy,
}: {
  miembros: MiembroCrudo[];
  transacciones: TransaccionCruda[];
  pases: PaseCrudo[];
  /** cliente_id → nombre, para no repetir la consulta por miembro. */
  nombres: Map<string, string>;
  /** Costo de la recompensa activa más barata. null = sin meta. */
  meta: number | null;
  hoy: string;
}): FichaMiembro[] {
  const saldos = new Map<string, number>();
  const ultimo = new Map<string, string>();

  for (const t of transacciones) {
    saldos.set(t.miembro_id, (saldos.get(t.miembro_id) ?? 0) + t.puntos);
    // Solo lo GANADO cuenta como "vino": un canje no es una visita, y
    // un ajuste manual del dueño tampoco.
    if (t.tipo === "ganado") {
      const previo = ultimo.get(t.miembro_id);
      if (!previo || t.created_at > previo) ultimo.set(t.miembro_id, t.created_at);
    }
  }

  const conPase = new Set(pases.map((p) => p.miembro_id));

  return miembros
    .map((m) => {
      const saldo = saldos.get(m.id) ?? 0;
      const visto = ultimo.get(m.id) ?? null;
      return {
        miembroId: m.id,
        clienteId: m.cliente_id,
        nombre: (m.cliente_id && nombres.get(m.cliente_id)) || "Cliente",
        saldo,
        faltan: meta === null ? null : Math.max(0, meta - saldo),
        puedeCanjear: meta !== null && saldo >= meta,
        conPase: conPase.has(m.id),
        diasSinVenir: visto ? diasDesde(visto, hoy) : null,
        estado: m.estado,
      };
    })
    // Primero los que ya pueden canjear —hay que atenderlos—, después
    // por saldo. El dueño abre esto para saber a quién le debe algo.
    .sort((a, b) => Number(b.puedeCanjear) - Number(a.puedeCanjear) || b.saldo - a.saldo);
}

export function resumenDeLealtad({
  fichas,
  transacciones,
  hoy,
  ventanaDias = 30,
}: {
  fichas: FichaMiembro[];
  transacciones: TransaccionCruda[];
  hoy: string;
  ventanaDias?: number;
}): ResumenLealtad {
  const recientes = transacciones.filter(
    (t) => t.tipo === "ganado" && diasDesde(t.created_at, hoy) <= ventanaDias,
  );

  const canjearon = new Set(
    transacciones.filter((t) => t.tipo === "canjeado").map((t) => t.miembro_id),
  );

  return {
    miembros: fichas.length,
    conPase: fichas.filter((f) => f.conPase).length,
    sellosRecientes: recientes.reduce((s, t) => s + t.puntos, 0),
    canjes: canjearon.size,
    listosParaCanjear: fichas.filter((f) => f.puedeCanjear).length,
    // Los que nunca tuvieron un movimiento NO cuentan como en riesgo:
    // se acaban de afiliar, no se están yendo.
    enRiesgo: fichas.filter(
      (f) => f.diasSinVenir !== null && f.diasSinVenir >= DIAS_EN_RIESGO,
    ).length,
  };
}
