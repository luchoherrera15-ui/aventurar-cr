import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ════════════════════════════════════════════════════════════════════
 *  VARIAS TARJETAS EN UN LOCAL DE FOORKIE
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido de Luis (11 nov 2026): «Tostado Café Bistró» necesita TRES
 * tarjetas en el mismo local —una de puntos y dos de socio, una por cada
 * equipo deportivo que patrocina—. Hasta acá un local de Foorkie tenía
 * UNA tarjeta (`foorkie_restaurantes.bookea_programa_id`) y todo el motor
 * preguntaba «¿qué local de Foorkie tiene vinculada esta tarjeta?» en esa
 * columna. Una segunda tarjeta del mismo negocio no aparecía en ningún
 * lado: el pase salía con la marca de Bookea, la caja la rechazaba
 * (`no_vinculado`) y sus correos los mandaba Bookea.
 *
 * ── DÓNDE VIVEN LAS DEMÁS ───────────────────────────────────────────
 * La principal sigue en la columna de siempre. Las otras son filas de
 * `foorkie_lealtad_tarjetas` (tabla de Foorkie: nombre, slug para su
 * página de alta, código para unirse) y Foorkie las expone, con los datos
 * de su local, en la vista `foorkie_lealtad_vinculos`: una fila por
 * tarjeta, `principal = true` para las de la columna y `false` para las
 * de la tabla. Bookea solo LEE; nunca escribe tablas de Foorkie.
 *
 * Todas las de un local viven en el MISMO negocio de Bookea (rancho) que
 * su principal: las crea `programa/crear`, que no acepta otro.
 *
 * ── CÓMO SE PREGUNTA: PRIMERO LA COLUMNA, DESPUÉS LA VISTA ──────────
 * Cada lugar del motor sigue haciendo su consulta de siempre sobre
 * `foorkie_restaurantes`, byte por byte, y SOLO si la tarjeta no aparece
 * ahí pregunta acá (`principal = false`). Así:
 *
 *   · los negocios propios de Bookea y las tarjetas principales de
 *     Foorkie se resuelven exactamente igual que antes (la segunda
 *     consulta solo corre cuando la primera no encontró nada);
 *   · el motor se puede publicar ANTES que la migración de Foorkie: sin
 *     la vista, esta consulta falla y se lee como «ninguna extra», que
 *     es la verdad —sin migración no hay tarjetas extra—.
 *
 * Nunca lanza: ante cualquier error, ninguna. Es el mismo criterio de
 * todas las guardias de Foorkie («ante la duda, Bookea»): una tarjeta que
 * no se pudo confirmar se trata como de Bookea, que es lo que pasaba
 * antes de que esto existiera.
 */

/** La vista de Foorkie: una fila por tarjeta de Foorkie (la principal de cada local y sus extras). */
export const VISTA_VINCULOS_FOORKIE = "foorkie_lealtad_vinculos";

/** Lo que el motor lee de la vista: las columnas del local que ya leía de `foorkie_restaurantes` y las de la tarjeta. */
const COLUMNAS =
  "id, slug, activo, estado_publicacion, created_at, bookea_rancho_id, bookea_programa_id, lealtad_por_foorkie, tarjeta_slug, tarjeta_nombre, requiere_codigo";

/** Más que esto no se pide de una vez (un cliente con tarjetas en 50 locales ya es mucho). */
const MAX_FILAS = 200;

/** Una tarjeta extra como la devuelve la vista (sin confiar en los tipos). */
export type FilaTarjetaExtra = {
  /** El local de Foorkie dueño de la tarjeta. */
  id?: unknown;
  /** El slug del LOCAL (`/lealtad/<slug>`). */
  slug?: unknown;
  activo?: unknown;
  estado_publicacion?: unknown;
  created_at?: unknown;
  bookea_rancho_id?: unknown;
  bookea_programa_id?: unknown;
  lealtad_por_foorkie?: unknown;
  /** El slug de ESTA tarjeta dentro del local (`/lealtad/<slug>/<tarjeta_slug>`). */
  tarjeta_slug?: unknown;
  tarjeta_nombre?: unknown;
  /** true = para unirse hace falta el código que el local le da al equipo. */
  requiere_codigo?: unknown;
};

/** Los códigos de «esa tabla o vista no existe» (Postgres y PostgREST): antes de la migración de Foorkie. */
const NO_EXISTE = new Set(["42P01", "PGRST205"]);

function avisar(error: { code?: string | null; message?: string | null } | null | undefined) {
  // Antes de la migración de Foorkie la vista no existe y esta pregunta
  // falla en cada pase que se arma: avisarlo en cada uno solo llenaría los
  // registros. Cualquier otro error sí se deja escrito.
  if (error?.code && NO_EXISTE.has(error.code)) return;
  console.warn("[foorkie] No se pudieron leer las tarjetas extra de Foorkie:", error?.message ?? error);
}

/**
 * Las tarjetas EXTRA de Foorkie (las de `foorkie_lealtad_tarjetas`, nunca
 * las principales) que cumplen el filtro. Sin ids que buscar, ninguna.
 *
 *   programaIds  — estas tarjetas;
 *   ranchoIds    — las de estos negocios;
 *   ranchoId     — y además de ESTE negocio (el par que exige `vinculoConFoorkie`);
 *   soloMarcadas — solo las de un local con `lealtad_por_foorkie = true`.
 */
export async function tarjetasExtraDeFoorkie(
  db: Pick<SupabaseClient, "from">,
  filtro: {
    programaIds?: readonly string[];
    ranchoIds?: readonly string[];
    ranchoId?: string | null;
    soloMarcadas?: boolean;
  },
): Promise<FilaTarjetaExtra[]> {
  const programaIds = [...new Set((filtro.programaIds ?? []).filter((id) => typeof id === "string" && id !== ""))];
  const ranchoIds = [...new Set((filtro.ranchoIds ?? []).filter((id) => typeof id === "string" && id !== ""))];
  if (programaIds.length === 0 && ranchoIds.length === 0) return [];
  try {
    let q = db.from(VISTA_VINCULOS_FOORKIE).select(COLUMNAS).eq("principal", false);
    if (programaIds.length > 0) q = q.in("bookea_programa_id", programaIds);
    if (ranchoIds.length > 0) q = q.in("bookea_rancho_id", ranchoIds);
    if (filtro.ranchoId) q = q.eq("bookea_rancho_id", filtro.ranchoId);
    if (filtro.soloMarcadas) q = q.eq("lealtad_por_foorkie", true);
    const { data, error } = await q.limit(MAX_FILAS);
    if (error) {
      avisar(error);
      return [];
    }
    return ((data ?? []) as FilaTarjetaExtra[]).filter((f) => f && typeof f === "object");
  } catch (e) {
    avisar({ message: e instanceof Error ? e.message : String(e) });
    return [];
  }
}
