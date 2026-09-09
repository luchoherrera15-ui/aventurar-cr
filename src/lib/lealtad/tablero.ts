/**
 * El estado del programa de lealtad de un negocio: cuánta gente hay,
 * quién está por ganarse algo y quién se está enfriando.
 *
 * Lógica pura. Todo se DERIVA del ledger (`transacciones_puntos`), que
 * es la única verdad del saldo — igual que el CRM de citas se deriva de
 * las reservas (decisión D-3). Acá no se guarda ningún número.
 */

import { fichaVisible, type IdentidadCliente } from "./identidad-miembro";

export type MiembroCrudo = {
  id: string;
  cliente_id: string | null;
  /** La identidad raíz desde la 0138. `null` solo en bases sin migrar. */
  persona_id?: string | null;
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
  /** El renglón grande: el nombre, o lo que lo reemplaza. Nunca vacío. */
  nombre: string;
  /** true = ese título NO es un nombre (es un correo, un teléfono, o el
   *  texto de «todavía no dio sus datos»). */
  sinNombre: boolean;
  /** Los renglones chicos: correo y teléfono, o la explicación de la
   *  ficha vacía. Ya vienen sin repetir lo que subió al título. */
  contacto: string[];
  saldo: number;
  /** Cuántos le faltan para la recompensa. null = no hay meta. */
  faltan: number | null;
  /** Ya puede canjear. */
  puedeCanjear: boolean;
  /** Tiene la tarjeta agregada al Wallet. */
  conPase: boolean;
  /** Días desde su último movimiento. null = nunca tuvo ninguno. */
  diasSinVenir: number | null;
  /** ISO del alta (`miembros.created_at`): cuándo se afilió. */
  alta: string;
  estado: string;
  /**
   * true = identidad LOCAL (0200): su correo y su WhatsApp son datos de
   * contacto que dio en el mostrador, no una identidad verificada, y
   * pueden estar repetidos con los de otra ficha. El dueño tiene que
   * poder verlo antes de mandarle una promo.
   */
  soloContacto: boolean;
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
  identidades,
  meta,
  hoy,
}: {
  miembros: MiembroCrudo[];
  transacciones: TransaccionCruda[];
  pases: PaseCrudo[];
  /**
   * miembroId → quién es, ya resuelto contra `personas`,
   * `clientes_negocio` y `perfiles` (ver `identidad-miembro.ts`).
   *
   * ANTES ERA `cliente_id → nombre` Y ESE ERA EL BUG: desde la 0138 la
   * mayoría de las membresías tiene `cliente_id` en null —quien se
   * afilia por el póster no abre cuenta— así que el mapa no encontraba
   * a nadie y todas las fichas decían «Cliente». La llave pasa a ser el
   * MIEMBRO, que siempre existe.
   */
  identidades: Map<string, IdentidadCliente>;
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
  // Con qué Wallet lleva la tarjeta: para una ficha sin datos es uno de
  // los pocos rastros que hay de esa persona.
  const plataforma = new Map(pases.map((p) => [p.miembro_id, p.plataforma]));

  return miembros
    .map((m) => {
      const saldo = saldos.get(m.id) ?? 0;
      const visto = ultimo.get(m.id) ?? null;
      const vista = fichaVisible(
        identidades.get(m.id) ?? { nombre: null, correo: null, telefono: null },
        { alta: m.created_at, pase: plataforma.get(m.id) ?? null, miembroId: m.id },
      );
      return {
        miembroId: m.id,
        clienteId: m.cliente_id,
        nombre: vista.titulo,
        sinNombre: vista.sinNombre,
        contacto: vista.contacto,
        saldo,
        faltan: meta === null ? null : Math.max(0, meta - saldo),
        puedeCanjear: meta !== null && saldo >= meta,
        conPase: conPase.has(m.id),
        diasSinVenir: visto ? diasDesde(visto, hoy) : null,
        alta: m.created_at,
        estado: m.estado,
        soloContacto: identidades.get(m.id)?.soloContacto === true,
      };
    })
    // Primero los que ya pueden canjear —hay que atenderlos—, después
    // por saldo. El dueño abre esto para saber a quién le debe algo.
    .sort((a, b) => Number(b.puedeCanjear) - Number(a.puedeCanjear) || b.saldo - a.saldo);
}

/** Cuántos renglones manda el servidor a la lista de Clientes. */
export const TOPE_LISTA_CLIENTES = 50;

/** Un alta de estos días atrás todavía se considera «recién llegado». */
const DIAS_RECIEN_LLEGADO = 7;

/**
 * ═══════════════════════════════════════════════════════════════════
 *  QUIÉNES SE MUESTRAN EN LA LISTA DE CLIENTES
 * ═══════════════════════════════════════════════════════════════════
 *
 * BUG REAL (8 sep 2026, reportado por el dueño): «cuando alguien se
 * registra recién no sale; parece que la base tarda en actualizarse».
 * La base no tardaba nada — la fila se escribe completa en el mismo
 * instante, verificado en producción. Lo que pasaba es que la lista
 * mandaba los primeros 50 de un orden por SALDO, y quien acaba de
 * afiliarse tiene 0: caía al final y no viajaba. En Pura Matcha, con
 * 65 miembros, los 13 que estaban en cero —o sea, TODOS los recién
 * llegados— eran invisibles justo cuando el negocio los tenía enfrente
 * para darles su primer sello.
 *
 * El orden de `fichasDeMiembros` no se toca: lo comparten el tablero,
 * las estadísticas y el admin, y ahí «por saldo» es lo correcto. Acá se
 * elige QUIÉN entra en el recorte, con el criterio del mostrador:
 *
 *   1. los que ya pueden canjear — hay que entregarles algo;
 *   2. los recién llegados, del más nuevo al más viejo — son los que
 *      pueden estar parados en la caja esperando su primer sello;
 *   3. el resto por saldo, como siempre.
 *
 * Los que igual queden fuera del tope no son inalcanzables: el buscador
 * de la lista pregunta al servidor cuando no encuentra a nadie entre
 * los que ya tiene (ver `ListaClientes` en atencion-manual.tsx).
 */
export function fichasParaLaLista(
  fichas: FichaMiembro[],
  {
    hoy,
    tope = TOPE_LISTA_CLIENTES,
    diasNuevo = DIAS_RECIEN_LLEGADO,
  }: { hoy: string; tope?: number; diasNuevo?: number },
): FichaMiembro[] {
  const recienLlegado = (f: FichaMiembro) => !f.puedeCanjear && diasDesde(f.alta, hoy) <= diasNuevo;

  const listos = fichas.filter((f) => f.puedeCanjear);
  // Del más nuevo al más viejo: el último en afiliarse es el que más
  // probablemente esté en el mostrador ahora mismo.
  const nuevos = fichas.filter(recienLlegado).sort((a, b) => b.alta.localeCompare(a.alta));
  const resto = fichas.filter((f) => !f.puedeCanjear && !recienLlegado(f));

  return [...listos, ...nuevos, ...resto].slice(0, tope);
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
