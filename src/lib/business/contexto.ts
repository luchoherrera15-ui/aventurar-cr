import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolverModulos,
  tipoNegocioEfectivo,
  type ModuloId,
  type TipoNegocioId,
} from "./modulos";

/**
 * El contexto de Bookea Business de un negocio: qué tipo es y qué
 * módulos tiene encendidos. Es lo que arma el menú lateral, el tablero
 * y las secciones de configuración.
 *
 * Tolera que la 0108 todavía no se haya pegado en la base: las
 * migraciones las corre el dueño a mano en el SQL Editor, así que el
 * código puede llegar a producción antes que el esquema. Sin la tabla,
 * el negocio funciona con los defaults de su tipo — o sea, exactamente
 * como funcionaba antes — y el aviso se muestra dentro de la sección de
 * Módulos, sin tumbar el resto del panel (mismo patrón que giftcards).
 */
export type ContextoNegocio = {
  tipo: TipoNegocioId;
  /** ¿El tipo lo eligió el dueño, o se dedujo de su categoría? */
  tipoExplicito: boolean;
  modulos: Set<ModuloId>;
  /** Las diferencias guardadas contra el default (modulo → activo). */
  overrides: Record<string, boolean>;
  /** El mensaje de la base si `modulos_negocio` no se pudo leer. */
  errorModulos: string | null;
};

/** Las columnas de `ranchos` que el contexto necesita. */
export type NegocioParaContexto = {
  id: string;
  vertical?: string | null;
  categoria?: string | null;
  /** Ausente mientras la 0108 no haya corrido — se deriva y ya. */
  tipo_negocio?: string | null;
};

export async function cargarContextoNegocio(
  supabase: SupabaseClient,
  negocio: NegocioParaContexto,
): Promise<ContextoNegocio> {
  const { data, error } = await supabase
    .from("modulos_negocio")
    .select("modulo, activo")
    .eq("rancho_id", negocio.id);

  const overrides: Record<string, boolean> = {};
  for (const fila of (data ?? []) as { modulo: string; activo: boolean }[]) {
    overrides[fila.modulo] = fila.activo;
  }

  return contextoDesdeDatos(negocio, overrides, error?.message ?? null);
}

/**
 * La parte pura: los mismos datos ya cargados → el contexto. Aparte de
 * `cargarContextoNegocio` para que la pantalla que ya trae las filas en
 * su tanda grande no tenga que hacer una consulta de más.
 */
export function contextoDesdeDatos(
  negocio: NegocioParaContexto,
  overrides: Record<string, boolean>,
  errorModulos: string | null = null,
): ContextoNegocio {
  const guardado = negocio.tipo_negocio ?? null;
  const tipo = tipoNegocioEfectivo(negocio.vertical, negocio.categoria, guardado);

  return {
    tipo,
    tipoExplicito: !!guardado,
    modulos: resolverModulos({ tipo, overrides }),
    overrides,
    errorModulos,
  };
}
