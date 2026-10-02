import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lectura, Vinculo } from "@/lib/plataforma/foorkie-caja";
import { localDeFoorkieDeLaTarjeta, marcaDelPase } from "@/lib/plataforma/foorkie-marca";
import { esColumnaAusente, traducirError } from "@/lib/lealtad/errores-base";
import {
  EVENTOS_DEL_PASE,
  escribirMensajeDelMiembro,
  leerMensajeDelMiembro,
  textoVisible,
  type EventoDelPase,
} from "@/lib/wallet/mensaje-del-miembro";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS MENSAJES AUTOMÁTICOS DE UNA TARJETA DE FOORKIE
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 oct 2026): «configurar mensajes automáticos desde
 * el panel de LEALTAD: cuando se acumulan puntos en la tarjeta enviar un
 * "Gracias por preferirnos" (el restaurante define el texto); cuando se
 * quitan puntos ("Tu tarjeta se modificó"); cuando se canjea (un
 * agradecimiento)».
 *
 * Tres eventos, cada uno `{ activo, texto }` (3 a 120 caracteres, una
 * línea), activos y con el texto de abajo mientras el restaurante no
 * diga otra cosa. Los lee y los cambia el panel de Foorkie por
 * `programa/mensajes` y `programa/mensajes/guardar`.
 *
 * ── SOLO TARJETAS DE FOORKIE ────────────────────────────────────────
 * Las que un local de Foorkie tiene vinculadas Y marcadas con
 * `lealtad_por_foorkie` (`localDeFoorkieDeLaTarjeta`, la misma guardia
 * del pase y de los correos). Una tarjeta vinculada sin la marca —Pura
 * Matcha— no recibe nada de esto: ni se le escribe la configuración ni
 * sus clientes reciben un mensaje. Si la guardia no se puede leer, es de
 * Bookea: nada nuevo.
 *
 * ── CÓMO LLEGA ──────────────────────────────────────────────────────
 * Después de que el movimiento ya quedó en el ledger, por el mismo
 * camino que refresca el pase (`avisarCambioDePase`, siempre dentro de
 * `after()`): el texto se le deja a ESE cliente para su pase de Apple
 * (`mensaje-del-miembro.ts`, un renglón con `changeMessage`) y se le
 * manda como mensaje con notificación a su pase de Google
 * (`avisarEventoGoogle`). Un aviso que falla no deshace ni frena nada.
 *
 * Hoy ninguno de los dos pases avisa por sí solo cuando cambia el saldo
 * (el saldo de Apple no tiene `changeMessage` y el PATCH de Google no
 * pide notificación): este mensaje es EL aviso del movimiento, no uno
 * más arriba de otro.
 *
 * Apple avisa cuando un campo que YA ESTABA cambia de valor, no cuando
 * aparece. Por eso el pase de una tarjeta de Foorkie lleva el renglón
 * desde el principio («Todavía no hay mensajes.», `mensajeParaElPase`) y
 * guardar los mensajes refresca en silencio los pases instalados. Un
 * iPhone con la tarjeta de antes que nunca se refrescó recibe su primer
 * mensaje en el reverso sin que suene; del segundo en adelante, suena.
 *
 * ── NO GASTA EL CUPO DE AVISOS DEL PAQUETE ──────────────────────────
 * El cupo del mes (`notificaciones_promocionales`) es para las campañas:
 * el negocio interrumpiendo a todos. Esto es la respuesta a lo que el
 * cliente acaba de hacer, a él solo. El tope que sí se respeta es el de
 * Google por pase y por día (ver `AVISOS_DE_EVENTO_POR_DIA`).
 *
 * ── DÓNDE SE GUARDA ─────────────────────────────────────────────────
 * En `programa_lealtad.configuracion` (jsonb), bajo
 * `mensajes_automaticos`: la bolsa de configuración que ya usa el ritmo
 * de los clientes (`guardarRitmo`). Ninguna migración la crea: la 0251
 * la asegura (`add column if not exists`). Sin ella esto lee los valores
 * de fábrica, los mensajes salen igual, y guardar contesta
 * `sin_migracion`.
 *
 * Sin nada pesado adentro: lo importa `generar.ts`, que arma cada pase.
 */

export type EventoDeMensaje = EventoDelPase;
export const EVENTOS_DE_MENSAJE = EVENTOS_DEL_PASE;

export type MensajeAutomatico = { activo: boolean; texto: string };
export type MensajesAutomaticos = Record<EventoDeMensaje, MensajeAutomatico>;

/** Lo que dice cada evento mientras el restaurante no cambie nada. */
export const MENSAJES_POR_DEFECTO: Readonly<MensajesAutomaticos> = Object.freeze({
  sumar: Object.freeze({ activo: true, texto: "¡Gracias por preferirnos!" }),
  quitar: Object.freeze({ activo: true, texto: "Tu tarjeta se modificó." }),
  canjear: Object.freeze({ activo: true, texto: "¡Gracias! Disfrutá tu premio." }),
});

/** El mismo largo que el aviso a todos (`mensaje`): el reverso del pase de Apple tiene ancho fijo. */
export const TEXTO_MINIMO = 3;
export const TEXTO_MAXIMO = 120;

/** La columna jsonb y la clave adentro de ella. */
export const COLUMNA_CONFIGURACION = "configuracion";
export const CLAVE_MENSAJES = "mensajes_automaticos";

/**
 * Lo que dice el renglón del pase de Apple antes del primer mensaje. Va
 * para que el PRIMER mensaje también avise: Apple solo avisa cuando un
 * campo que ya estaba cambia de valor, no cuando aparece.
 */
export const SIN_MENSAJES_TODAVIA = "Todavía no hay mensajes.";

/** Cómo se nombra cada evento en una frase («El mensaje al sumar…»). */
const AL: Record<EventoDeMensaje, string> = { sumar: "al sumar", quitar: "al quitar", canjear: "al canjear" };

// ════════════════════════════════════════════════════════════════════
//  1. El texto
// ════════════════════════════════════════════════════════════════════

/**
 * Una línea, sin caracteres de control ni espacios de más, y sin los
 * marcadores de ancho cero que el pase usa para forzar el aviso
 * (`MARCA_DE_CAMBIO`). El unidor de los emojis compuestos (U+200D) se
 * queda: sin él, «👩‍🍳» se desarma.
 */
export function limpiarTexto(crudo: string): string {
  return crudo
    .replace(/[\u200B\u2060\uFEFF]/g, "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** El texto si sirve tal como está guardado (de 3 a 120 caracteres); si no, null. */
function textoGuardado(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = limpiarTexto(v);
  return t.length >= TEXTO_MINIMO && t.length <= TEXTO_MAXIMO ? t : null;
}

/** Un objeto jsonb (o el texto JSON de uno); cualquier otra cosa, {}. */
function objetoDe(v: unknown): Record<string, unknown> {
  let crudo = v;
  if (typeof crudo === "string") {
    try {
      crudo = JSON.parse(crudo);
    } catch {
      return {};
    }
  }
  return crudo && typeof crudo === "object" && !Array.isArray(crudo) ? (crudo as Record<string, unknown>) : {};
}

// ════════════════════════════════════════════════════════════════════
//  2. Lo que manda Foorkie al guardar
// ════════════════════════════════════════════════════════════════════

/** Lo que cambia de cada evento. Lo que no viene se queda como estaba. */
export type CambiosDeMensajes = Partial<Record<EventoDeMensaje, { activo?: boolean; texto?: string }>>;

function esEvento(v: string): v is EventoDeMensaje {
  return (EVENTOS_DE_MENSAJE as readonly string[]).includes(v);
}

/**
 * La forma de `mensajes` en `programa/mensajes/guardar`:
 *
 *   { sumar?: { activo?, texto? }, quitar?: {…}, canjear?: {…} }
 *
 * Al menos un evento, y en cada uno al menos una de las dos cosas. Un
 * evento que no existe es un error (y no un descuido que se ignora): un
 * «acreditar» mal escrito tiene que rebotar, no guardarse en silencio
 * sin hacer nada. El texto se deja en una línea antes de medirlo, igual
 * que el aviso a todos (`leerPedidoMensaje`).
 */
export function leerCambiosDeMensajes(v: unknown): Lectura<CambiosDeMensajes> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    return { ok: false, motivo: "Mandá los mensajes que cambian (sumar, quitar o canjear)." };
  }
  const entrada = v as Record<string, unknown>;
  const claves = Object.keys(entrada);
  if (claves.length === 0) return { ok: false, motivo: "No vino ningún mensaje para cambiar." };

  const cambios: CambiosDeMensajes = {};
  for (const clave of claves) {
    if (!esEvento(clave)) {
      return { ok: false, motivo: `«${clave}» no es un mensaje: los mensajes son sumar, quitar y canjear.` };
    }
    const crudo = entrada[clave];
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) {
      return { ok: false, motivo: `El mensaje ${AL[clave]} tiene que traer «activo» y/o «texto».` };
    }
    const m = crudo as Record<string, unknown>;
    const cambio: { activo?: boolean; texto?: string } = {};

    if (m.activo !== undefined) {
      if (typeof m.activo !== "boolean") {
        return { ok: false, motivo: `«activo» del mensaje ${AL[clave]} tiene que ser true o false.` };
      }
      cambio.activo = m.activo;
    }
    if (m.texto !== undefined) {
      if (typeof m.texto !== "string") return { ok: false, motivo: `El mensaje ${AL[clave]} tiene que ser texto.` };
      const texto = limpiarTexto(m.texto);
      if (texto.length < TEXTO_MINIMO) {
        return { ok: false, motivo: `Escribí el mensaje ${AL[clave]} (de ${TEXTO_MINIMO} a ${TEXTO_MAXIMO} caracteres).` };
      }
      if (texto.length > TEXTO_MAXIMO) {
        return {
          ok: false,
          motivo: `El mensaje ${AL[clave]} puede tener hasta ${TEXTO_MAXIMO} caracteres: en la tarjeta no entra más.`,
        };
      }
      cambio.texto = texto;
    }
    if (cambio.activo === undefined && cambio.texto === undefined) {
      return { ok: false, motivo: `El mensaje ${AL[clave]} no trae nada para cambiar («activo» o «texto»).` };
    }
    cambios[clave] = cambio;
  }
  return { ok: true, valor: cambios };
}

// ════════════════════════════════════════════════════════════════════
//  3. Lo guardado
// ════════════════════════════════════════════════════════════════════

/**
 * Los tres mensajes de la tarjeta, leídos de su fila (`select *`). Lo
 * que falta o no sirve —la columna todavía no existe, un evento sin
 * guardar, un texto roto— sale con el valor de fábrica. Nunca lanza.
 */
export function mensajesDeLaFila(fila: Record<string, unknown>): MensajesAutomaticos {
  const guardados = objetoDe(objetoDe(fila[COLUMNA_CONFIGURACION])[CLAVE_MENSAJES]);
  const uno = (evento: EventoDeMensaje): MensajeAutomatico => {
    const m = objetoDe(guardados[evento]);
    const defecto = MENSAJES_POR_DEFECTO[evento];
    return {
      activo: typeof m.activo === "boolean" ? m.activo : defecto.activo,
      texto: textoGuardado(m.texto) ?? defecto.texto,
    };
  };
  return { sumar: uno("sumar"), quitar: uno("quitar"), canjear: uno("canjear") };
}

/** Los mensajes después del cambio: lo que no vino queda como estaba. */
export function aplicarCambios(actuales: MensajesAutomaticos, cambios: CambiosDeMensajes): MensajesAutomaticos {
  const uno = (evento: EventoDeMensaje): MensajeAutomatico => ({
    activo: cambios[evento]?.activo ?? actuales[evento].activo,
    texto: cambios[evento]?.texto ?? actuales[evento].texto,
  });
  return { sumar: uno("sumar"), quitar: uno("quitar"), canjear: uno("canjear") };
}

export function mismosMensajes(a: MensajesAutomaticos, b: MensajesAutomaticos): boolean {
  return EVENTOS_DE_MENSAJE.every((e) => a[e].activo === b[e].activo && a[e].texto === b[e].texto);
}

/**
 * La bolsa `configuracion` con los mensajes nuevos adentro. Lo demás que
 * tenga (el ritmo de los clientes) se conserva tal cual.
 */
export function configuracionConMensajes(
  configuracion: unknown,
  mensajes: MensajesAutomaticos,
): Record<string, unknown> {
  return { ...objetoDe(configuracion), [CLAVE_MENSAJES]: mensajes };
}

// ════════════════════════════════════════════════════════════════════
//  4. El renglón del pase de Apple
// ════════════════════════════════════════════════════════════════════

/**
 * Qué dice el renglón «Último mensaje» del pase de Apple de una tarjeta
 * de Foorkie. Pura. null = el renglón no va.
 *
 *   · con un mensaje guardado para este cliente: ese (con su marcador);
 *   · sin mensajes todavía pero con alguno activo: «Todavía no hay
 *     mensajes.», para que el primero cambie un valor y avise;
 *   · sin nada guardado y todo apagado: no va (no se promete nada).
 */
export function mensajeParaElPase(guardado: string | null, mensajes: MensajesAutomaticos): string | null {
  if (guardado && textoVisible(guardado).trim()) return guardado;
  return EVENTOS_DE_MENSAJE.some((e) => mensajes[e].activo) ? SIN_MENSAJES_TODAVIA : null;
}

/**
 * El renglón para el pase que se está armando. La llama `generar.ts`
 * SOLO cuando la tarjeta ya es de Foorkie (la marca la decidió él).
 * Nunca rechaza: si algo falla, el pase sale sin el renglón.
 */
export async function renglonDelMensaje(
  db: SupabaseClient,
  miembroId: string,
  filaDelPrograma: Record<string, unknown>,
): Promise<string | null> {
  try {
    return mensajeParaElPase(await leerMensajeDelMiembro(db, miembroId), mensajesDeLaFila(filaDelPrograma));
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════
//  5. El motor: después de un movimiento
// ════════════════════════════════════════════════════════════════════

/** Lo que hay que avisar: el texto del restaurante y el encabezado de la marca (Google). */
export type MensajeDelEvento = { evento: EventoDeMensaje; texto: string; encabezado: string };

/**
 * Lo que hace falta ANTES del push, cuando a un cliente le pasó algo en
 * su tarjeta. Lo llama `avisarCambioDePase` (dentro de `after()`), y
 * solo si el cliente tiene algún pase.
 *
 *   1. ¿la tarjeta es de Foorkie? (la marca `lealtad_por_foorkie`). Si
 *      no —o si no se puede saber— null: el aviso de siempre, sin texto;
 *   2. ¿ese evento está activo? Si no, null;
 *   3. con pase de Apple, le deja el texto a ESTE cliente para el
 *      renglón del pase (`escribirMensajeDelMiembro`);
 *   4. devuelve el texto para que, después del refresco, salga el
 *      mensaje de Google.
 *
 * Nunca lanza: el movimiento ya está en el ledger y es lo que manda.
 */
export async function prepararMensajeDelEvento(
  db: SupabaseClient,
  miembroId: string,
  evento: EventoDeMensaje,
  { apple }: { apple: boolean },
): Promise<MensajeDelEvento | null> {
  try {
    const { data: miembro, error } = await db.from("miembros").select("programa_id").eq("id", miembroId).maybeSingle();
    const programaId = (miembro as { programa_id?: unknown } | null)?.programa_id;
    if (error || typeof programaId !== "string") return null;

    // `select *`: la columna `configuracion` puede no existir todavía.
    const { data: programa, error: errorPrograma } = await db
      .from("programa_lealtad")
      .select("*")
      .eq("id", programaId)
      .maybeSingle();
    if (errorPrograma || !programa) return null;
    const fila = programa as Record<string, unknown>;

    const local = await localDeFoorkieDeLaTarjeta(db, {
      programaId,
      ranchoId: typeof fila.rancho_id === "string" ? fila.rancho_id : null,
    });
    if (!local) return null;

    const mensaje = mensajesDeLaFila(fila)[evento];
    if (!mensaje.activo) return null;

    if (apple) await escribirMensajeDelMiembro(db, miembroId, mensaje.texto);
    return { evento, texto: mensaje.texto, encabezado: marcaDelPase(local).encabezadoMensaje };
  } catch (e) {
    console.warn("[foorkie] No se pudo preparar el mensaje automático:", e);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════
//  6. Las rutas del panel de Foorkie
// ════════════════════════════════════════════════════════════════════

/** Un rechazo con su código, el motivo y el status (la forma de `FalloDelPanel`). */
export type FalloDeMensajes = { ok: false; codigo: string; motivo: string; status: number };

export const MOTIVO_NO_ES_DE_FOORKIE =
  "Esta tarjeta no tiene la marca de Foorkie Lealtad (lealtad_por_foorkie): los mensajes automáticos son solo para esas tarjetas.";

export const MOTIVO_SIN_MIGRACION =
  "Bookea todavía no puede guardar los mensajes: falta correr la migración 0251 en Supabase. Mientras tanto salen los de fábrica.";

/** La fila de la tarjeta, si existe y es de Foorkie. */
async function tarjetaDeFoorkie(
  db: SupabaseClient,
  p: Vinculo,
): Promise<{ ok: true; fila: Record<string, unknown> } | FalloDeMensajes> {
  const { data, error } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("id", p.programaId)
    .eq("rancho_id", p.ranchoId)
    .maybeSingle();
  if (error) return { ok: false, codigo: "error_base", motivo: "No pudimos leer la tarjeta. Probá de nuevo.", status: 500 };
  if (!data) return { ok: false, codigo: "sin_programa", motivo: "Esa tarjeta no existe.", status: 404 };
  const local = await localDeFoorkieDeLaTarjeta(db, { programaId: p.programaId, ranchoId: p.ranchoId });
  if (!local) return { ok: false, codigo: "no_es_de_foorkie", motivo: MOTIVO_NO_ES_DE_FOORKIE, status: 403 };
  return { ok: true, fila: data as Record<string, unknown> };
}

export type MensajesLeidos = { ok: true; mensajes: MensajesAutomaticos };

/** `programa/mensajes`: los tres mensajes de la tarjeta (los de fábrica si nunca se guardó nada). */
export async function mensajesDeLaTarjeta(db: SupabaseClient, p: Vinculo): Promise<MensajesLeidos | FalloDeMensajes> {
  const t = await tarjetaDeFoorkie(db, p);
  if (!t.ok) return t;
  return { ok: true, mensajes: mensajesDeLaFila(t.fila) };
}

/** `cambio`: si se escribió algo (la ruta refresca entonces los pases instalados). */
export type MensajesGuardados = MensajesLeidos & { cambio: boolean };

/**
 * `programa/mensajes/guardar`: aplica los cambios y guarda los tres
 * mensajes completos. Sin cambios de verdad no escribe nada. Se relee la
 * bolsa entera y se reescribe con lo demás tal cual (como `guardarRitmo`).
 */
export async function guardarMensajesDeLaTarjeta(
  db: SupabaseClient,
  p: Vinculo & { cambios: CambiosDeMensajes },
): Promise<MensajesGuardados | FalloDeMensajes> {
  const t = await tarjetaDeFoorkie(db, p);
  if (!t.ok) return t;
  // Con `select *`, una columna que no existe no viene en la fila.
  if (!(COLUMNA_CONFIGURACION in t.fila)) {
    return { ok: false, codigo: "sin_migracion", motivo: MOTIVO_SIN_MIGRACION, status: 503 };
  }

  const actuales = mensajesDeLaFila(t.fila);
  const nuevos = aplicarCambios(actuales, p.cambios);
  if (mismosMensajes(actuales, nuevos)) return { ok: true, mensajes: nuevos, cambio: false };

  const { error } = await db
    .from("programa_lealtad")
    .update({ [COLUMNA_CONFIGURACION]: configuracionConMensajes(t.fila[COLUMNA_CONFIGURACION], nuevos) })
    .eq("id", p.programaId)
    .eq("rancho_id", p.ranchoId);
  if (error) {
    if (esColumnaAusente(error, [COLUMNA_CONFIGURACION])) {
      return { ok: false, codigo: "sin_migracion", motivo: MOTIVO_SIN_MIGRACION, status: 503 };
    }
    return { ok: false, codigo: "rechazado", motivo: traducirError(error, "guardar los mensajes"), status: 400 };
  }
  return { ok: true, mensajes: nuevos, cambio: true };
}
