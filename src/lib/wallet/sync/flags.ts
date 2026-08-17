/**
 * Feature flags del rollout de Wallet V2.
 *
 * Aislado a propósito (lo pide el plan de arquitectura): el worker, la
 * ruta del cron y los tests preguntan acá sin arrastrar nada de
 * `worker.ts` ni de los adaptadores. Este archivo no importa nada del
 * resto de `sync/` ni al revés.
 *
 * ------------------------------------------------------------------
 * DOS CONVENCIONES YA EXISTENTES EN EL REPO — NINGUNA SE INVENTÓ ACÁ
 * ------------------------------------------------------------------
 * 1) Interruptor booleano por variable de entorno. El repo ya tiene dos
 *    sabores: `formulario-auth.tsx` compara contra `"1"`
 *    (`NEXT_PUBLIC_AUTH_GOOGLE=1`); el propio plan de arquitectura de
 *    este rollout fijó `"true"` para `WALLET_V2_SYNC_ENABLED`. Acá se
 *    usa `"true"` en las cinco banderas para que dentro de ESTE rollout
 *    haya un solo criterio y no una mezcla — y para no cambiarle el
 *    valor exacto que el plan ya especificó para el worker.
 *
 * 2) Lista de IDs admitidos en una sola variable separada por comas:
 *    `ASISTENTE_IA_SLUGS` (`src/lib/asistente-ia.ts`,
 *    `src/app/mi-negocio/[id]/page.tsx`) hace exactamente esto para el
 *    piloto del asistente de IA — mismo parseo (split, trim, filter),
 *    mismo espíritu de "un negocio de prueba antes de abrir para
 *    todos". Acá es `WALLET_V2_CUENTAS_PILOTO`, con `cuentaId` (uuid) en
 *    vez de slug.
 *
 * Todo por defecto en OFF / lista vacía: un rollout que arranca
 * encendido por accidente no es un rollout.
 */

function envHabilitado(nombre: string): boolean {
  return process.env[nombre] === "true";
}

function listaDeIds(nombre: string): string[] {
  return (process.env[nombre] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Interruptor maestro de Wallet V2. Apagado, ninguna cuenta usa V2
 * salvo las del piloto (ver `esCuentaPilotoWalletV2`) — así el rollout
 * puede empezar con un solo negocio de prueba antes de abrirse a todos.
 */
export function walletV2Habilitado(): boolean {
  return envHabilitado("WALLET_V2_ENABLED");
}

/**
 * V2 para pases de Apple Wallet. Separado del de Google a propósito:
 * las dos plataformas se prenden en momentos distintos — Apple y Google
 * Wallet tienen APIs, límites y fallas propias, y el plan de
 * arquitectura ya las separa en `adaptador-apple.ts` / `adaptador-google.ts`.
 */
export function walletV2AppleHabilitado(): boolean {
  return envHabilitado("WALLET_V2_APPLE_ENABLED");
}

/** V2 para pases de Google Wallet. Ver `walletV2AppleHabilitado`. */
export function walletV2GoogleHabilitado(): boolean {
  return envHabilitado("WALLET_V2_GOOGLE_ENABLED");
}

/**
 * El worker de sincronización: el ciclo que corre cada 5 minutos desde
 * el cron de GitHub Actions y pega a `/api/wallet/sincronizar`.
 *
 * Aislado de las banderas de arriba: se puede tener V2 escribiendo pases
 * y el worker todavía apagado, mientras se prueba el camino de
 * generación antes de soltar la sincronización en lote.
 */
export function walletV2SyncHabilitado(): boolean {
  return process.env.WALLET_V2_SYNC_ENABLED === "true"; // default OFF
}

/**
 * Las cuentas admitidas como PILOTO: usan Wallet V2 aunque
 * `walletV2Habilitado()` esté en `false`. Es la puerta para arrancar el
 * rollout con un solo negocio antes de abrir el interruptor general.
 *
 * Guarda `cuentaId` y no `programaId` a propósito: todo `programa_lealtad`
 * cuelga de una `cuenta_id` (`src/lib/lealtad/cuenta.ts`), así que marcar
 * la cuenta como piloto ya cubre TODOS sus programas — no hace falta una
 * segunda lista por programa para el mismo negocio.
 */
export function cuentasPilotoWalletV2(): string[] {
  return listaDeIds("WALLET_V2_CUENTAS_PILOTO");
}

/** ¿Esta cuenta está en la lista de piloto? */
export function esCuentaPilotoWalletV2(cuentaId: string | null | undefined): boolean {
  if (!cuentaId) return false;
  return cuentasPilotoWalletV2().includes(cuentaId);
}

/**
 * La pregunta que de verdad importa: ¿esta cuenta usa Wallet V2?
 *
 * Sí, si el interruptor general está prendido, O si la cuenta es del
 * piloto — aunque el general siga apagado. Nunca al revés: no estar en
 * el piloto no le apaga V2 a nadie una vez que el general ya está en
 * `true`. El piloto es una puerta de ENTRADA anticipada, no una lista de
 * excepciones a un apagado general.
 *
 * Esta función NO mira plataforma: para eso se compone con
 * `walletV2AppleHabilitado()` / `walletV2GoogleHabilitado()` en el
 * lugar que dispatchea por `job.plataforma` (`worker.ts`), por ejemplo
 * `walletV2HabilitadoPara(cuentaId) && walletV2AppleHabilitado()`.
 */
export function walletV2HabilitadoPara(cuentaId: string | null | undefined): boolean {
  return walletV2Habilitado() || esCuentaPilotoWalletV2(cuentaId);
}
