import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * CUÁNTOS CLIENTES TIENE CADA NEGOCIO, para la lista del admin.
 *
 * ------------------------------------------------------------------
 * QUÉ ESTABA MAL
 * ------------------------------------------------------------------
 * La página traía la tabla `miembros` ENTERA en cada render, solo para
 * contar:
 *
 *     admin.from("miembros").select("programa_id")
 *
 * Tres problemas, y el tercero es el que duele:
 *
 *   1. no escala — con 200 negocios y sus clientes son decenas de miles
 *      de filas por carga de página, y el problema EMPEORA con el éxito
 *      del producto, no con la cantidad de negocios;
 *   2. contaba filas por tarjeta, no personas por cuenta, o sea con el
 *      criterio que la 0142 vino a arreglar: el panel decía un número y
 *      la puerta de Wallet usaba otro;
 *   3. y sobre todo, **el número ya venía mal**: PostgREST corta en
 *      `max-rows` (1.000 por defecto). Pasadas las mil membresías de
 *      toda la plataforma, la consulta devolvía mil filas sin avisar y
 *      los negocios del final aparecían en cero. Un cero que parece un
 *      dato es peor que un guion.
 *
 * ------------------------------------------------------------------
 * LO QUE HACE AHORA
 * ------------------------------------------------------------------
 * Le pregunta a `clientes_activos_por_negocio()` (0173), que contesta
 * todos los negocios de una y con el MISMO criterio que las funciones
 * de la 0142 (personas distintas, solo membresías activas, el mayor
 * entre el conteo por cuenta y el conteo por negocio).
 *
 * Y si la 0173 todavía no está pegada —las migraciones las pega el
 * dueño a mano, así que siempre hay una ventana con código nuevo y base
 * vieja— cae a un conteo a mano que sí pagina, sí deduplica por persona
 * y sí filtra por estado. Se degrada al criterio correcto contado
 * despacio, no al criterio viejo.
 *
 * Módulo neutral (sin "use client" ni "use server"): lo importa la
 * página del servidor y nada más.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type ConteoClientes = {
  /** rancho_id → clientes activos. Un negocio ausente tiene cero. */
  porNegocio: Map<string, number>;
  /**
   * De dónde salió el número:
   *   "rpc"    — la función de la 0173 (una consulta, exacto);
   *   "a_mano" — la 0173 no está pegada todavía.
   */
  fuente: "rpc" | "a_mano";
  /**
   * true = el conteo a mano se topó con el techo de páginas y hay
   * negocios cuyo número está por debajo del real. La pantalla LO DICE:
   * un número corto en una lista que decide cambios de plan es peor que
   * ningún número.
   */
  truncado: boolean;
};

/** Filas por página al contar a mano (el `max-rows` de PostgREST). */
const PAGINA = 1000;
/** Techo del conteo a mano. Más que esto pide la 0173, no más páginas. */
const MAX_PAGINAS = 10;

export async function clientesPorNegocio(
  db: Admin,
  programas: readonly { id: string; rancho_id: string | null }[],
): Promise<ConteoClientes> {
  const porRpc = await viaRpc(db);
  if (porRpc) return { porNegocio: porRpc, fuente: "rpc", truncado: false };
  return contarAMano(db, programas);
}

/**
 * La función de la 0173. Nunca lanza: si no existe todavía devuelve
 * null y quien llama cuenta a mano. Una pantalla de admin que revienta
 * porque falta una migración es una pantalla que nadie puede usar para
 * arreglar nada.
 */
async function viaRpc(db: Admin): Promise<Map<string, number> | null> {
  try {
    const { data, error } = await db.rpc("clientes_activos_por_negocio");
    if (error || !Array.isArray(data)) return null;
    const mapa = new Map<string, number>();
    for (const fila of data as { rancho_id: string | null; personas: number | null }[]) {
      if (!fila.rancho_id) continue;
      mapa.set(fila.rancho_id, Number(fila.personas ?? 0));
    }
    return mapa;
  } catch {
    return null;
  }
}

/**
 * El respaldo mientras la 0173 no esté pegada.
 *
 * `select("*")` y el filtro EN CÓDIGO, no `.eq("estado", "activa")`:
 * `persona_id` es de la 0138 y `estado` puede faltar en una base vieja,
 * y una lista de columnas explícita hace fallar la consulta ENTERA
 * cuando una no existe. El síntoma sería «todos los negocios en cero»,
 * que manda a mirar justo donde no está el problema.
 */
async function contarAMano(
  db: Admin,
  programas: readonly { id: string; rancho_id: string | null }[],
): Promise<ConteoClientes> {
  const ranchoDePrograma = new Map<string, string>();
  for (const p of programas) {
    if (p.rancho_id) ranchoDePrograma.set(p.id, p.rancho_id);
  }

  // Personas distintas por negocio, para no contar dos veces a la misma
  // señora que tiene dos tarjetas del mismo local.
  const personas = new Map<string, Set<string>>();
  let truncado = false;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const desde = pagina * PAGINA;
    const { data, error } = await db
      .from("miembros")
      .select("*")
      .range(desde, desde + PAGINA - 1);

    if (error) break;

    const filas = (data ?? []) as Record<string, unknown>[];
    for (const m of filas) {
      const programaId = typeof m.programa_id === "string" ? m.programa_id : null;
      const rancho = programaId ? ranchoDePrograma.get(programaId) : undefined;
      if (!rancho) continue;
      // Si la columna `estado` no existe, se cuenta la fila: quedarse
      // corto sería regalar cupo.
      if (typeof m.estado === "string" && m.estado !== "activa") continue;
      const persona =
        (typeof m.persona_id === "string" && m.persona_id) ||
        (typeof m.id === "string" ? m.id : null);
      if (!persona) continue;
      const set = personas.get(rancho) ?? new Set<string>();
      set.add(persona);
      personas.set(rancho, set);
    }

    // Una página corta significa que ya no hay más.
    if (filas.length < PAGINA) {
      return { porNegocio: totales(personas), fuente: "a_mano", truncado: false };
    }
    truncado = pagina === MAX_PAGINAS - 1;
  }

  return { porNegocio: totales(personas), fuente: "a_mano", truncado };
}

function totales(personas: Map<string, Set<string>>): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const [rancho, set] of personas) mapa.set(rancho, set.size);
  return mapa;
}
