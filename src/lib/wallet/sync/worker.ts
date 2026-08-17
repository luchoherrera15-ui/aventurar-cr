import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarPaseApple } from "./adaptador-apple";
import { sincronizarPaseGoogle } from "./adaptador-google";
import type { OperacionSync, PlataformaSync, ResultadoSync, TrabajoSync } from "./tipos";

/**
 * EL NÚCLEO DEL WORKER DE SINCRONIZACIÓN (Wallet V2, Fase 3/4).
 *
 * Un ciclo (`ejecutarCicloDeSincronizacion`) hace, en orden, exactamente
 * cuatro cosas:
 *
 *   1. `barrerLeaseExpirada()` — repone a `retryable` lo que un worker
 *      caído dejó `processing` con el lease vencido. SIEMPRE primero:
 *      reclamar antes de barrer dejaría esas filas "perdidas" un ciclo
 *      más.
 *   2. `reclamarLote()` — toma hasta `LOTE_MAXIMO` filas `pending` o
 *      `retryable` listas (`proximo_intento_en <= now()`), con
 *      `FOR UPDATE SKIP LOCKED` para que dos invocaciones solapadas del
 *      cron nunca se repartan la misma fila.
 *   3. Por cada trabajo reclamado, despacha al adaptador de su
 *      `plataforma` — Apple o Google, nunca los dos — y nunca deja
 *      escapar una excepción del adaptador: un trabajo que revienta no
 *      puede tumbar el resto del lote.
 *   4. `marcarResultado()` — decide `succeeded` / `retryable` (con
 *      backoff+jitter) / `dead` (fallo permanente o `max_intentos`
 *      agotado) y lo escribe.
 *
 * ------------------------------------------------------------------
 * POR QUÉ HAY UNA MIGRACIÓN NUEVA (0167) QUE EL PLAN NO LISTABA
 * ------------------------------------------------------------------
 * El plan describe el reclamo como "CTE SELECT...FOR UPDATE SKIP
 * LOCKED LIMIT $1 + UPDATE ... RETURNING *" — el mismo patrón que
 * `wallet-v2-cola-sincronizacion.test.ts` ya probó, pero ESE archivo lo
 * corre con `docker exec ... psql` contra el Postgres local: un atajo
 * que solo existe en la máquina de pruebas. Este worker corre en
 * Vercel y solo puede hablar con la base por supabase-js/PostgREST, que
 * no permite componer un UPDATE cuyo WHERE sea un SELECT ... FOR UPDATE
 * SKIP LOCKED con LIMIT desde el cliente REST. La única forma real de
 * reclamar un lote es una función de Postgres invocada por RPC — el
 * mismo camino que ya usa `wallet_encolar_sincronizacion` — así que
 * `supabase/migrations/0167_wallet_v2_reclamo_atomico_sincronizacion.sql`
 * agrega `wallet_barrer_lease_expirada` y `wallet_reclamar_sincronizaciones`,
 * ambas `security definer`, ambas otorgadas SOLO a `service_role` (el
 * mismo criterio de acceso que ya tiene la tabla). Este archivo no
 * agrega SQL propio más allá de esas dos llamadas por RPC.
 *
 * ------------------------------------------------------------------
 * INYECCIÓN DE ADAPTADORES — NUNCA RED REAL EN TESTS
 * ------------------------------------------------------------------
 * `ejecutarCicloDeSincronizacion` recibe los adaptadores por `opts`
 * (default: los reales, `sincronizarPaseApple`/`sincronizarPaseGoogle`).
 * El companion test (`worker.test.ts`) los reemplaza por funciones de
 * prueba que nunca tocan APNs ni Google Wallet — solo ejercitan
 * claim/lease/backoff contra el Postgres local real.
 *
 * ------------------------------------------------------------------
 * IDEMPOTENCIA
 * ------------------------------------------------------------------
 * `reclamarLote` solo reclama filas en `pending`/`retryable` — una fila
 * ya `succeeded` nunca vuelve a reclamarse, así que invocar el ciclo
 * dos veces sobre un trabajo que ya tuvo éxito no lo reprocesa. Y
 * `marcarResultado` invocada dos veces con el mismo resultado sobre el
 * mismo trabajo escribe el mismo estado final las dos veces — no hay
 * contador que se duplique ni efecto que se acumule.
 */

// ── Constantes del plan ────────────────────────────────────────────

/** Tamaño máximo de lote por invocación — el techo duro que también usa la ruta HTTP. */
export const LOTE_MAXIMO = 20;
/** Minutos sin novedad en `processing` antes de considerar el lease vencido (worker caído). */
export const LEASE_MINUTOS = 5;
/** Piso del backoff, en segundos (antes del jitter). */
export const BACKOFF_BASE_SEG = 30;
/** Techo del backoff, en segundos — nunca esperar más de una hora entre reintentos. */
export const BACKOFF_TOPE_SEG = 3600;

/**
 * Backoff exponencial con "equal jitter": la mitad del delay es fija,
 * la otra mitad es aleatoria — evita tanto el reintento en tropel
 * (jitter puro) como el reintento sincronizado entre trabajos (backoff
 * puro sin jitter). `intentos` es el número de intento que está por
 * hacerse (1 = primer reintento, después del intento original).
 */
export function calcularBackoffSeg(intentos: number): number {
  const exponente = Math.max(0, intentos - 1);
  const delay = Math.min(BACKOFF_TOPE_SEG, BACKOFF_BASE_SEG * 2 ** exponente);
  return delay / 2 + Math.random() * (delay / 2);
}

// ── El shape de fila que devuelven las RPC de 0167 ─────────────────
// `wallet_reclamar_sincronizaciones` devuelve `setof
// wallet_sincronizaciones` — todas las columnas de la tabla en
// snake_case. Se tipa acá solo lo que `TrabajoSync` necesita; el resto
// de columnas (estado, timestamps de contabilidad) las administra este
// mismo archivo, no los adaptadores, así que no hace falta traerlas al
// tipo compartido.
interface FilaSincronizacion {
  id: string;
  cuenta_id: string | null;
  programa_id: string;
  miembro_id: string;
  pase_id: string;
  plataforma: string;
  operacion: string;
  idempotency_key: string;
  correlation_id: string;
  version_local_esperada: number | null;
  intentos: number;
  max_intentos: number;
}

function filaATrabajo(fila: FilaSincronizacion): TrabajoSync {
  return {
    id: fila.id,
    // `cuenta_id` es nullable en la tabla (0161) por un caso de borde
    // que en la práctica no ocurre hoy (todo programa_lealtad cuelga
    // de una cuenta desde el backfill 0157) — se cubre igual para no
    // reventar el mapeo si algún día aparece una fila así.
    cuentaId: fila.cuenta_id ?? "",
    programaId: fila.programa_id,
    miembroId: fila.miembro_id,
    paseId: fila.pase_id,
    // El `check` de la tabla ya restringe estos dos valores a los que
    // `PlataformaSync`/`OperacionSync` permiten — el cast solo nombra
    // esa garantía, no la crea.
    plataforma: fila.plataforma as PlataformaSync,
    operacion: fila.operacion as OperacionSync,
    idempotencyKey: fila.idempotency_key,
    correlationId: fila.correlation_id,
    versionLocalEsperada: fila.version_local_esperada,
    intentos: fila.intentos,
    maxIntentos: fila.max_intentos,
  };
}

/**
 * Repone a `retryable` las filas `processing` con lease vencido (un
 * worker que reclamó y se cayó antes de terminar). Devuelve cuántas
 * repuso. Nunca lanza: sin conexión de servicio, o si la RPC falla,
 * devuelve 0 y lo deja en el log — un barrido que no corrió esta vez
 * lo intenta de nuevo el ciclo siguiente, cinco minutos después.
 */
export async function barrerLeaseExpirada(): Promise<number> {
  const db = createAdminClient();
  if (!db) {
    console.error("[wallet-sync] no hay conexión de servicio: no se pudo barrer el lease.");
    return 0;
  }

  const { data, error } = await db.rpc("wallet_barrer_lease_expirada", {
    p_lease_minutos: LEASE_MINUTOS,
  });
  if (error) {
    console.error(`[wallet-sync] barrido de lease expirada falló: ${error.message}`);
    return 0;
  }

  const n = Number(data);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reclama hasta `cantidad` trabajos listos (`pending`/`retryable`,
 * `proximo_intento_en <= now()`, sin lease) — atómico, vía
 * `wallet_reclamar_sincronizaciones` (0167): dos invocaciones
 * concurrentes de este mismo worker nunca reciben la misma fila.
 * `cantidad` se clampa acá también (0..`LOTE_MAXIMO`) — defensa en
 * profundidad, no solo confía en que quien llama ya clampeó.
 */
export async function reclamarLote(cantidad: number, workerId: string): Promise<TrabajoSync[]> {
  const db = createAdminClient();
  if (!db) {
    console.error("[wallet-sync] no hay conexión de servicio: no se pudo reclamar el lote.");
    return [];
  }

  const cantidadSegura = Math.min(Math.max(0, Math.trunc(cantidad)), LOTE_MAXIMO);
  if (cantidadSegura === 0) return [];

  const { data, error } = await db.rpc("wallet_reclamar_sincronizaciones", {
    p_cantidad: cantidadSegura,
    p_worker_id: workerId,
  });
  if (error) {
    console.error(`[wallet-sync] reclamo de lote falló: ${error.message}`);
    return [];
  }

  const filas = (data ?? []) as FilaSincronizacion[];
  return filas.map(filaATrabajo);
}

type EstadoFinal = "succeeded" | "retryable" | "dead";

/**
 * La MISMA regla que separa `retryable` de `dead`, en un solo lugar:
 * `marcarResultado` la usa para decidir qué escribe, y
 * `ejecutarCicloDeSincronizacion` la reusa para el resumen del ciclo —
 * así las dos nunca pueden divergir sobre qué le pasó a un trabajo.
 */
function clasificarResultado(job: TrabajoSync, resultado: ResultadoSync): EstadoFinal {
  if (resultado.ok) return "succeeded";
  const intentosSiguientes = job.intentos + 1;
  return resultado.reintentable && intentosSiguientes < job.maxIntentos ? "retryable" : "dead";
}

/**
 * Escribe el resultado de UN trabajo ya procesado. Nunca lanza: un
 * error al escribir el resultado no puede tumbar el resto del lote —
 * queda en el log, y como la fila sigue en `processing`, la recupera
 * `barrerLeaseExpirada()` cuando venza el lease.
 *
 * Idempotente: llamarla dos veces con el mismo `job`/`resultado`
 * reescribe el mismo estado final las dos veces (mismo `intentos`,
 * mismo backoff calculado de nuevo a partir de los mismos datos de
 * entrada — no acumula sobre lo ya escrito).
 */
export async function marcarResultado(job: TrabajoSync, resultado: ResultadoSync): Promise<void> {
  const db = createAdminClient();
  if (!db) {
    console.error(`[wallet-sync] no hay conexión de servicio: no se pudo marcar trabajo=${job.id}.`);
    return;
  }

  const campos: Record<string, unknown> = {
    bloqueado_en: null,
    bloqueado_por: null,
    ultimo_intento_en: new Date().toISOString(),
  };
  // Solo se toca `respuesta_remota` cuando el adaptador de verdad trajo
  // algo: no pisar con `null` la última respuesta útil de un trabajo
  // que, por ejemplo, falló al escribir el resultado en vez de al
  // llamar a la plataforma.
  if (resultado.respuestaRemota !== undefined) {
    campos.respuesta_remota = resultado.respuestaRemota;
  }

  const estadoFinal = clasificarResultado(job, resultado);

  if (estadoFinal === "succeeded") {
    campos.estado = "succeeded";
    campos.exitoso_en = new Date().toISOString();
  } else if (estadoFinal === "retryable") {
    const intentos = job.intentos + 1;
    const esperaSeg = calcularBackoffSeg(intentos);
    campos.estado = "retryable";
    campos.intentos = intentos;
    campos.error = resultado.ok ? null : resultado.motivo;
    campos.proximo_intento_en = new Date(Date.now() + esperaSeg * 1000).toISOString();
  } else {
    campos.estado = "dead";
    campos.intentos = job.intentos + 1;
    campos.error = resultado.ok ? null : resultado.motivo;
    campos.fallido_permanente_en = new Date().toISOString();
  }

  const { error } = await db.from("wallet_sincronizaciones").update(campos).eq("id", job.id);
  if (error) {
    console.error(
      `[wallet-sync] no se pudo escribir el resultado (${estadoFinal}) del trabajo=${job.id}: ${error.message}`,
    );
  }
}

/** Los dos únicos puntos de entrada de red que despacha el worker — inyectables para tests. */
export interface AdaptadoresSync {
  apple: (job: TrabajoSync) => Promise<ResultadoSync>;
  google: (job: TrabajoSync) => Promise<ResultadoSync>;
}

const ADAPTADORES_REALES: AdaptadoresSync = {
  apple: sincronizarPaseApple,
  google: sincronizarPaseGoogle,
};

export interface ResumenCiclo {
  barridos: number;
  reclamados: number;
  exitosos: number;
  reintentados: number;
  muertos: number;
}

/**
 * Un ciclo completo: barre leases vencidas, reclama un lote, despacha
 * cada trabajo a su adaptador y marca el resultado. Ver el comentario
 * de cabecera del archivo para el orden y por qué es ese orden.
 *
 * `opts.adaptadores` y `opts.workerId` son inyectables (default: los
 * adaptadores reales / un id generado) — es lo que le permite al
 * companion test ejercitar claim/lease/backoff contra el Postgres
 * local real sin que un solo trabajo le hable a Apple o a Google.
 */
export async function ejecutarCicloDeSincronizacion(opts: {
  loteMax: number;
  workerId?: string;
  adaptadores?: AdaptadoresSync;
}): Promise<ResumenCiclo> {
  const adaptadores = opts.adaptadores ?? ADAPTADORES_REALES;
  const workerId = opts.workerId ?? `wallet-sync:${randomUUID()}`;

  const barridos = await barrerLeaseExpirada();

  const cantidad = Math.min(Math.max(1, Math.trunc(opts.loteMax)), LOTE_MAXIMO);
  const trabajos = await reclamarLote(cantidad, workerId);

  let exitosos = 0;
  let reintentados = 0;
  let muertos = 0;

  for (const job of trabajos) {
    const adaptador = job.plataforma === "apple" ? adaptadores.apple : adaptadores.google;

    let resultado: ResultadoSync;
    try {
      resultado = await adaptador(job);
    } catch (e) {
      // Un adaptador nunca debería lanzar (los dos documentan que
      // atrapan sus propios errores), pero un trabajo individual que
      // revienta no puede tumbar el resto del lote ni dejar la fila
      // colgada en `processing` hasta que venza el lease sin motivo.
      resultado = {
        ok: false,
        reintentable: true,
        motivo: e instanceof Error ? e.message : "El adaptador lanzó una excepción sin atrapar.",
      };
    }

    await marcarResultado(job, resultado);

    const estadoFinal = clasificarResultado(job, resultado);
    if (estadoFinal === "succeeded") exitosos += 1;
    else if (estadoFinal === "retryable") reintentados += 1;
    else muertos += 1;
  }

  return { barridos, reclamados: trabajos.length, exitosos, reintentados, muertos };
}
