import { after } from "next/server";
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

  // El espejo de APPLE se escribe de una: el pase se regenera desde el
  // ledger cada vez que el iPhone lo pide, así que esta columna es solo
  // para pintar el panel sin tener que sumar.
  //
  // El de Google NO se toca acá a propósito. Lo escribe
  // `refrescarPaseGoogleDeMiembro`, y solo si el PATCH entró de verdad.
  // Escribirlo también acá devolvería el bug que se acaba de cerrar en
  // `google.ts`: el panel mostrando un saldo que el Android no tiene.
  await db
    .from("pases_wallet")
    .update({ saldo_cache: saldo, actualizado_en: new Date().toISOString() })
    .eq("miembro_id", miembroId)
    .eq("plataforma", "apple");

  // ── LAS DOS PLATAFORMAS, NO SOLO APPLE ─────────────────────────
  // Acá vivía un `notificarActualizacionDePase` que arrancaba con
  // `if (pase.plataforma !== "apple") return`, y un comentario que ya
  // era mentira: «Google Wallet todavía no». Sí había —
  // `refrescarPaseGoogleDeMiembro` hace el PATCH real y
  // `avisarCambioDePase` ya tiene la rama de Google—, pero ESTE camino
  // nunca los llamaba.
  //
  // Y este camino es el de las CITAS: por acá suma puntos quien asiste
  // a su cita. O sea que al cliente de iPhone se le actualizaba la
  // tarjeta sola y al de Android se le quedaba congelada, y solo se
  // arreglaba si algún día pasaba por el mostrador manual.
  //
  // `after` y no `void`: una promesa suelta muere cuando Vercel congela
  // la función al responder. Los fallos no se propagan — los puntos ya
  // están en el ledger, y un push que no sale no puede tumbar la
  // operación que lo originó.
  after(async () => {
    try {
      const { avisarCambioDePase } = await import("@/lib/wallet/servicio");
      await avisarCambioDePase(miembroId);
    } catch (e) {
      console.warn("[wallet] No salió el aviso de pase actualizado:", e);
    }
  });
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
