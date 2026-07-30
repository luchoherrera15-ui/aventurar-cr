import { createAdminClient } from "@/lib/supabase/admin";

/**
 * FASE 2 de Lealtad — el motor de puntos.
 *
 * SOLO SERVIDOR: escribe en el ledger (transacciones_puntos) con la
 * service key — la tabla no tiene política de escritura para clientes
 * a propósito. El saldo de un miembro SIEMPRE es la suma de sus
 * transacciones; pases_wallet.saldo_cache es un espejo para pintar el
 * pase rápido y se refresca acá después de cada movimiento.
 *
 * Idempotencia: el índice único (miembro_id, referencia) del ledger
 * garantiza que el mismo evento (ej. la misma cita cumplida) no
 * otorgue puntos dos veces — el segundo intento devuelve
 * `{ otorgado: false, motivo: "ya-otorgado" }` sin romper nada.
 */

export type ResultadoOtorgar =
  | { ok: true; otorgado: true; saldo: number }
  | { ok: true; otorgado: false; motivo: "ya-otorgado"; saldo: number }
  | { ok: false; error: string };

const SIN_SERVICE_KEY =
  "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor — el ledger solo se escribe con la service key.";

/**
 * Suma el ledger del miembro — la única fuente de verdad del saldo.
 * Devuelve null si no se pudo consultar (nunca inventa un 0).
 */
export async function consultarSaldo(miembroId: string): Promise<number | null> {
  const db = createAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("transacciones_puntos")
    .select("puntos")
    .eq("miembro_id", miembroId);
  if (error || !data) return null;

  return data.reduce((suma: number, fila: { puntos: number }) => suma + fila.puntos, 0);
}

/**
 * Refresca el espejo del saldo en los pases de Wallet del miembro y
 * avisa a las plataformas que el pase cambió. Nunca lanza: si el
 * espejo falla, el ledger ya quedó bien y es lo que manda.
 */
async function refrescarPases(miembroId: string, saldo: number): Promise<void> {
  const db = createAdminClient();
  if (!db) return;

  const { data } = await db
    .from("pases_wallet")
    .update({ saldo_cache: saldo, actualizado_en: new Date().toISOString() })
    .eq("miembro_id", miembroId)
    .select("plataforma, serial_number");

  for (const pase of data ?? []) {
    notificarActualizacionDePase(pase as { plataforma: string; serial_number: string });
  }
}

/**
 * Stub del push de actualización del pase (Apple APNs / Google Wallet
 * API): las credenciales todavía no están, así que por ahora solo
 * queda el registro. Cuando lleguen, esto se cambia por el push real
 * sin tocar al resto del motor.
 */
function notificarActualizacionDePase(pase: { plataforma: string; serial_number: string }) {
  console.log(
    `[lealtad] Pase ${pase.plataforma} ${pase.serial_number} desactualizado — push pendiente de credenciales.`,
  );
}

/**
 * Registra un movimiento de puntos en el ledger.
 *
 * - `puntos` con signo: ganado > 0, canjeado < 0, ajuste ≠ 0 (los
 *   checks de la base también lo validan).
 * - `referencia` identifica el evento (ej. "cita:<uuid>") y hace la
 *   operación idempotente; sin referencia el movimiento siempre entra
 *   (ajustes manuales).
 */
export async function otorgarPuntos({
  miembroId,
  puntos,
  motivo,
  referencia,
  tipo = "ganado",
}: {
  miembroId: string;
  puntos: number;
  motivo: string;
  referencia?: string;
  tipo?: "ganado" | "canjeado" | "ajuste";
}): Promise<ResultadoOtorgar> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: SIN_SERVICE_KEY };

  if (!Number.isInteger(puntos) || puntos === 0) {
    return { ok: false, error: "Los puntos tienen que ser un entero distinto de cero." };
  }
  if (tipo === "ganado" && puntos < 0) {
    return { ok: false, error: "Un movimiento 'ganado' no puede restar puntos." };
  }
  if (tipo === "canjeado" && puntos > 0) {
    return { ok: false, error: "Un canje tiene que restar puntos." };
  }

  const { error } = await db.from("transacciones_puntos").insert({
    miembro_id: miembroId,
    tipo,
    puntos,
    motivo: motivo.slice(0, 200),
    referencia: referencia ?? null,
  });

  if (error) {
    // 23505 = el índice único (miembro_id, referencia): este evento ya
    // otorgó sus puntos antes — no es un error, es la idempotencia.
    if (error.code === "23505") {
      const saldo = (await consultarSaldo(miembroId)) ?? 0;
      return { ok: true, otorgado: false, motivo: "ya-otorgado", saldo };
    }
    return { ok: false, error: "No se pudo registrar el movimiento: " + error.message };
  }

  const saldo = (await consultarSaldo(miembroId)) ?? puntos;
  await refrescarPases(miembroId, saldo);
  return { ok: true, otorgado: true, saldo };
}
