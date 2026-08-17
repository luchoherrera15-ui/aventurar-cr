import type { SupabaseClient } from "@supabase/supabase-js";
import { planEfectivo } from "./cuenta";

/**
 * EL ÚNICO LUGAR DONDE SE ESCRIBE EL PAQUETE DE LEALTAD DE UN NEGOCIO.
 *
 * ------------------------------------------------------------------
 * LA RAÍZ ES `cuentas.plan`. `ranchos.plan_lealtad` ES SU ESPEJO.
 * ------------------------------------------------------------------
 * El paquete se guarda en dos columnas y la que manda no es la obvia:
 *
 *     planEfectivo = cuentas.plan ?? ranchos.plan_lealtad
 *
 * La raíz es la CUENTA (0134) y no el rancho, y la razón no es de
 * gusto: todo lo que el paquete gobierna se cuenta POR CUENTA, no por
 * ficha de marketplace.
 *
 *   · el cupo de clientes se cuenta por cuenta desde la 0142
 *     (`personasActivasDe`) — antes se contaba por programa y cada
 *     tarjeta nueva regalaba un cupo entero;
 *   · los asientos del equipo son de `cuentas_equipo` (0134);
 *   · las tarjetas publicables se cuentan sobre `programa_lealtad`
 *     colgado de `cuenta_id` (`crear-actions.ts`);
 *   · la suscripción de Stripe puede colgar de la cuenta SIN rancho
 *     (0143), o sea que hay planes cobrados que el rancho ni conoce.
 *
 * Y sobre todo: un rancho es una FICHA DE MARKETPLACE, no un negocio.
 * La 0134 nació justamente para separar las dos cosas, y su comentario
 * de cabecera lo dice: mañana cuelgan de `cuentas` también Citas,
 * Hospedajes y la ficha pública. El día que una cuenta tenga dos
 * negocios —o ninguno, que ya se puede: Lealtad sin marketplace— el
 * plan guardado en el rancho serían N copias de UNA suscripción, y
 * «cuál de las N manda» no tiene respuesta correcta. Guardado en la
 * cuenta, la pregunta ni existe.
 *
 * `ranchos.plan_lealtad` no se borra porque hoy lo leen 30 archivos y
 * porque para la INMENSA mayoría de los negocios —los que nunca
 * tuvieron fila en `cuentas`— es el único lugar donde el paquete
 * existe. Es el respaldo de la transición «expandir ahora, contraer
 * después» de la 0134, y hasta que se contraiga hay que mantenerlo
 * honesto.
 *
 * ------------------------------------------------------------------
 * EL BUG QUE ESTE ARCHIVO CIERRA (y que estaba pasando en producción)
 * ------------------------------------------------------------------
 * La escritura era asimétrica: el webhook de Stripe escribía las dos
 * columnas y el resto escribía SOLO el rancho. Para un negocio con
 * fila en `cuentas` y plan no nulo, mover el desplegable del admin no
 * cambiaba el plan efectivo — el admin veía el cambio aplicado y el
 * panel del negocio seguía con el paquete anterior. Un cambio que se
 * ve hecho y no está hecho es peor que uno que falla.
 *
 * El arreglo tiene DOS capas, a propósito:
 *
 *   1. ESTA función, que es la única que escribe. Cuatro copias del
 *      mismo update se desincronizan; una sola, no.
 *   2. La 0175, que pone el espejo EN LA BASE con dos triggers. Es la
 *      capa que de verdad cierra el agujero: acordarse de escribir dos
 *      columnas en cuatro lugares es una promesa, y una promesa no es
 *      una garantía. Con la 0175 pegada, escribir cualquiera de las
 *      dos arrastra a la otra aunque el update venga del SQL Editor.
 *
 * Esta función sigue haciendo falta CON la 0175 pegada: las
 * migraciones las pega el dueño a mano y siempre hay una ventana en la
 * que el código va adelante de la base.
 */

/** Un cliente de Supabase con llave de servicio. */
type Db = SupabaseClient;

export type PlanGuardado = {
  /** La cuenta del negocio. null = sin fila en `cuentas` (o sin 0134). */
  cuentaId: string | null;
  /** Lo que dice la raíz. */
  planCuenta: string | null;
  /** Lo que dice el espejo. */
  planRancho: string | null;
  /** El que MANDA, ya resuelto con `planEfectivo`. */
  plan: string | null;
};

export type ResultadoPlan =
  | { ok: true; cuentaId: string | null }
  | { ok: false; motivo: string; cuentaId: string | null };

/**
 * «Esa tabla/columna no existe» para `cuentas`.
 *
 * Que falte NO es un error: es la ventana de la transición de la 0134,
 * en la que el negocio vive solo en `ranchos` y ahí es donde hay que
 * escribir. Tratarlo como error dejaría al admin sin poder asignar
 * ningún plan mientras la migración esté pendiente.
 */
function faltaCuentas(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  const m = error.message ?? "";
  return /cuentas/.test(m) && /does not exist|schema cache|Could not find/i.test(m);
}

/**
 * La cuenta de un negocio, si la hay.
 *
 * `cuentas.rancho_id` es UNIQUE (0134), así que es una o ninguna.
 */
async function cuentaDe(db: Db, ranchoId: string): Promise<string | null> {
  const { data } = await db.from("cuentas").select("id").eq("rancho_id", ranchoId).maybeSingle();
  const id = (data as { id?: unknown } | null)?.id;
  return typeof id === "string" && id ? id : null;
}

/**
 * QUÉ PAQUETE TIENE HOY ESTE NEGOCIO — el efectivo, no el del rancho.
 *
 * Existe para que el «antes» de la bitácora (0173) sea el paquete con
 * el que el negocio venía OPERANDO. Leerlo de `ranchos.plan_lealtad` a
 * secas hacía que un negocio con cuenta dejara filas de historial
 * diciendo «antes: sin plan» cuando venía con uno — y una bitácora que
 * miente sobre el antes es peor que no tener bitácora.
 */
export async function planGuardadoDe(db: Db, ranchoId: string): Promise<PlanGuardado> {
  const { data: rancho } = await db
    .from("ranchos")
    .select("plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  const planRancho = ((rancho as { plan_lealtad?: unknown } | null)?.plan_lealtad ?? null) as
    | string
    | null;

  const cuentaId = await cuentaDe(db, ranchoId);
  if (!cuentaId) {
    return { cuentaId: null, planCuenta: null, planRancho, plan: planEfectivo({ planRancho }) };
  }

  const { data: cuenta } = await db.from("cuentas").select("plan").eq("id", cuentaId).maybeSingle();
  const planCuenta = ((cuenta as { plan?: unknown } | null)?.plan ?? null) as string | null;

  return { cuentaId, planCuenta, planRancho, plan: planEfectivo({ planCuenta, planRancho }) };
}

/**
 * ESCRIBIR EL PAQUETE, EN LA RAÍZ Y EN EL ESPEJO.
 *
 * El orden NO es indiferente: primero `cuentas.plan`, que es la que
 * manda. Si la raíz falla se corta ahí y el espejo NO se toca —
 * escribir el espejo cuando la raíz falló es exactamente cómo nacen
 * los datos cruzados, y encima con la pantalla mostrando el valor
 * nuevo que el negocio no tiene.
 *
 * `plan: null` es una BAJA legítima (se escribe null en las dos), no un
 * «no tocar». Ojo con lo que significa: quitar el paquete NO apaga el
 * módulo, lo deja SIN TOPES —`definicionDe(null)` es null y todos los
 * límites salen null— o sea gratis e ilimitado. Apagar es cosa del
 * complemento `lealtad` (0077), no de esta columna.
 */
export async function aplicarPlanDeLealtad(
  db: Db,
  destino: {
    /** El negocio. null = la suscripción cuelga solo de la cuenta (0143). */
    ranchoId: string | null;
    /** Si ya se sabe, se ahorra la consulta. Se busca por rancho si no. */
    cuentaId?: string | null;
    /** Un id del catálogo (`PLANES_ID`). null = baja. */
    plan: string | null;
  },
): Promise<ResultadoPlan> {
  let cuentaId = destino.cuentaId ?? null;
  if (!cuentaId && destino.ranchoId) cuentaId = await cuentaDe(db, destino.ranchoId);

  // ── 1. LA RAÍZ ────────────────────────────────────────────────────
  if (cuentaId) {
    const { error } = await db.from("cuentas").update({ plan: destino.plan }).eq("id", cuentaId);
    if (error && !faltaCuentas(error)) {
      return {
        ok: false,
        motivo:
          "No se pudo escribir el paquete en la cuenta, que es la que manda: " +
          error.message +
          ". No se tocó el negocio: dejarlo con un valor que la cuenta no tiene sería mostrar un paquete que no está.",
        cuentaId,
      };
    }
  }

  // ── 2. EL ESPEJO ──────────────────────────────────────────────────
  if (destino.ranchoId) {
    const { error } = await db
      .from("ranchos")
      .update({ plan_lealtad: destino.plan })
      .eq("id", destino.ranchoId);
    if (error) {
      if (error.message.includes("plan_lealtad")) {
        return { ok: false, motivo: "Falta correr la migración 0124 en Supabase.", cuentaId };
      }
      return {
        ok: false,
        motivo:
          "El paquete quedó guardado en la cuenta (que es la que manda) pero no en el negocio: " +
          error.message +
          ". El negocio ya opera con el paquete nuevo; lo que quedó viejo es la copia.",
        cuentaId,
      };
    }
  }

  return { ok: true, cuentaId };
}
