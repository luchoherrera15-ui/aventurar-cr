import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * De qué CUENTA es un programa de lealtad, y qué plan le toca.
 *
 * Existe por la transición de la 0134: el módulo dejó de colgar de
 * `ranchos` y pasó a colgar de `cuentas`, pero el cambio se hace en
 * dos tiempos —expandir y después contraer— para no romper nada en el
 * medio.
 *
 * ------------------------------------------------------------------
 * POR QUÉ TODO ACÁ ES TOLERANTE A QUE LA MIGRACIÓN NO ESTÉ CORRIDA
 * ------------------------------------------------------------------
 * Las migraciones las pega el dueño a mano, así que entre que este
 * código se despliega y que la 0134 se corre hay una ventana —horas o
 * días— en la que el servidor tiene código nuevo y base vieja.
 *
 * En esa ventana, `cuentas` no existe y `programa_lealtad.cuenta_id`
 * tampoco. Si el código diera eso por sentado, durante esa ventana
 * NINGÚN cliente podría agregar su tarjeta al teléfono. Por eso:
 *
 *   · el programa se lee con `select *` y no con una lista de
 *     columnas — pedir `cuenta_id` explícitamente hace fallar la
 *     consulta ENTERA cuando la columna no existe, y el síntoma es
 *     "este negocio no tiene programa de lealtad", que manda a mirar
 *     justo donde no está el problema;
 *
 *   · si falta la cuenta, el plan se lee del rancho, que es de donde
 *     salía antes.
 *
 * Cuando la 0134 esté corrida en todos lados y el código no lea más
 * `rancho_id`, el respaldo se puede borrar. Hasta entonces, no.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * El plan que manda.
 *
 * La cuenta gana SIEMPRE que tenga uno: es la fuente de verdad desde
 * la 0134. El rancho es el respaldo de la transición.
 *
 * Ojo con el orden: no es `?? `a secas sobre el valor de la cuenta,
 * porque una cuenta que existe pero todavía no tiene plan asignado
 * debe caer al del rancho, no quedarse sin plan (que dejaría al
 * negocio sin topes ni capacidades de un momento a otro).
 */
export function planEfectivo(fuentes: {
  planCuenta?: string | null;
  planRancho?: string | null;
}): string | null {
  return fuentes.planCuenta ?? fuentes.planRancho ?? null;
}

/** Lo que hace falta saber del dueño de un programa. */
export type ContextoCuenta = {
  /** null = la 0134 todavía no corrió, o el programa no se migró. */
  cuentaId: string | null;
  /** El plan efectivo, ya resuelto. */
  plan: string | null;
};

/**
 * Resuelve la cuenta y el plan de un programa ya leído.
 *
 * `programa` se recibe como fila cruda a propósito: quien llama lo
 * consulta con `select *`, así que puede traer `cuenta_id` o no
 * traerlo, y esta función no debe obligar a un tipo que la base
 * todavía no garantiza.
 */
export async function contextoDeCuenta(
  db: Admin,
  programa: Record<string, unknown>,
  respaldo: { planRancho?: string | null } = {},
): Promise<ContextoCuenta> {
  const cuentaId =
    typeof programa.cuenta_id === "string" && programa.cuenta_id ? programa.cuenta_id : null;

  if (!cuentaId) {
    return { cuentaId: null, plan: planEfectivo({ planRancho: respaldo.planRancho }) };
  }

  // Sin `.single()`: si la tabla no existe todavía, `data` viene null y
  // se cae al respaldo en vez de reventar.
  const { data: cuenta } = await db
    .from("cuentas")
    .select("plan")
    .eq("id", cuentaId)
    .maybeSingle();

  return {
    cuentaId,
    plan: planEfectivo({
      planCuenta: (cuenta?.plan as string | null) ?? null,
      planRancho: respaldo.planRancho,
    }),
  };
}

/**
 * El programa ACTIVO de un negocio, buscando por cuenta y cayendo al
 * rancho.
 *
 * Devuelve la fila cruda (`select *`) por lo dicho arriba: una lista
 * de columnas explícita se rompe entera en cuanto la base va una
 * migración atrás.
 */
export async function programaActivoDe(
  db: Admin,
  quien: { cuentaId?: string | null; ranchoId?: string | null },
): Promise<Record<string, unknown> | null> {
  if (quien.cuentaId) {
    const { data } = await db
      .from("programa_lealtad")
      .select("*")
      .eq("cuenta_id", quien.cuentaId)
      .eq("activo", true)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }

  if (!quien.ranchoId) return null;

  const { data } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", quien.ranchoId)
    .eq("activo", true)
    .maybeSingle();

  return (data as Record<string, unknown> | null) ?? null;
}
