import type { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, estadoDelLimite, type EstadoLimite } from "./planes";

/**
 * EL CUPO DE NOTIFICACIONES PROMOCIONALES (0183).
 *
 * Separado de `cupo.ts` a propósito: aquel archivo es específicamente
 * el cupo de CLIENTES (vía RPC de `personasActivasDe`), y mezclar acá
 * un tema distinto —cuántos ENVÍOS lleva el mes— confundiría dos
 * mecanismos que no comparten ni tabla ni pregunta.
 *
 * ------------------------------------------------------------------
 * POR QUÉ SE CUENTA POR rancho_id Y NO POR programa_id
 * ------------------------------------------------------------------
 * `clientesActivos` de este mismo catálogo ya vivió este error una vez:
 * contado por `programa_id`, cada tarjeta nueva regalaba un cupo
 * entero (un paquete de 200 con dos tarjetas afiliaba 400 — ver la
 * cabecera de `cupo.ts`). El cupo de notificaciones aprende esa lección
 * desde el día uno: un negocio de Impulso con 5 tarjetas mandaría
 * 5×20=100 mensajes al mes si se contara por tarjeta, no 20. El cupo es
 * del NEGOCIO — todas sus tarjetas comparten el mismo cupo mensual.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Costa Rica es UTC-6 todo el año (no hay horario de verano), así que
 * el corrimiento es fijo. Se hace a mano, mismo idioma que `enHoraCR`
 * de `admin/(dashboard)/ia/gasto-panel.tsx`, y no con una librería de
 * zonas horarias nueva para un solo cálculo.
 *
 * Devuelve el instante UTC que corresponde a las 00:00 del día 1 del
 * mes, EN HORA DE COSTA RICA — o sea 06:00 UTC de ese día 1.
 */
function inicioDeMesEnCR(ahora: Date = new Date()): string {
  const paredCR = new Date(ahora.getTime() - 6 * 3_600_000);
  const inicioParedCR = Date.UTC(paredCR.getUTCFullYear(), paredCR.getUTCMonth(), 1, 0, 0, 0);
  return new Date(inicioParedCR + 6 * 3_600_000).toISOString();
}

/**
 * Cuándo se abre el próximo mes, en hora de Costa Rica — para el aviso
 * de "el cupo vuelve a abrirse el [fecha]" que ve el dueño al toparse.
 * Mismo cálculo que `inicioDeMesEnCR`, un mes adelante.
 */
export function inicioProximoMesEnCR(ahora: Date = new Date()): Date {
  const paredCR = new Date(ahora.getTime() - 6 * 3_600_000);
  const inicioParedCR = Date.UTC(paredCR.getUTCFullYear(), paredCR.getUTCMonth() + 1, 1, 0, 0, 0);
  return new Date(inicioParedCR + 6 * 3_600_000);
}

/**
 * Cómo va el negocio contra su cupo de notificaciones de ESTE mes
 * calendario (hora de Costa Rica).
 *
 * FAIL-OPEN si la consulta falla (tabla/columna todavía no migrada,
 * error de red): `count` queda en `undefined` y se lee como 0 usados.
 * Mismo criterio que ya sigue el resto del módulo (`equipo-actions.ts`,
 * `crear-actions.ts` leen `plan_lealtad` sin frenar en error, y el
 * comentario de cabecera de `cupo.ts` lo dice explícito: "un pase que
 * no se emite es peor que un cupo contado a la antigua por un rato").
 * Bloquear TODOS los envíos por una migración pendiente de pegar sería
 * peor que dejar pasar unos cuantos de más en esa ventana.
 */
export async function estadoCupoNotificaciones(
  db: Admin,
  ranchoId: string,
  plan: string | null,
): Promise<EstadoLimite> {
  const limite = definicionDe(plan)?.limites.notificacionesMes ?? null;
  if (limite === null) return estadoDelLimite(plan, "notificacionesMes", 0);

  const { count } = await db
    .from("notificaciones_promocionales")
    .select("*", { count: "exact", head: true })
    .eq("rancho_id", ranchoId)
    .gte("enviado_en", inicioDeMesEnCR());

  return estadoDelLimite(plan, "notificacionesMes", count ?? 0);
}

export type ReservaCupo = {
  reservado: boolean;
  /** La fila que se insertó, para poder borrarla si el envío falla. `null` si no se reservó nada. */
  id: string | null;
  /** El tope que se comparó — `null` si el plan no tiene ninguno declarado. */
  limite: number | null;
};

/**
 * RESERVA el cupo de forma atómica, ANTES de mandar el mensaje —
 * contar y anotar en dos pasos separados por el envío entero (que tarda
 * segundos reales) deja una ventana donde dos pedidos casi simultáneos
 * pasan el chequeo los dos. La atomicidad la da la función de Postgres
 * `notificacion_promocional_reservar` (0183, `pg_advisory_xact_lock` por
 * `rancho_id`), no esta función de TypeScript.
 *
 * Si el envío después falla, quien llama tiene que deshacer la reserva
 * con `liberarCupoNotificacion(db, resultado.id)` — un intento fallido
 * no le cobra cupo a un mensaje que nunca llegó a ningún lado.
 *
 * Sin plan resuelto (`definicionDe` devuelve null) no hay ningún tope
 * que hacer cumplir — misma doctrina que el resto del catálogo ("sin
 * definición no hay tope declarado"): se deja pasar sin tocar la tabla.
 *
 * FAIL-OPEN si la RPC falla (migración pendiente de pegar, error de
 * red): mismo criterio que `estadoCupoNotificaciones` — un pase que no
 * se manda es peor que un cupo contado de más por un rato.
 */
export async function reservarCupoNotificacion(
  db: Admin,
  ranchoId: string,
  programaId: string,
  plan: string | null,
): Promise<ReservaCupo> {
  const limite = definicionDe(plan)?.limites.notificacionesMes ?? null;
  if (limite === null) return { reservado: true, id: null, limite: null };

  const { data, error } = await db.rpc("notificacion_promocional_reservar", {
    p_rancho_id: ranchoId,
    p_programa_id: programaId,
    p_limite: limite,
    p_desde: inicioDeMesEnCR(),
  });
  if (error) {
    console.error("[cupo-notificaciones] no se pudo reservar, se deja pasar:", error.message);
    return { reservado: true, id: null, limite };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    reservado: (fila as { reservado?: boolean } | null)?.reservado === true,
    id: (fila as { id?: string | null } | null)?.id ?? null,
    limite,
  };
}

/** Deshace una reserva cuando el envío real falló. Sin id, no hay nada que borrar. */
export async function liberarCupoNotificacion(db: Admin, id: string | null): Promise<void> {
  if (!id) return;
  const { error } = await db.from("notificaciones_promocionales").delete().eq("id", id);
  if (error) {
    console.error("[cupo-notificaciones] no se pudo liberar la reserva:", error.message);
  }
}
