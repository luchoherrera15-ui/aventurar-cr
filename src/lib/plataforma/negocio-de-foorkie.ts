import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ════════════════════════════════════════════════════════════════════
 *  ¿ESTE NEGOCIO ES DE FOORKIE? — entonces Bookea no le escribe al dueño
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 oct 2026): Foorkie vende la lealtad con su marca
 * («Foorkie Lealtad») y Bookea queda como motor INVISIBLE. El restaurante
 * nunca entra a Bookea: todo lo maneja desde el panel de Foorkie. Un
 * correo de Bookea en su buzón —«tu prueba se termina», «no pudimos
 * cobrar tu suscripción»— le presenta una marca que no contrató y lo
 * manda a un panel al que no tiene por qué entrar.
 *
 * ── QUÉ CORTA ESTO, Y QUÉ NO ────────────────────────────────────────
 * Solo el ENVÍO de los correos al dueño. La prueba igual vence, el plan
 * igual se aplica, el programa igual se pausa o se reanuda y el cupo se
 * cuenta igual: las reglas del negocio no miran esta función. Lo que le
 * llega a los CLIENTES finales (sellos, bienvenida) tampoco pasa por acá.
 *
 * ── QUÉ ES «DE FOORKIE» ─────────────────────────────────────────────
 * El negocio que algún local de Foorkie tiene vinculado:
 * `foorkie_restaurantes.bookea_rancho_id` (lo escribe Foorkie; Bookea
 * solo lo lee, como en `vinculoConFoorkie`).
 *
 * ── SI NO SE PUEDE SABER, NO SE ESCRIBE ─────────────────────────────
 * Si la consulta falla, se responde «sí, es de Foorkie». Es el mismo
 * criterio que ya siguen los dos avisos que usan esto: cuando no pueden
 * leer el negocio o el correo del dueño, no mandan nada. Un aviso de
 * cortesía que no sale se nota menos que la marca equivocada en el
 * buzón de un restaurante que nunca supo que Bookea existía.
 */

type Db = Pick<SupabaseClient, "from">;

/** Los negocios de esta lista que son de Foorkie. Ante un error, todos (ver arriba). */
export async function negociosDeFoorkie(db: Db, ranchoIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(ranchoIds.filter((id) => typeof id === "string" && id !== ""))];
  if (ids.length === 0) return new Set();
  try {
    const { data, error } = await db
      .from("foorkie_restaurantes")
      .select("bookea_rancho_id")
      .in("bookea_rancho_id", ids);
    if (error) throw new Error(error.message);
    return new Set(
      ((data ?? []) as { bookea_rancho_id: unknown }[])
        .map((f) => f.bookea_rancho_id)
        .filter((id): id is string => typeof id === "string" && ids.includes(id)),
    );
  } catch (e) {
    console.warn(
      "[foorkie] No se pudo saber si el negocio es de Foorkie; por las dudas no se le escribe al dueño:",
      e instanceof Error ? e.message : e,
    );
    return new Set(ids);
  }
}

/**
 * ¿Este negocio es de Foorkie? Si es así (o no se pudo saber), Bookea
 * no le manda correos al dueño. Usarla justo antes de `enviarCorreo`.
 */
export async function esNegocioDeFoorkie(db: Db, ranchoId: string | null | undefined): Promise<boolean> {
  if (!ranchoId) return false;
  return (await negociosDeFoorkie(db, [ranchoId])).has(ranchoId);
}
