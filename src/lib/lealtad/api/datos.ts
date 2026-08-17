import { miembroAlcanzable } from "./aislamiento";
import { refDeMiembro } from "./ref";
import type { ContextoApi } from "./contexto";

/**
 * LAS CONSULTAS DE LA API — y el paso 8 del guardia.
 *
 * Todo lo que lee de la base pide COLUMNAS EXPLÍCITAS. Nunca
 * `select("*")`: este repo ya filtró el SINPE y la cuenta bancaria de
 * sus proveedores dos veces por exactamente eso
 * (src/lib/ranchos-publicos.ts:36-52), y acá del otro lado hay un
 * tercero al que nadie le preguntó nada.
 *
 * Y ninguna de estas funciones toca `perfiles`, `personas` o
 * `clientes_negocio` para nada que no sea calcular DOS LETRAS.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTE ARCHIVO YA NO LEE (agosto 2026)
 * ------------------------------------------------------------------
 * La API se acotó a UN caso de uso: que la caja del negocio le sume un
 * sello al cliente y el pase del teléfono se actualice solo. Con eso se
 * fueron `/programa` y `/recompensas`, y con ellos el scope `catalogo`.
 *
 * O sea que de `programa_lealtad` ya no salen las REGLAS (compra
 * mínima, topes, puntos por colón) ni el catálogo entero con sus `sku`:
 * eran configuración del negocio que ningún endpoint vivo necesita. De
 * `recompensas` solo se lee `costo_puntos` para derivar la META, que es
 * lo que hace posible el «te faltan 3» del mostrador.
 *
 * Un dato que no se lee no se puede filtrar por error.
 */

/** Lo mínimo del miembro que la API necesita, ya comprobado el aislamiento. */
export type MiembroResuelto = {
  miembroId: string;
  programaId: string;
  estado: string;
  clienteId: string | null;
};

/**
 * EL PASO 8: resolver el identificador y exigir que el miembro sea de
 * ESTA tarjeta y de ESTE negocio.
 *
 * `acreditar_lealtad` (0125) no comprueba el negocio — lo dice su
 * propio grant. O sea que esta función es la ÚNICA barrera entre la
 * llave de la barbería A y los miembros de la barbería B. Devuelve null
 * ante cualquier duda, y la ruta convierte ese null en el MISMO 404 que
 * usa para "no existe": distinguirlos sería regalar un enumerador.
 */
async function comprobarAlcance(
  ctx: ContextoApi,
  miembroId: string,
): Promise<MiembroResuelto | null> {
  const { data: miembro } = await ctx.db
    .from("miembros")
    .select("id, programa_id, estado, cliente_id")
    .eq("id", miembroId)
    .maybeSingle();
  if (!miembro) return null;

  const { data: programa } = await ctx.db
    .from("programa_lealtad")
    .select("id, rancho_id")
    .eq("id", miembro.programa_id as string)
    .maybeSingle();
  if (!programa) return null;

  const alcanzable = miembroAlcanzable(
    { ranchoId: ctx.ranchoId, programaId: ctx.programaId },
    {
      ranchoId: (programa.rancho_id as string) ?? "",
      programaId: (programa.id as string) ?? "",
    },
  );
  if (!alcanzable) return null;

  /**
   * UNA MEMBRESÍA CANCELADA SE COMPORTA COMO INEXISTENTE.
   *
   * Y "como inexistente" quiere decir EXACTAMENTE inexistente: null acá
   * hace que las dos rutas devuelvan el mismo 404 con el mismo cuerpo
   * que devuelven ante un `ref` o un `serial` inventado. El criterio es
   * el de `wallet/servicio.ts:52-56`: responder distinto —«existe pero
   * está cancelada»— convierte al endpoint en un ORÁCULO. Con eso, un
   * integrador (o quien le robe su base de `ref`) recorre su lista y
   * aprende quién se dio de baja del programa de la barbería, sin leer
   * un solo dato de nadie.
   *
   * Hasta ahora los dos caminos hablaban:
   *   · `GET /saldo` contestaba 200 con el saldo y `estado:"cancelada"`;
   *   · `POST /acreditaciones` contestaba 422 con el motivo que arma
   *     `acreditar_lealtad` (0125:323-326): «Esa membresía está
   *     cancelada.» — un 422 donde una referencia falsa da 404.
   *
   * `pausada` NO se trata así, y es a propósito: es reversible, la
   * persona sigue siendo miembro y la consulta de saldo es justamente
   * lo que el mostrador necesita para atenderla. Lo que sí se fue es el
   * campo `estado` de la respuesta (ver `serializarSaldo`), así que una
   * pausada tampoco anuncia que lo está.
   *
   * Mismo criterio que ya usan `wallet/generar.ts:234` y
   * `wallet/google.ts:568` para no emitir un pase de una membresía
   * cancelada.
   */
  if (((miembro.estado as string | null) ?? "activa") === "cancelada") return null;

  return {
    miembroId: miembro.id as string,
    programaId: miembro.programa_id as string,
    estado: (miembro.estado as string) ?? "activa",
    clienteId: (miembro.cliente_id as string | null) ?? null,
  };
}

/**
 * Serial de la tarjeta presentada → miembro.
 *
 * El serial es lo que va en el código de barras del pase
 * (wallet/tarjeta.ts:511 pone el serial pelado, sin token), o sea: es
 * lo que el cliente enseña en el mostrador. Por eso `GET /saldo` es el
 * único endpoint que lo acepta, tiene su propio límite más duro, y la
 * documentación le pide al POS que NO lo guarde.
 */
export async function miembroPorSerial(
  ctx: ContextoApi,
  serial: string,
): Promise<MiembroResuelto | null> {
  const { data: pase } = await ctx.db
    .from("pases_wallet")
    .select("miembro_id")
    .eq("serial_number", serial)
    .maybeSingle();
  if (!pase?.miembro_id) return null;
  return comprobarAlcance(ctx, pase.miembro_id as string);
}

/**
 * `ref` opaco → miembro.
 *
 * El ref solo existe DENTRO de una autorización, así que esta consulta
 * ya trae el aislamiento a medias (el índice está por
 * `autorizacion_id`). Igual se pasa por `comprobarAlcance`: si algún
 * día el programa cambiara de negocio, la fila vieja de `refs_api_lealtad`
 * seguiría ahí y sería exactamente la grieta que este archivo existe
 * para tapar.
 */
export async function miembroPorRef(
  ctx: ContextoApi,
  ref: string,
): Promise<MiembroResuelto | null> {
  const { data } = await ctx.db
    .from("refs_api_lealtad")
    .select("miembro_id")
    .eq("autorizacion_id", ctx.autorizacionId)
    .eq("ref", ref)
    .maybeSingle();
  if (!data?.miembro_id) return null;
  return comprobarAlcance(ctx, data.miembro_id as string);
}

/**
 * El `ref` de un miembro, creándolo la primera vez.
 *
 * Es determinístico (HMAC del miembro con el pepper de la
 * autorización), así que la fila no guarda un secreto nuevo: es el
 * índice que permite volver de ref a miembro. `upsert` con
 * `ignoreDuplicates` porque dos cajas consultando la misma tarjeta al
 * mismo tiempo es lo normal, no un error.
 */
export async function refDelMiembro(ctx: ContextoApi, miembroId: string): Promise<string> {
  const ref = refDeMiembro(miembroId, ctx.pepperRef);
  await ctx.db
    .from("refs_api_lealtad")
    .upsert(
      { autorizacion_id: ctx.autorizacionId, miembro_id: miembroId, ref },
      { onConflict: "autorizacion_id,miembro_id", ignoreDuplicates: true },
    );
  return ref;
}

/**
 * El NOMBRE de la tarjeta que esta llave puede tocar. Nada más.
 *
 * Lo único que lo usa es `GET /yo`, para que el integrador confirme a
 * qué tarjeta se conectó. Las reglas del programa se dejaron de leer
 * con `/programa` — ver el encabezado del archivo.
 */
export async function nombreDelPrograma(ctx: ContextoApi): Promise<string> {
  const { data } = await ctx.db
    .from("programa_lealtad")
    // Columnas EXPLÍCITAS, nunca `*`: ver el encabezado del archivo.
    .select("nombre, rancho_id")
    .eq("id", ctx.programaId)
    .maybeSingle();
  if (!data) return "";
  // Cinturón y tirantes: si el programa dejara de ser de este negocio,
  // la llave no dice nada en vez de seguir hablando.
  if ((data.rancho_id as string) !== ctx.ranchoId) return "";
  return ((data.nombre as string | null) ?? "").trim();
}

/**
 * La meta de la tarjeta: cuánto hay que juntar para el premio.
 *
 * NO tiene columna propia (0121): es el `costo_puntos` de la recompensa
 * activa más barata. Derivarla es lo que hace que cambiar la recompensa
 * cambie la tarjeta sola, en vez de dejar dos números para la misma
 * cosa que se separan el día que el dueño toca uno.
 *
 * Se lee UNA sola columna y UNA sola fila. El catálogo completo —con
 * nombre, descripción y `sku` de cada premio— salía por `/recompensas`,
 * que ya no existe: la meta es un número suelto y es todo lo que el
 * «te faltan 3» necesita.
 */
export async function metaDelPrograma(ctx: ContextoApi): Promise<number | null> {
  const { data } = await ctx.db
    .from("recompensas")
    .select("costo_puntos")
    .eq("programa_id", ctx.programaId)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1);
  const fila = ((data ?? []) as { costo_puntos: number }[])[0];
  return fila ? fila.costo_puntos : null;
}

/** El saldo REAL: la suma del ledger, no el espejo del pase. */
export async function saldoDelMiembro(ctx: ContextoApi, miembroId: string): Promise<number> {
  const { data } = await ctx.db
    .from("transacciones_puntos")
    .select("puntos")
    .eq("miembro_id", miembroId)
    .limit(5000);
  return ((data ?? []) as { puntos: number }[]).reduce((suma, t) => suma + (t.puntos ?? 0), 0);
}

/**
 * NO HAY `selladoHoy`, Y ES A PROPÓSITO.
 *
 * Existió: leía `transacciones_puntos` para contestar «¿ya se le selló
 * hoy?» en un bit, y ese bit salía en `GET /saldo`. Se quitó porque era
 * el único dato del LIBRO MAYOR de una persona que la API entregaba, y
 * la pantalla donde el dueño autoriza el scope `saldo` no lo nombra:
 * promete «saldo, meta y dos letras del nombre».
 *
 * La función operativa que cumplía —que el cajero no selle dos veces—
 * la cumple el tope diario por cliente, que `api_lealtad_autorizar`
 * (0176:371-375) EXIGE configurado antes de conceder `acreditar` y que
 * devuelve un 422 con «Este cliente ya llegó a su tope de hoy.» para
 * que el cajero se lo lea al cliente. O sea: el dato solo aparece
 * cuando hace falta de verdad, y solo para la llave que además puede
 * acreditar.
 *
 * Si algún día se quiere de vuelta, primero se cambia el texto del
 * consentimiento Y se vuelve a pedir autorización — cambiar la pantalla
 * no re-pregunta a los negocios que ya dijeron que sí.
 */

/**
 * El nombre del cliente, SOLO para sacarle dos letras.
 *
 * Devuelve null si el dueño apagó `mostrar_iniciales`, y en ese caso ni
 * siquiera se hace la consulta: el dato que no se lee no se puede
 * filtrar por error.
 */
export async function nombreParaIniciales(
  ctx: ContextoApi,
  clienteId: string | null,
): Promise<string | null> {
  if (!ctx.mostrarIniciales || !clienteId) return null;
  const { data } = await ctx.db
    .from("perfiles")
    .select("nombre")
    .eq("id", clienteId)
    .maybeSingle();
  return ((data?.nombre as string | null) ?? null) || null;
}

/** El nombre del negocio, para que `/yo` diga a quién se conectó. */
export async function nombreDelNegocio(ctx: ContextoApi): Promise<string> {
  const { data } = await ctx.db
    .from("ranchos")
    .select("nombre")
    .eq("id", ctx.ranchoId)
    .maybeSingle();
  return ((data?.nombre as string | null) ?? "").trim() || "Negocio";
}
