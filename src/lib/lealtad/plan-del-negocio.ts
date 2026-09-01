import { createAdminClient } from "@/lib/supabase/admin";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * EL PAQUETE EFECTIVO DE UN NEGOCIO.
 *
 * Mismo patrón que ya usan `equipoLleno` (equipo-actions.ts) y el
 * chequeo de tipo de `crear-actions.ts`: se lee con la llave de
 * servicio porque el paquete es dato de producto y no de la fila de
 * nadie —depender de la sesión ataría el tope a que la RLS de `cuentas`
 * (0134) esté corrida—, y `contextoDeCuenta` hace ganar a la cuenta
 * sobre el respaldo del rancho (la transición de la 0134, en dos
 * tiempos).
 *
 * ------------------------------------------------------------------
 * POR QUÉ VIVE ACÁ Y NO EN `marketing-actions.ts`
 * ------------------------------------------------------------------
 * Nació ahí como función privada. Cuando las campañas automáticas
 * (0226) necesitaron el mismo dato, importarla no se podía: ese archivo
 * es `"use server"` y ahí TODO lo exportado se vuelve un server action
 * —expuesto por HTTP y sin los argumentos que esta función recibe—.
 *
 * Ahora la usan tres: el botón manual de marketing, el CRUD de campañas
 * y el barrido horario que las manda. Los tres tienen que leer el
 * paquete igual, porque los tres comparan contra el mismo cupo.
 */
export async function planDelNegocio(db: Admin, ranchoId: string): Promise<string | null> {
  const { data: rancho } = await db
    .from("ranchos")
    .select("plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  const { data: cuenta } = await db
    .from("cuentas")
    .select("id")
    .eq("rancho_id", ranchoId)
    .maybeSingle();
  const { plan } = await contextoDeCuenta(
    db,
    cuenta?.id ? { cuenta_id: cuenta.id as string } : {},
    { planRancho: (rancho?.plan_lealtad as string | null) ?? null },
  );
  return plan;
}
