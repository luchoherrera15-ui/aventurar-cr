import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fichasDeMiembros,
  resumenDeLealtad,
  type FichaMiembro,
  type MiembroCrudo,
  type PaseCrudo,
  type ResumenLealtad,
  type TransaccionCruda,
} from "@/lib/lealtad/tablero";
import { hoyISOCR } from "@/lib/fechas";
import { identidadesDeMiembros, miembrosConIdentidad } from "@/lib/lealtad/identidades-db";

/**
 * LO QUE DICE EL LEDGER sobre un programa, UNA sola vez por visita.
 *
 * Vivía adentro de <LealtadEstado>. Salió acá cuando el tablero de
 * Inicio empezó a mostrar datos de verdad: las dos secciones se pintan
 * en el MISMO render del servidor (el shell monta todo y esconde lo que
 * no está activo), así que cada una haciendo su consulta significaba
 * traer dos veces los miembros, dos veces el ledger y dos veces los
 * pases del mismo negocio.
 *
 * `cache()` de React lo resuelve por identidad de argumentos: la
 * primera llamada consulta y las demás del mismo request reciben lo ya
 * traído. Por eso el cliente de servicio se crea ACÁ ADENTRO y no se
 * recibe por parámetro — `createAdminClient()` devuelve una instancia
 * nueva cada vez, y como argumento haría fallar todas las
 * coincidencias.
 *
 * Corre con la llave de servicio porque `transacciones_puntos` no le da
 * lectura al negocio (0060): el saldo es del cliente, y el dueño lo ve
 * a través de estas pantallas, no consultando la tabla.
 */

export type DatosLealtad = {
  /** Un renglón por miembro, ya ordenado por quién necesita atención. */
  fichas: FichaMiembro[];
  resumen: ResumenLealtad;
};

export const cargarLealtad = cache(
  async (programaId: string | null, meta: number | null): Promise<DatosLealtad | null> => {
    const db = createAdminClient();
    if (!db || !programaId) return null;

    const miembros = await miembrosConIdentidad(db, { programaId });
    const ids = miembros.map((m) => m.id);

    // El negocio de la tarjeta: hace falta para la ficha de CRM
    // (`clientes_negocio` se guarda por rancho). Si no se resuelve, la
    // identidad se contesta igual con `personas` y `perfiles` — la ficha
    // aporta, pero no manda.
    const { data: programa } = await db
      .from("programa_lealtad")
      .select("rancho_id")
      .eq("id", programaId)
      .maybeSingle();
    const ranchoId = (programa?.rancho_id as string | null) ?? null;

    const [{ data: tx }, { data: pases }, identidades] = await Promise.all([
      ids.length
        ? db
            .from("transacciones_puntos")
            .select("miembro_id, puntos, tipo, created_at")
            .in("miembro_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from("pases_wallet").select("miembro_id, plataforma").in("miembro_id", ids)
        : Promise.resolve({ data: [] }),
      identidadesDeMiembros(db, miembros, ranchoId),
    ]);

    const hoy = hoyISOCR();
    const transacciones = (tx ?? []) as TransaccionCruda[];
    const fichas = fichasDeMiembros({
      miembros: miembros as MiembroCrudo[],
      transacciones,
      pases: (pases ?? []) as PaseCrudo[],
      identidades,
      meta,
      hoy,
    });

    return { fichas, resumen: resumenDeLealtad({ fichas, transacciones, hoy }) };
  },
);
