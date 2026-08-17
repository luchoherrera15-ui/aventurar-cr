/**
 * WALLET V2 — el contrato compartido del worker de sincronización.
 *
 * Sin lógica a propósito: es la ÚNICA superficie que importan los dos
 * adaptadores (`adaptador-apple.ts`, `adaptador-google.ts`) y el
 * núcleo del worker (`worker.ts`) — así ninguno de los tres necesita
 * conocer los detalles internos de los otros dos. Ver
 * docs/wallet-v2 (plan del worker de sincronización) para el resto de
 * las piezas.
 */

export type PlataformaSync = "apple" | "google";

export type OperacionSync = "saldo" | "diseno" | "pausa" | "mensaje_promocional";

/**
 * Un trabajo, tal como lo entrega `reclamarLote()` — el mismo shape
 * que una fila de `wallet_sincronizaciones` (0161), pero en camelCase
 * y sin las columnas de contabilidad del propio worker (`estado`,
 * `bloqueado_en`, `bloqueado_por`, timestamps): esas las administra
 * `worker.ts`, no los adaptadores.
 */
export interface TrabajoSync {
  id: string;
  cuentaId: string;
  programaId: string;
  miembroId: string;
  paseId: string;
  plataforma: PlataformaSync;
  operacion: OperacionSync;
  idempotencyKey: string;
  correlationId: string | null;
  /** El `update_tag` que este intento espera reflejar. Ver 0161/0164. */
  versionLocalEsperada: number | null;
  intentos: number;
  maxIntentos: number;
}

/**
 * Lo que un adaptador devuelve después de intentar UN trabajo.
 *
 * `reintentable` es la bisagra: separa "esto puede arreglarse solo si
 * se intenta de nuevo más tarde" (red caída, 5xx) de "esto no se va a
 * arreglar reintentando" (credenciales que no están, un dato de
 * entrada inválido) — es lo que `marcarResultado()` usa para decidir
 * entre `retryable` (con backoff) y `dead` (fallo permanente).
 */
export type ResultadoSync =
  | { ok: true; respuestaRemota?: unknown }
  | { ok: false; reintentable: boolean; motivo: string; respuestaRemota?: unknown };
