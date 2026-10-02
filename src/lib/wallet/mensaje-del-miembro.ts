import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ════════════════════════════════════════════════════════════════════
 *  UN MENSAJE PARA UN SOLO CLIENTE, EN SU PASE DE APPLE
 * ════════════════════════════════════════════════════════════════════
 *
 * El aviso de marketing (0152) vive en el PROGRAMA: le llega a todos.
 * Este es el otro, el que le llega a UNA persona por algo que acaba de
 * pasar en SU tarjeta («¡Gracias por preferirnos!» al sumar). Lo usan los
 * mensajes automáticos de las tarjetas de Foorkie
 * (`src/lib/plataforma/foorkie-mensajes.ts`).
 *
 * ── DÓNDE SE GUARDA: LA COLUMNA DEL HITO (0205) ─────────────────────
 * `miembros.ultimo_hito_mensaje` se creó justo para esto —«alimenta el
 * changeMessage del pase», por miembro— y nunca se terminó de cablear:
 * `avisarHitoPorWallet` la escribe pero nadie la llama, y `generar.ts`
 * no la leía. Se reusa tal cual, sin migración. Hoy `generar.ts` la lee
 * SOLO en las tarjetas de Foorkie (un pase de Bookea sale byte por byte
 * como siempre).
 *
 * ── POR QUÉ EL VALOR NO ES EXACTAMENTE EL TEXTO ─────────────────────
 * Apple muestra el aviso en la pantalla bloqueada cuando el VALOR de un
 * campo con `changeMessage` cambia entre el pase que el teléfono tiene y
 * el que baja. El mismo «¡Gracias por preferirnos!» dos compras seguidas
 * es el MISMO valor: la segunda compra no avisaría nada.
 *
 * Por eso, si el texto nuevo es igual al guardado, se le agrega (o se le
 * saca) un espacio de ancho cero (U+200B) al final: el valor cambia, el
 * texto que se lee es idéntico. Es un carácter de formato, no un
 * espacio: ni `trim()` ni el texto del aviso lo muestran.
 *
 * ── Y EL PASE TIENE QUE CONSTAR COMO CAMBIADO ───────────────────────
 * El iPhone, después del push, pregunta qué pases cambiaron desde la
 * última vez (`pases_wallet.actualizado_en`). El movimiento del ledger
 * ya la movió (los RPC de la 0125 lo hacen adentro de su transacción),
 * pero el mensaje es un cambio del pase en sí mismo: se vuelve a marcar,
 * para no depender de quién movió el saldo.
 *
 * Quien llama tiene que escribir esto ANTES del push
 * (`avisarCambioDePase`): el pase que el teléfono baja tiene que traerlo.
 */

/**
 * QUÉ LE ACABA DE PASAR A LA TARJETA, para quien avisa al Wallet:
 *
 *   sumar    entraron sellos, saldo o puntos (un pedido, la caja, el
 *            escáner, una cita… de donde sea);
 *   quitar   el negocio sacó o corrigió: un ajuste o una reversión;
 *   canjear  se entregó un premio.
 *
 * El vencimiento de los sellos (`vencer-sellos.ts`) no es ninguno de los
 * tres a propósito: lo hace el sistema solo, no el negocio.
 */
export const EVENTOS_DEL_PASE = ["sumar", "quitar", "canjear"] as const;
export type EventoDelPase = (typeof EVENTOS_DEL_PASE)[number];

/** El marcador que hace distinto un valor que se lee igual. */
export const MARCA_DE_CAMBIO = "\u200B";

/** El texto tal como se lee: sin el marcador. */
export function textoVisible(valor: string): string {
  return valor.split(MARCA_DE_CAMBIO).join("");
}

/**
 * El valor que se guarda para que Apple vuelva a avisar. Pura.
 *
 * Distinto del anterior SIEMPRE: si el texto cambió, el texto tal cual;
 * si es el mismo, con el marcador puesto o sacado según lo tenía.
 */
export function valorQueCambia(previo: string | null | undefined, texto: string): string {
  const limpio = textoVisible(texto);
  if (typeof previo !== "string" || textoVisible(previo) !== limpio) return limpio;
  return previo === limpio ? `${limpio}${MARCA_DE_CAMBIO}` : limpio;
}

type Db = Pick<SupabaseClient, "from">;

/**
 * El último mensaje que se le dejó a este cliente, o null. Nunca lanza:
 * sin la 0205 (o con la base caída) el pase sale sin el renglón.
 */
export async function leerMensajeDelMiembro(db: Db, miembroId: string): Promise<string | null> {
  try {
    const { data, error } = await db.from("miembros").select("ultimo_hito_mensaje").eq("id", miembroId).maybeSingle();
    if (error) return null;
    const valor = (data as { ultimo_hito_mensaje?: unknown } | null)?.ultimo_hito_mensaje;
    return typeof valor === "string" && textoVisible(valor).trim() ? valor : null;
  } catch {
    return null;
  }
}

/**
 * Le deja el mensaje al cliente para su pase de Apple y marca su pase
 * como cambiado. true = quedó guardado. Nunca lanza: el movimiento que
 * lo originó ya está en el ledger, y un mensaje que no se pudo guardar
 * no puede deshacerlo.
 */
export async function escribirMensajeDelMiembro(db: Db, miembroId: string, texto: string): Promise<boolean> {
  try {
    const { data, error } = await db.from("miembros").select("ultimo_hito_mensaje").eq("id", miembroId).maybeSingle();
    if (error) {
      console.warn(`[wallet] No se pudo leer el último mensaje del miembro ${miembroId}: ${error.message}`);
      return false;
    }
    const previo = (data as { ultimo_hito_mensaje?: unknown } | null)?.ultimo_hito_mensaje;
    const valor = valorQueCambia(typeof previo === "string" ? previo : null, texto);

    const { error: alGuardar } = await db.from("miembros").update({ ultimo_hito_mensaje: valor }).eq("id", miembroId);
    if (alGuardar) {
      console.warn(`[wallet] No se pudo guardar el mensaje del miembro ${miembroId}: ${alGuardar.message}`);
      return false;
    }

    const { error: alMarcar } = await db
      .from("pases_wallet")
      .update({ actualizado_en: new Date().toISOString() })
      .eq("miembro_id", miembroId)
      .eq("plataforma", "apple")
      .eq("activo", true);
    if (alMarcar) console.warn(`[wallet] No se pudo marcar el pase del miembro ${miembroId}: ${alMarcar.message}`);
    return true;
  } catch (e) {
    console.warn("[wallet] No se pudo dejar el mensaje en el pase:", e);
    return false;
  }
}
