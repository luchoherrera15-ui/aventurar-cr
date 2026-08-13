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

    const { data: miembros } = await db
      .from("miembros")
      .select("id, cliente_id, estado, created_at")
      .eq("programa_id", programaId);

    const ids = (miembros ?? []).map((m) => m.id as string);

    const [{ data: tx }, { data: pases }, { data: perfiles }] = await Promise.all([
      ids.length
        ? db
            .from("transacciones_puntos")
            .select("miembro_id, puntos, tipo, created_at")
            .in("miembro_id", ids)
        : Promise.resolve({ data: [] }),
      ids.length
        ? db.from("pases_wallet").select("miembro_id, plataforma").in("miembro_id", ids)
        : Promise.resolve({ data: [] }),
      db
        .from("perfiles")
        .select("id, nombre")
        .in(
          "id",
          (miembros ?? []).map((m) => m.cliente_id).filter(Boolean) as string[],
        ),
    ]);

    const nombres = new Map(
      ((perfiles ?? []) as { id: string; nombre: string | null }[]).map((p) => [
        p.id,
        (p.nombre ?? "").trim() || "Cliente",
      ]),
    );

    const hoy = hoyISOCR();
    const transacciones = (tx ?? []) as TransaccionCruda[];
    const fichas = fichasDeMiembros({
      miembros: (miembros ?? []) as MiembroCrudo[],
      transacciones,
      pases: (pases ?? []) as PaseCrudo[],
      nombres,
      meta,
      hoy,
    });

    return { fichas, resumen: resumenDeLealtad({ fichas, transacciones, hoy }) };
  },
);
