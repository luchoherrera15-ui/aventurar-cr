import { supabase } from "@/lib/supabase";
import type { PrecioTier } from "@/lib/types";

/**
 * Los rangos de precio de un lugar, ya separados por temporada — lo que
 * necesitan tanto el cotizador (rancho/[id]/reservar) como el editor del
 * dueño (negocio/[id]/precios).
 *
 * La columna `temporada` la agrega la migración 0099. Mientras esa
 * migración no esté corrida en la base, PostgREST responde 42703
 * ("column does not exist") y la consulta entera vuelve vacía — o sea
 * que TODOS los lugares se verían "a cotizar" y nadie podría reservar.
 * Por eso, ante ese error puntual se vuelve a pedir sin la columna y
 * todo se trata como 'normal', exactamente como antes de la 0099.
 */

/** Una fila de `precio_tiers`; el id solo lo usa el editor del dueño. */
export type FilaPrecioTier = PrecioTier & { id?: string };

export type TiersPorTemporada = {
  /** Los de todo el año (temporada 'normal'). */
  normales: FilaPrecioTier[];
  /** Los propios de diciembre; vacío si el lugar no cargó ninguno. */
  diciembre: FilaPrecioTier[];
  /** false = la 0099 todavía no corrió acá: no hay que escribir
   *  `temporada` al guardar ni ofrecer los rangos de diciembre. */
  soportaTemporada: boolean;
};

const COLUMNAS = "id, min_invitados, max_invitados, precio";

export async function cargarTiersPorTemporada(
  ranchoId: string,
): Promise<TiersPorTemporada> {
  const conTemporada = await supabase
    .from("precio_tiers")
    .select(`${COLUMNAS}, temporada`)
    .eq("rancho_id", ranchoId)
    .order("min_invitados", { ascending: true });

  if (!conTemporada.error) {
    const filas = (conTemporada.data ?? []) as FilaPrecioTier[];
    return {
      normales: filas.filter((t) => t.temporada !== "diciembre"),
      diciembre: filas.filter((t) => t.temporada === "diciembre"),
      soportaTemporada: true,
    };
  }

  // Cualquier otro error (red, permisos) no significa que falte la
  // columna: se devuelve vacío como siempre, sin desactivar diciembre.
  if (conTemporada.error.code !== "42703") {
    return { normales: [], diciembre: [], soportaTemporada: true };
  }

  const sinTemporada = await supabase
    .from("precio_tiers")
    .select(COLUMNAS)
    .eq("rancho_id", ranchoId)
    .order("min_invitados", { ascending: true });

  return {
    normales: (sinTemporada.data ?? []) as FilaPrecioTier[],
    diciembre: [],
    soportaTemporada: false,
  };
}
