import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * CUÁNTA GENTE OCUPA EL CUPO DEL PAQUETE.
 *
 * Un solo lugar donde se responde «¿cuántos clientes lleva este
 * negocio?», porque es el número contra el que se compara
 * `limites.clientesActivos` y de él depende que un cliente real pueda o
 * no agregar su tarjeta al teléfono.
 *
 * ------------------------------------------------------------------
 * QUÉ ESTABA MAL Y QUÉ ARREGLA ESTO (0142)
 * ------------------------------------------------------------------
 * El bloque que había —copiado LITERAL en `generar.ts` y en
 * `google.ts`— era:
 *
 *     select count(*) from miembros where programa_id = <la tarjeta>
 *
 * y fallaba de tres formas a la vez:
 *
 *   1. contaba POR TARJETA, así que cada tarjeta nueva regalaba un cupo
 *      entero: un paquete de 200 con dos tarjetas afiliaba 400. Ese era
 *      el motivo real de que los paquetes de pago fueran con UNA
 *      tarjeta — un candado puesto para tapar este agujero;
 *   2. contaba FILAS y no personas, y desde la 0138 (alta anónima) dos
 *      pases de la misma señora son dos filas, mientras `planes.ts`
 *      promete por escrito que eso es UN cliente;
 *   3. contaba TODOS los estados —'pausada' y 'cancelada' incluidas—
 *      mientras el tipo promete «pases vigentes».
 *
 * Los tres los resuelven las funciones de la 0142. Acá se las llama y
 * se cae al conteo a mano si todavía no están.
 *
 * ------------------------------------------------------------------
 * POR QUÉ TOLERA QUE LA MIGRACIÓN NO ESTÉ CORRIDA
 * ------------------------------------------------------------------
 * Por lo mismo que lo documenta `cuenta.ts`: las migraciones las pega
 * el dueño a mano, así que hay una ventana —horas o días— con código
 * nuevo y base vieja. Si esto diera por sentado el RPC, en esa ventana
 * NINGÚN cliente podría agregar su tarjeta: el error se leería como
 * «el programa está lleno» en el teléfono de alguien que está parado en
 * la caja.
 *
 * ------------------------------------------------------------------
 * ⚠️ LA PUERTA QUE ESTE ARCHIVO NO CUIDA — ACORDARSE
 * ------------------------------------------------------------------
 * El tope solo se hace cumplir en las DOS PUERTAS DE WALLET
 * (`generar.ts` y `google.ts`). El RPC de alta anónima de la 0138,
 * `alta_persona_por_qr`, inserta en `miembros` directo y su propio
 * comentario dice «el tope lo comprueba el servidor antes de llamar».
 *
 * Hoy NADIE lo llama desde `src/` (grep: cero), así que no hay fuga. El
 * día que se conecte —el alta por QR sin cuenta— ese llamador tiene que
 * pasar por `personasActivasDe()` ANTES de llamar al RPC, o el tope se
 * salta entero por la puerta del mostrador y el paquete de $12 afilia
 * sin techo.
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** De quién se quiere saber el cupo. Con los dos datos, mejor. */
export type Quien = {
  /** La cuenta (0134). Es la unidad que paga el paquete. */
  cuentaId?: string | null;
  /** El negocio. Respaldo mientras la 0134 no esté cerrada del todo. */
  ranchoId?: string | null;
};

/** Cuántas filas se traen por página al contar a mano. */
const PAGINA = 1000;
/** Techo de páginas: 50 000 miembros. Más que eso no es un tope, es un bug. */
const MAX_PAGINAS = 50;

/**
 * Personas distintas con al menos un pase VIGENTE, en todas las
 * tarjetas del negocio.
 *
 * Se piden los DOS conteos —por cuenta y por negocio— y se devuelve el
 * mayor. No es paranoia: la 0134 se corrió en dos tiempos y hay
 * programas con `cuenta_id` en null, así que el conteo por cuenta puede
 * dejar tarjetas afuera. Quedarse con el menor sería regalar cupo, que
 * es justo lo que esto viene a cerrar.
 */
export async function personasActivasDe(db: Admin, quien: Quien): Promise<number> {
  const cuentas = quien.cuentaId
    ? await rpcEntero(db, "personas_activas_de_la_cuenta", { p_cuenta: quien.cuentaId })
    : null;
  const negocios = quien.ranchoId
    ? await rpcEntero(db, "personas_activas_del_negocio", { p_rancho: quien.ranchoId })
    : null;

  if (cuentas !== null || negocios !== null) {
    return Math.max(cuentas ?? 0, negocios ?? 0);
  }

  // Ni una ni otra existe todavía: la 0142 no está pegada.
  return contarAMano(db, quien);
}

/**
 * El RPC, o null si la base todavía no lo tiene.
 *
 * Nunca lanza: cualquier error —función inexistente, permiso, lo que
 * sea— devuelve null y quien llama se cae al conteo a mano. Un pase que
 * no se emite es peor que un cupo contado a la antigua por un rato.
 */
async function rpcEntero(
  db: Admin,
  nombre: string,
  args: Record<string, string>,
): Promise<number | null> {
  try {
    const { data, error } = await db.rpc(nombre, args);
    if (error) return null;
    const n = typeof data === "number" ? data : Number(data);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * El conteo sin la 0142, hecho igual de bien que el RPC: por CUENTA (no
 * por tarjeta), deduplicando por persona y solo con las membresías
 * activas.
 *
 * Lo único que no puede hacer es dedupe cuando falta `persona_id` (base
 * sin la 0138): ahí cuenta filas, que es exactamente lo que hacía el
 * código viejo. Se degrada al comportamiento anterior, no a uno peor.
 */
async function contarAMano(db: Admin, quien: Quien): Promise<number> {
  const ids = await programasDe(db, quien);
  if (ids.length === 0) return 0;

  // `persona_id` es de la 0138. Si la columna no existe, PostgREST
  // devuelve error y se cuenta por filas, como antes.
  const personas = new Set<string>();
  let pagina = 0;
  let dedupe = true;

  while (pagina < MAX_PAGINAS) {
    const desde = pagina * PAGINA;
    const { data, error } = await db
      .from("miembros")
      .select("id, persona_id")
      .in("programa_id", ids)
      .eq("estado", "activa")
      .range(desde, desde + PAGINA - 1);

    if (error) {
      dedupe = false;
      break;
    }
    const filas = (data ?? []) as { id: string; persona_id?: string | null }[];
    for (const m of filas) personas.add(m.persona_id ?? m.id);
    // PostgREST corta en `max-rows` (1.000 por defecto): una página
    // corta significa que ya no hay más. Sin este paginado, un paquete
    // de 1.150 se vería para siempre en 1.000.
    if (filas.length < PAGINA) return personas.size;
    pagina += 1;
  }

  if (dedupe) return personas.size;

  const { count } = await db
    .from("miembros")
    .select("*", { count: "exact", head: true })
    .in("programa_id", ids)
    .eq("estado", "activa");
  return count ?? 0;
}

/**
 * Las tarjetas del negocio, buscando por cuenta Y por rancho.
 *
 * Las dos, y se unen: hay programas que la 0134 colgó de la cuenta y
 * otros que no. Buscar por una sola dejaría tarjetas afuera del conteo,
 * o sea cupo regalado.
 */
async function programasDe(db: Admin, quien: Quien): Promise<string[]> {
  const ids = new Set<string>();

  if (quien.cuentaId) {
    const { data } = await db
      .from("programa_lealtad")
      .select("id")
      .eq("cuenta_id", quien.cuentaId);
    for (const p of (data ?? []) as { id: string }[]) ids.add(p.id);
  }

  if (quien.ranchoId) {
    const { data } = await db
      .from("programa_lealtad")
      .select("id")
      .eq("rancho_id", quien.ranchoId);
    for (const p of (data ?? []) as { id: string }[]) ids.add(p.id);
  }

  return [...ids];
}
