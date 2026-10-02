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
 * llega a los CLIENTES finales (sellos, bienvenida) lo decide
 * `losCorreosLosMandaFoorkie` (`foorkie-marca.ts`), con la MISMA marca.
 *
 * ── QUÉ ES «DE FOORKIE»: UNA MARCA EXPLÍCITA, NO EL VÍNCULO ─────────
 * Estar vinculado no alcanza. Hay negocios de Bookea con su tarjeta
 * conectada a un local de Foorkie —Pura Matcha— que siguen siendo de
 * Bookea en todo: su pase, sus correos y los de su dueño no se tocan
 * (regla dura de Luis). Por eso un negocio es de Foorkie SOLO si algún
 * local de Foorkie lo tiene vinculado (`bookea_rancho_id`) Y marcado con
 * `lealtad_por_foorkie = true`, una columna que pone Foorkie y que nace
 * en false. Bookea solo la lee.
 *
 * ── SI NO SE PUEDE SABER, BOOKEA DE SIEMPRE ─────────────────────────
 * Si la consulta falla —la base no contesta, o la columna todavía no
 * existe— la respuesta es «no es de Foorkie»: el correo sale como salió
 * siempre. Callar el aviso de un negocio de Bookea («no pudimos cobrar»)
 * por una consulta caída cuesta mucho más que un correo con la marca de
 * Bookea en un buzón de Foorkie.
 */

/**
 * La marca que lo decide: `foorkie_restaurantes.lealtad_por_foorkie`
 * (boolean not null default false, la escribe Foorkie). La comparten las
 * dos guardias: esta (correos al dueño) y la de `foorkie-marca.ts` (el
 * pase, los mensajes al Wallet y los correos al cliente).
 */
export const COLUMNA_LEALTAD_POR_FOORKIE = "lealtad_por_foorkie";

type Db = Pick<SupabaseClient, "from">;

/** Los negocios de esta lista que son de Foorkie (vinculados Y marcados). Ante un error, ninguno (ver arriba). */
export async function negociosDeFoorkie(db: Db, ranchoIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(ranchoIds.filter((id) => typeof id === "string" && id !== ""))];
  if (ids.length === 0) return new Set();
  try {
    const { data, error } = await db
      .from("foorkie_restaurantes")
      .select("bookea_rancho_id")
      .in("bookea_rancho_id", ids)
      .eq(COLUMNA_LEALTAD_POR_FOORKIE, true);
    if (error) throw new Error(error.message);
    return new Set(
      ((data ?? []) as { bookea_rancho_id: unknown }[])
        .map((f) => f.bookea_rancho_id)
        .filter((id): id is string => typeof id === "string" && ids.includes(id)),
    );
  } catch (e) {
    console.warn(
      "[foorkie] No se pudo saber si el negocio es de Foorkie; se le escribe al dueño como siempre:",
      e instanceof Error ? e.message : e,
    );
    return new Set();
  }
}

/**
 * ¿Este negocio es de Foorkie (vinculado Y marcado)? Si es así, Bookea no
 * le manda correos al dueño. Si no, o si no se pudo saber, el correo sale
 * como siempre. Usarla justo antes de `enviarCorreo`.
 */
export async function esNegocioDeFoorkie(db: Db, ranchoId: string | null | undefined): Promise<boolean> {
  if (!ranchoId) return false;
  return (await negociosDeFoorkie(db, [ranchoId])).has(ranchoId);
}
