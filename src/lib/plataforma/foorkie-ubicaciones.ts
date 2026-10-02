import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lectura, Vinculo } from "@/lib/plataforma/foorkie-caja";
import { localDeFoorkieDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";
import { limpiarTexto } from "@/lib/plataforma/foorkie-mensajes";
import { COLUMNA_LEALTAD_POR_FOORKIE } from "@/lib/plataforma/negocio-de-foorkie";
import { traducirError, type ErrorBase } from "@/lib/lealtad/errores-base";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS UBICACIONES DE UNA TARJETA DE FOORKIE — el aviso por cercanía
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (2 oct 2026): el aviso por cercanía (geo push) en las
 * tarjetas de Foorkie. En el iPhone la tarjeta aparece en la pantalla
 * bloqueada cuando el cliente pasa cerca del local (~100 m, lo fija iOS).
 * El pase ya lo sabe hacer (`pass.locations` en `wallet/tarjeta.ts`, con
 * las ubicaciones registradas de la 0196); lo que faltaba es que Foorkie
 * pudiera registrarlas, porque su restaurante nunca entra al panel de
 * Bookea. Lo hace por `programa/ubicaciones` y `programa/ubicaciones/guardar`.
 *
 * ── SON DEL NEGOCIO, NO DE LA TARJETA ───────────────────────────────
 * `lealtad_ubicaciones` (0196) es POR NEGOCIO (rancho): el local queda
 * donde queda sin importar cuántas tarjetas emita, y `generar.ts` las lee
 * por rancho para todos sus pases. Por eso la ruta pide la tarjeta (para
 * la guardia) pero lee y reemplaza las del negocio, y al guardar refresca
 * los pases de TODAS sus tarjetas.
 *
 * ── SOLO TARJETAS DE FOORKIE ────────────────────────────────────────
 * La tarjeta tiene que tener la marca `lealtad_por_foorkie`
 * (`localDeFoorkieDeLaTarjeta`, la misma guardia del pase y de los
 * mensajes): vinculada sin la marca —Pura Matcha— contesta
 * `no_es_de_foorkie` y no se lee ni se toca nada. Y como guardar cambia
 * el pase de todas las tarjetas del negocio, para ESCRIBIR también tienen
 * que ser de Foorkie todas las demás tarjetas de ese negocio: si alguna
 * es de Bookea, `negocio_compartido` y no se escribe nada.
 *
 * ── QUÉ SE PUEDE MANDAR ─────────────────────────────────────────────
 * De 0 a 10 (el techo de Apple por pase, que la 0196 también remacha con
 * un trigger). El tope del paquete de Bookea (`LimitesPlan.ubicaciones`)
 * no se aplica acá: la lealtad la vende Foorkie, con sus planes. Cada
 * una: latitud (−90..90), longitud (−180..180) y un mensaje de 3 a 80
 * caracteres en una línea, que es lo que se lee en la pantalla bloqueada
 * (`relevantText`). `nombre` es opcional (hasta 80): es como la ve un
 * admin en la lista del negocio; sin él, el mensaje. Las coordenadas se
 * guardan con 6 decimales (unos 11 cm).
 *
 * ── REEMPLAZAR SIN DEJAR AL NEGOCIO A MEDIAS ────────────────────────
 * No hay transacción por PostgREST, así que se escribe solo la diferencia
 * (`planDeReemplazo`): lo que ya está igual se queda, sobra lo que se
 * borra y falta lo que se inserta. Si entra junto, primero se inserta y
 * después se borra (si falla el insert, no cambió nada); si no entra (el
 * trigger corta en 10), primero se borra y, si el insert falla, se
 * devuelven las que estaban. Mandar lo mismo dos veces no escribe nada y
 * no refresca ningún pase.
 *
 * Google Wallet no tiene un aviso por cercanía igual (`google.ts` no
 * escribe ubicaciones): esto es solo para el iPhone.
 */

type Db = SupabaseClient;

/** El techo de Apple: un pase lleva 10 ubicaciones como máximo (la 0196 lo remacha). */
export const MAX_UBICACIONES = 10;
/** El mensaje de la pantalla bloqueada: corto, que se lea de un vistazo. */
export const MENSAJE_MINIMO = 3;
export const MENSAJE_MAXIMO = 80;
/** El CHECK de `nombre` en la 0196. */
export const NOMBRE_MAXIMO = 80;

const TABLA = "lealtad_ubicaciones";
const COLUMNAS = "id, nombre, latitud, longitud, mensaje";

/** Una ubicación como la manda y la recibe Foorkie. */
export type UbicacionDeFoorkie = { latitud: number; longitud: number; mensaje: string; nombre: string };

/** Una fila de `lealtad_ubicaciones`. */
export type FilaDeUbicacion = UbicacionDeFoorkie & { id: string };

/** Un rechazo con su código, el motivo y el status (la forma de `FalloDelPanel`). */
export type FalloDeUbicaciones = { ok: false; codigo: string; motivo: string; status: number };

// ════════════════════════════════════════════════════════════════════
//  1. Lo que manda Foorkie
// ════════════════════════════════════════════════════════════════════

/** Seis decimales: unos 11 cm. El iPhone avisa a unos 100 m. */
export function redondear(coordenada: number): number {
  const r = Math.round(coordenada * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

/** Lo que identifica a una ubicación: si es igual en todo, no hace falta reescribirla. */
export function claveDeUbicacion(u: UbicacionDeFoorkie): string {
  return JSON.stringify([redondear(u.latitud), redondear(u.longitud), u.mensaje, u.nombre]);
}

function enRango(v: unknown, minimo: number, maximo: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= minimo && v <= maximo;
}

/**
 * La forma de `ubicaciones` en `programa/ubicaciones/guardar`:
 *
 *   [{ latitud, longitud, mensaje, nombre? }]   de 0 a 10
 *
 * Es la lista COMPLETA (lo que no viene se borra) y puede ir vacía. Una
 * repetida (mismas coordenadas, mensaje y nombre) va una sola vez: no se
 * gasta un lugar de los 10 de Apple en el mismo punto.
 */
export function leerUbicaciones(v: unknown): Lectura<UbicacionDeFoorkie[]> {
  if (!Array.isArray(v)) {
    return { ok: false, motivo: "Mandá las ubicaciones como una lista (vacía si no va ninguna)." };
  }
  if (v.length > MAX_UBICACIONES) {
    return { ok: false, motivo: `Apple Wallet acepta ${MAX_UBICACIONES} ubicaciones por tarjeta como máximo.` };
  }
  const lista: UbicacionDeFoorkie[] = [];
  const vistas = new Set<string>();
  for (const [i, crudo] of v.entries()) {
    const n = i + 1;
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) {
      return { ok: false, motivo: `La ubicación ${n} tiene que traer latitud, longitud y mensaje.` };
    }
    const u = crudo as Record<string, unknown>;
    if (!enRango(u.latitud, -90, 90)) {
      return { ok: false, motivo: `La latitud de la ubicación ${n} tiene que ser un número entre -90 y 90.` };
    }
    if (!enRango(u.longitud, -180, 180)) {
      return { ok: false, motivo: `La longitud de la ubicación ${n} tiene que ser un número entre -180 y 180.` };
    }
    if (typeof u.mensaje !== "string") return { ok: false, motivo: `Escribí el mensaje de la ubicación ${n}.` };
    const mensaje = limpiarTexto(u.mensaje);
    if (mensaje.length < MENSAJE_MINIMO) {
      return {
        ok: false,
        motivo: `Escribí el mensaje de la ubicación ${n} (de ${MENSAJE_MINIMO} a ${MENSAJE_MAXIMO} caracteres).`,
      };
    }
    if (mensaje.length > MENSAJE_MAXIMO) {
      return {
        ok: false,
        motivo: `El mensaje de la ubicación ${n} puede tener hasta ${MENSAJE_MAXIMO} caracteres: en la pantalla bloqueada no entra más.`,
      };
    }
    let nombre = mensaje;
    if (u.nombre !== undefined && u.nombre !== null) {
      if (typeof u.nombre !== "string") return { ok: false, motivo: `El nombre de la ubicación ${n} tiene que ser texto.` };
      const limpio = limpiarTexto(u.nombre);
      if (limpio.length > NOMBRE_MAXIMO) {
        return { ok: false, motivo: `El nombre de la ubicación ${n} puede tener hasta ${NOMBRE_MAXIMO} caracteres.` };
      }
      if (limpio) nombre = limpio;
    }
    const ubicacion = { latitud: redondear(u.latitud), longitud: redondear(u.longitud), mensaje, nombre };
    const clave = claveDeUbicacion(ubicacion);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    lista.push(ubicacion);
  }
  return { ok: true, valor: lista };
}

// ════════════════════════════════════════════════════════════════════
//  2. Lo guardado y la diferencia
// ════════════════════════════════════════════════════════════════════

/** Una fila de la tabla, como llega (sin confiar en los tipos). null = no sirve. */
export function filaDeUbicacion(v: unknown): FilaDeUbicacion | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  const latitud = Number(f.latitud);
  const longitud = Number(f.longitud);
  if (typeof f.id !== "string" || !Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  const mensaje = typeof f.mensaje === "string" ? f.mensaje.trim() : "";
  if (!mensaje) return null;
  const nombre = typeof f.nombre === "string" && f.nombre.trim() ? f.nombre.trim() : mensaje;
  return { id: f.id, latitud: redondear(latitud), longitud: redondear(longitud), mensaje, nombre };
}

/** Lo que ve Foorkie de una fila: sin el id de Bookea. */
export function sinId({ latitud, longitud, mensaje, nombre }: UbicacionDeFoorkie): UbicacionDeFoorkie {
  return { latitud, longitud, mensaje, nombre };
}

export type PlanDeReemplazo = {
  /** Las filas que ya no van (o que estaban repetidas). */
  borrar: FilaDeUbicacion[];
  /** Las que faltan. */
  insertar: UbicacionDeFoorkie[];
  /** true = entran todas juntas bajo el techo: primero se inserta, después se borra. */
  insertarPrimero: boolean;
};

/**
 * La diferencia entre lo guardado y lo pedido. Pura. Lo que ya está igual
 * no se toca; una fila repetida en la base se borra (la lista final es
 * exactamente la pedida, cada una una vez).
 */
export function planDeReemplazo(
  actuales: readonly FilaDeUbicacion[],
  nuevas: readonly UbicacionDeFoorkie[],
): PlanDeReemplazo {
  const pedidas = new Set(nuevas.map(claveDeUbicacion));
  const quedan = new Set<string>();
  const borrar: FilaDeUbicacion[] = [];
  for (const fila of actuales) {
    const clave = claveDeUbicacion(fila);
    if (pedidas.has(clave) && !quedan.has(clave)) quedan.add(clave);
    else borrar.push(fila);
  }
  const insertar = nuevas.filter((u) => !quedan.has(claveDeUbicacion(u)));
  return { borrar, insertar, insertarPrimero: actuales.length + insertar.length <= MAX_UBICACIONES };
}

// ════════════════════════════════════════════════════════════════════
//  3. La base
// ════════════════════════════════════════════════════════════════════

export const MOTIVO_NO_ES_DE_FOORKIE =
  "Esta tarjeta no tiene la marca de Foorkie Lealtad (lealtad_por_foorkie): las ubicaciones desde Foorkie son solo para esas tarjetas.";

export const MOTIVO_NEGOCIO_COMPARTIDO =
  "Las ubicaciones son de todo el negocio y este negocio tiene tarjetas que no son de Foorkie Lealtad: no se pueden cambiar desde Foorkie.";

export const MOTIVO_SIN_MIGRACION =
  "Bookea todavía no puede guardar ubicaciones: falta correr la migración 0196 en Supabase.";

const ERROR_AL_LEER: FalloDeUbicaciones = {
  ok: false,
  codigo: "error_base",
  motivo: "No pudimos leer las ubicaciones. Probá de nuevo.",
  status: 500,
};

/** ¿La base dice que la TABLA no existe? Mismo criterio que `faltaLaTablaUbicaciones` del panel de Bookea. */
function faltaLaTabla(error: ErrorBase): boolean {
  const mensaje = error.message;
  if (!mensaje.includes(TABLA)) return false;
  return mensaje.includes("does not exist") || mensaje.includes("schema cache") || mensaje.includes("Could not find");
}

function rechazo(error: ErrorBase): FalloDeUbicaciones {
  if (faltaLaTabla(error)) return { ok: false, codigo: "sin_migracion", motivo: MOTIVO_SIN_MIGRACION, status: 503 };
  return { ok: false, codigo: "rechazado", motivo: traducirError(error, "guardar las ubicaciones"), status: 400 };
}

/** Las del negocio, en el orden en que se registraron (el mismo que lleva el pase). */
async function lasDelNegocio(db: Db, ranchoId: string): Promise<{ ok: true; filas: FilaDeUbicacion[] } | FalloDeUbicaciones> {
  const { data, error } = await db
    .from(TABLA)
    .select(COLUMNAS)
    .eq("rancho_id", ranchoId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    return faltaLaTabla(error)
      ? { ok: false, codigo: "sin_migracion", motivo: MOTIVO_SIN_MIGRACION, status: 503 }
      : ERROR_AL_LEER;
  }
  return {
    ok: true,
    filas: ((data ?? []) as unknown[]).map(filaDeUbicacion).filter((f): f is FilaDeUbicacion => f !== null),
  };
}

/**
 * Las tarjetas del negocio y cuántas NO son de Foorkie (ningún local las
 * tiene vinculadas con la marca, o las tiene con otro negocio: el mismo
 * criterio que `elegirLocalDeFoorkie`). Si no se puede saber, error: ante
 * la duda no se escribe.
 */
async function tarjetasDelNegocio(
  db: Db,
  ranchoId: string,
): Promise<{ ok: true; programas: string[]; ajenas: number } | FalloDeUbicaciones> {
  const { data, error } = await db.from("programa_lealtad").select("id").eq("rancho_id", ranchoId);
  if (error) return ERROR_AL_LEER;
  const programas = ((data ?? []) as { id?: unknown }[])
    .map((f) => f.id)
    .filter((id): id is string => typeof id === "string");
  if (programas.length === 0) return { ok: true, programas, ajenas: 0 };

  const { data: locales, error: errorLocales } = await db
    .from("foorkie_restaurantes")
    .select("bookea_programa_id, bookea_rancho_id")
    .in("bookea_programa_id", programas)
    .eq(COLUMNA_LEALTAD_POR_FOORKIE, true);
  if (errorLocales) return ERROR_AL_LEER;
  const deFoorkie = new Set(
    ((locales ?? []) as { bookea_programa_id?: unknown; bookea_rancho_id?: unknown }[])
      .filter((l) => l.bookea_rancho_id === null || l.bookea_rancho_id === undefined || l.bookea_rancho_id === ranchoId)
      .map((l) => l.bookea_programa_id),
  );
  return { ok: true, programas, ajenas: programas.filter((id) => !deFoorkie.has(id)).length };
}

/** La guardia de las dos rutas: la tarjeta tiene que ser de Foorkie. */
async function guardia(db: Db, p: Vinculo): Promise<FalloDeUbicaciones | null> {
  const local = await localDeFoorkieDeLaTarjeta(db, { programaId: p.programaId, ranchoId: p.ranchoId });
  return local ? null : { ok: false, codigo: "no_es_de_foorkie", motivo: MOTIVO_NO_ES_DE_FOORKIE, status: 403 };
}

export type UbicacionesLeidas = { ok: true; ubicaciones: UbicacionDeFoorkie[] };

/** `programa/ubicaciones`: las del negocio de esa tarjeta. */
export async function ubicacionesDeLaTarjeta(db: Db, p: Vinculo): Promise<UbicacionesLeidas | FalloDeUbicaciones> {
  const rechazada = await guardia(db, p);
  if (rechazada) return rechazada;
  const leidas = await lasDelNegocio(db, p.ranchoId);
  if (!leidas.ok) return leidas;
  return { ok: true, ubicaciones: leidas.filas.map(sinId) };
}

/**
 * El resultado de guardar. `refrescar` son las tarjetas cuyos pases hay
 * que refrescar (todas las del negocio si cambió algo, aunque haya
 * quedado a medias; ninguna si no cambió nada): la ruta se lo pasa a
 * `avisarCambioDeDiseno` después de responder.
 */
export type GuardadoDeUbicaciones =
  | (UbicacionesLeidas & { cambio: boolean; refrescar: string[] })
  | (FalloDeUbicaciones & { refrescar: string[] });

/**
 * `programa/ubicaciones/guardar`: deja en el negocio exactamente la lista
 * pedida (ver la cabecera: solo la diferencia, en el orden que no lo deja
 * a medias) y devuelve cómo quedó.
 */
export async function guardarUbicacionesDeLaTarjeta(
  db: Db,
  p: Vinculo & { ubicaciones: UbicacionDeFoorkie[] },
): Promise<GuardadoDeUbicaciones> {
  const nada: string[] = [];
  const rechazada = await guardia(db, p);
  if (rechazada) return { ...rechazada, refrescar: nada };

  const negocio = await tarjetasDelNegocio(db, p.ranchoId);
  if (!negocio.ok) return { ...negocio, refrescar: nada };
  if (negocio.ajenas > 0) {
    return { ok: false, codigo: "negocio_compartido", motivo: MOTIVO_NEGOCIO_COMPARTIDO, status: 409, refrescar: nada };
  }

  const actuales = await lasDelNegocio(db, p.ranchoId);
  if (!actuales.ok) return { ...actuales, refrescar: nada };

  const plan = planDeReemplazo(actuales.filas, p.ubicaciones);
  if (plan.borrar.length === 0 && plan.insertar.length === 0) {
    return { ok: true, ubicaciones: actuales.filas.map(sinId), cambio: false, refrescar: nada };
  }

  const escrito = await reemplazar(db, p.ranchoId, plan);
  const refrescar = escrito.cambio ? negocio.programas : nada;
  if (!escrito.ok) return { ...escrito.fallo, refrescar };

  const finales = await lasDelNegocio(db, p.ranchoId);
  // Ya se guardó: si la relectura falla, se contesta con lo pedido, que es lo que quedó.
  const ubicaciones = finales.ok ? finales.filas.map(sinId) : p.ubicaciones.map(sinId);
  return { ok: true, ubicaciones, cambio: true, refrescar };
}

/** Las filas para insertar en el negocio. */
function filasParaInsertar(ranchoId: string, lista: readonly UbicacionDeFoorkie[]) {
  return lista.map((u) => ({
    rancho_id: ranchoId,
    nombre: u.nombre,
    latitud: u.latitud,
    longitud: u.longitud,
    mensaje: u.mensaje,
  }));
}

/**
 * Escribe la diferencia. `cambio` dice si lo que lleva el pase quedó
 * distinto de como estaba (aunque haya fallado a medias): entonces hay
 * que refrescar los pases.
 */
async function reemplazar(
  db: Db,
  ranchoId: string,
  plan: PlanDeReemplazo,
): Promise<{ ok: true; cambio: true } | { ok: false; fallo: FalloDeUbicaciones; cambio: boolean }> {
  const insertar = async (lista: readonly UbicacionDeFoorkie[]): Promise<ErrorBase | null> => {
    if (lista.length === 0) return null;
    const { error } = await db.from(TABLA).insert(filasParaInsertar(ranchoId, lista));
    return error;
  };
  const borrar = async (): Promise<ErrorBase | null> => {
    if (plan.borrar.length === 0) return null;
    const ids = plan.borrar.map((f) => f.id);
    const { error } = await db.from(TABLA).delete().eq("rancho_id", ranchoId).in("id", ids);
    return error;
  };

  if (plan.insertarPrimero) {
    const alInsertar = await insertar(plan.insertar);
    if (alInsertar) return { ok: false, fallo: rechazo(alInsertar), cambio: false };
    const alBorrar = await borrar();
    if (alBorrar) {
      // Quedaron las nuevas y también las que sobraban: reintentar lo termina (solo borra lo que sobra).
      return {
        ok: false,
        fallo: { ...rechazo(alBorrar), motivo: "Guardamos las ubicaciones nuevas pero no pudimos sacar las viejas. Probá de nuevo." },
        cambio: plan.insertar.length > 0,
      };
    }
    return { ok: true, cambio: true };
  }

  // No entran juntas bajo el techo de 10: primero se borra.
  const alBorrar = await borrar();
  if (alBorrar) return { ok: false, fallo: rechazo(alBorrar), cambio: false };
  const alInsertar = await insertar(plan.insertar);
  if (!alInsertar) return { ok: true, cambio: true };
  // Se borró y lo nuevo no entró: se devuelven las que estaban, para no dejar al negocio sin aviso.
  const alDevolver = await insertar(plan.borrar);
  return { ok: false, fallo: rechazo(alInsertar), cambio: alDevolver !== null };
}
