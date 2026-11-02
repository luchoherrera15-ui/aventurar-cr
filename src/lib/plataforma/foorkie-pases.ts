import type { SupabaseClient } from "@supabase/supabase-js";
import { paseGoogleGuardado } from "@/lib/wallet/google";

type Db = SupabaseClient;

/**
 * ════════════════════════════════════════════════════════════════════
 *  ¿EL CLIENTE TIENE EL PASE EN EL TELÉFONO? — para la ficha de Foorkie
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del 19 oct 2026: en la ficha del cliente del panel de Foorkie
 * (`clientes/detalle`), saber si esa persona tiene instalado el pase de
 * la tarjeta en su Wallet. Solo LEE: nada de acá escribe en la base ni
 * en Google.
 *
 * ── CÓMO SE SABE ────────────────────────────────────────────────────
 *   Apple   iOS registra el teléfono en `registros_dispositivo` apenas se
 *           agrega el pase y lo borra (DELETE) cuando se quita (ver
 *           `/api/wallet/v1/devices/.../registrations/...`). Con al menos
 *           un registro del serial → «instalado»; sin ninguno →
 *           «no_instalado» (se emitió pero no está en ningún teléfono:
 *           nunca lo agregó o lo quitó).
 *   Google  no hay registro de teléfonos: se le pregunta a Google por el
 *           objeto (`paseGoogleGuardado`, `hasUsers`). true → «instalado»,
 *           false → «no_instalado», sin respuesta → «sin_confirmar».
 *
 * ── QUÉ FILA CUENTA ─────────────────────────────────────────────────
 * Una por plataforma. Después de una fusión de personas (0138) un
 * miembro puede tener varias (las heredadas, con `activo = false`): manda
 * la activa y, si no hay activa, la más nueva.
 *
 * ── LO QUE SALE ─────────────────────────────────────────────────────
 * Solo el estado y sus fechas. Nunca el serial, el token del pase, el
 * token de push ni nada del dispositivo.
 */

export type PlataformaPase = "apple" | "google";
export type EstadoPase = "instalado" | "no_instalado" | "sin_confirmar";

export type PaseDelCliente = {
  plataforma: PlataformaPase;
  estado: EstadoPase;
  /** Cuándo se emitió el pase la primera vez (`pases_wallet.created_at`). */
  pedido: string;
  /** Apple: cuándo se agregó al teléfono (el registro más viejo del serial). Google: null. */
  desde: string | null;
  /** Apple: en cuántos teléfonos está. Google: null. */
  dispositivos: number | null;
  /** Apple: la última vez que un teléfono bajó el pase (`ultima_descarga_en`, 0151). Google: null. */
  ultima_vez: string | null;
};

/** Una fila de `pases_wallet`, con lo que hace falta y nada más. */
export type FilaDePase = {
  id: string;
  plataforma: PlataformaPase;
  serial: string;
  activo: boolean;
  created_at: string;
  ultima_descarga_en: string | null;
  objeto_externo: string | null;
};

/** Un registro de `registros_dispositivo`: de qué serial es y cuándo se agregó. */
export type RegistroDelPase = { serial: string; created_at: string };

const PLATAFORMAS: readonly PlataformaPase[] = ["apple", "google"];

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** La fecha tal cual la usa el resto de las respuestas a Foorkie (ISO en UTC); si no se entiende, como vino. */
function aIso(fecha: string): string {
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? fecha : d.toISOString();
}

function momento(fecha: string): number {
  const t = Date.parse(fecha);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/**
 * Una fila cruda de `pases_wallet`. `activo` (0138) y `ultima_descarga_en`
 * (0151) pueden no existir en una base vieja: sin `activo` toda fila
 * cuenta como activa (antes de la 0138 había UNA por plataforma).
 */
export function filaDePase(v: unknown): FilaDePase | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const plataforma = PLATAFORMAS.find((p) => p === r.plataforma);
  const id = texto(r.id);
  const serial = texto(r.serial_number);
  const creado = texto(r.created_at);
  if (!plataforma || !id || !serial || !creado) return null;
  return {
    id,
    plataforma,
    serial,
    activo: r.activo !== false,
    created_at: creado,
    ultima_descarga_en: texto(r.ultima_descarga_en),
    objeto_externo: texto(r.objeto_externo),
  };
}

/** Una por plataforma (Apple primero): la activa y, si no hay, la más nueva. */
export function elegirPasesPorPlataforma(filas: readonly FilaDePase[]): FilaDePase[] {
  const elegidas: FilaDePase[] = [];
  for (const plataforma of PLATAFORMAS) {
    const suyas = filas.filter((f) => f.plataforma === plataforma);
    if (suyas.length === 0) continue;
    const orden = [...suyas].sort(
      (a, b) =>
        Number(b.activo) - Number(a.activo) ||
        momento(b.created_at) - momento(a.created_at) ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
    elegidas.push(orden[0]);
  }
  return elegidas;
}

/**
 * Lo que sale a Foorkie, a partir de lo leído: las filas del miembro, los
 * registros de teléfonos de los seriales de Apple y lo que contestó Google
 * (`true` | `false` | `null` = no se sabe).
 */
export function armarPasesDelCliente(d: {
  filas: readonly FilaDePase[];
  registros: readonly RegistroDelPase[];
  googleGuardado: boolean | null;
}): PaseDelCliente[] {
  return elegirPasesPorPlataforma(d.filas).map((f) => {
    if (f.plataforma === "apple") {
      const suyos = d.registros.filter((r) => r.serial === f.serial);
      const masViejo = suyos.reduce<string | null>(
        (min, r) => (min === null || momento(r.created_at) < momento(min) ? r.created_at : min),
        null,
      );
      return {
        plataforma: "apple",
        estado: suyos.length > 0 ? "instalado" : "no_instalado",
        pedido: aIso(f.created_at),
        desde: masViejo === null ? null : aIso(masViejo),
        dispositivos: suyos.length,
        ultima_vez: f.ultima_descarga_en === null ? null : aIso(f.ultima_descarga_en),
      };
    }
    return {
      plataforma: "google",
      estado: d.googleGuardado === true ? "instalado" : d.googleGuardado === false ? "no_instalado" : "sin_confirmar",
      pedido: aIso(f.created_at),
      desde: null,
      dispositivos: null,
      ultima_vez: null,
    };
  });
}

/** Tope de registros que se leen por serial: un pase está en uno o dos teléfonos, no en cientos. */
const TOPE_REGISTROS = 200;

/** ¿Lo guardó alguien en Google? Inyectable para las pruebas; por defecto, la consulta real. */
export type ConsultaGoogle = (miembroId: string, objetoExterno: string | null) => Promise<boolean | null>;

/**
 * Los pases del miembro, listos para la ficha. `null` = no se pudo leer
 * `pases_wallet` o `registros_dispositivo` (la ficha sigue sin esto);
 * `[]` = no tiene pases. Google, si no contesta, queda «sin_confirmar».
 * Nunca rechaza.
 */
export async function pasesDelCliente(
  db: Db,
  miembroId: string,
  consultarGoogle?: ConsultaGoogle,
): Promise<PaseDelCliente[] | null> {
  try {
    // El de por defecto se elige ADENTRO del try: ni eso puede hacer rechazar a esta función.
    const preguntar = consultarGoogle ?? paseGoogleGuardado;
    // `select *` y no por nombre: `activo`, `objeto_externo` (0138) y
    // `ultima_descarga_en` (0151) pueden no estar en una base vieja.
    const { data, error } = await db.from("pases_wallet").select("*").eq("miembro_id", miembroId);
    if (error) return null;
    const filas = ((data ?? []) as unknown[]).map(filaDePase).filter((f): f is FilaDePase => f !== null);
    const elegidas = elegirPasesPorPlataforma(filas);
    if (elegidas.length === 0) return [];

    const apple = elegidas.find((f) => f.plataforma === "apple");
    const google = elegidas.find((f) => f.plataforma === "google");

    const leerRegistros = async (): Promise<RegistroDelPase[] | null> => {
      if (!apple) return [];
      const r = await db
        .from("registros_dispositivo")
        .select("serial_number, created_at")
        .eq("serial_number", apple.serial)
        .limit(TOPE_REGISTROS);
      if (r.error) return null;
      return ((r.data ?? []) as Record<string, unknown>[])
        .map((x) => ({ serial: texto(x.serial_number), created_at: texto(x.created_at) }))
        .filter((x): x is RegistroDelPase => x.serial !== null && x.created_at !== null);
    };
    const preguntarAGoogle = async (): Promise<boolean | null> => {
      if (!google) return null;
      try {
        return await preguntar(miembroId, google.objeto_externo);
      } catch {
        return null;
      }
    };

    const [registros, googleGuardado] = await Promise.all([leerRegistros(), preguntarAGoogle()]);
    if (registros === null) return null;
    return armarPasesDelCliente({ filas: elegidas, registros, googleGuardado });
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════
//  EN LA LISTA DE CLIENTES — ¿quién tiene la tarjeta en el teléfono?
// ════════════════════════════════════════════════════════════════════
//
// Pedido del 2 nov 2026 (Luis: «¿Podemos ver quiénes tienen la tarjeta
// descargada?»): en la LISTA de clientes de Foorkie (`clientes`), de cada
// uno, si tiene la tarjeta en el teléfono. Solo LEE, igual que la ficha,
// pero sin preguntarle a Google: serían cientos de llamadas por página.
//
//   apple   «instalado» / «no_instalado», con la misma regla que la ficha
//           (al menos un teléfono en `registros_dispositivo`).
//   google  «pedido»: tocó «Agregar a Google Wallet» y el pase se emitió
//           (`google.ts` crea la fila en ese momento). Si después lo
//           guardó o lo borró, Google no avisa: eso lo dice la ficha.
//   null    nunca pidió el pase de esa plataforma.

export type PaseEnLaLista = { apple: "instalado" | "no_instalado" | null; google: "pedido" | null };

export const SIN_PASE: PaseEnLaLista = { apple: null, google: null };

/** Una fila de `pases_wallet` con su miembro (la lista lee los de muchos a la vez). */
export type FilaDePaseDeMiembro = FilaDePase & { miembro_id: string };

export function filaDePaseDeMiembro(v: unknown): FilaDePaseDeMiembro | null {
  const f = filaDePase(v);
  const miembro = f ? texto((v as Record<string, unknown>).miembro_id) : null;
  return f && miembro ? { ...f, miembro_id: miembro } : null;
}

/**
 * El pase de cada miembro pedido, a partir de sus filas y de los seriales
 * de Apple que tienen al menos un teléfono registrado. Cada miembro pedido
 * sale en el mapa (sin filas, `SIN_PASE`).
 */
export function armarPasesDeLaLista(d: {
  miembros: readonly string[];
  filas: readonly FilaDePaseDeMiembro[];
  conTelefono: ReadonlySet<string>;
}): Map<string, PaseEnLaLista> {
  const porMiembro = new Map<string, FilaDePaseDeMiembro[]>();
  for (const f of d.filas) porMiembro.set(f.miembro_id, [...(porMiembro.get(f.miembro_id) ?? []), f]);
  const mapa = new Map<string, PaseEnLaLista>();
  for (const id of d.miembros) {
    const pase: PaseEnLaLista = { ...SIN_PASE };
    for (const f of elegirPasesPorPlataforma(porMiembro.get(id) ?? [])) {
      if (f.plataforma === "apple") pase.apple = d.conTelefono.has(f.serial) ? "instalado" : "no_instalado";
      else pase.google = "pedido";
    }
    mapa.set(id, pase);
  }
  return mapa;
}

/** De a cuántos se pregunta con `in (…)`: con cien uuids la URL ya es larga. */
const POR_TANDA = 100;
/** El `max_rows` de PostgREST: una tanda que llega a esto pudo venir cortada. */
const TOPE_FILAS = 1000;

/**
 * El pase de cada uno de estos miembros (una página de la lista). `null` =
 * no se pudo leer `pases_wallet` o `registros_dispositivo` (la lista sigue
 * sin esto). Nunca rechaza.
 */
export async function pasesDeLaLista(db: Db, miembros: readonly string[]): Promise<Map<string, PaseEnLaLista> | null> {
  try {
    const ids = [...new Set(miembros)];
    if (ids.length === 0) return new Map();
    const filas: FilaDePaseDeMiembro[] = [];
    for (let i = 0; i < ids.length; i += POR_TANDA) {
      // `select *` por lo mismo que la ficha: `activo` y `objeto_externo` (0138) pueden faltar en una base vieja.
      const { data, error } = await db.from("pases_wallet").select("*").in("miembro_id", ids.slice(i, i + POR_TANDA));
      if (error || (data ?? []).length >= TOPE_FILAS) return null;
      for (const v of (data ?? []) as unknown[]) {
        const f = filaDePaseDeMiembro(v);
        if (f) filas.push(f);
      }
    }
    // Solo los seriales que cuentan: el pase de Apple elegido de cada miembro.
    const seriales = ids.flatMap((id) =>
      elegirPasesPorPlataforma(filas.filter((f) => f.miembro_id === id))
        .filter((f) => f.plataforma === "apple")
        .map((f) => f.serial),
    );
    const conTelefono = new Set<string>();
    for (let i = 0; i < seriales.length; i += POR_TANDA) {
      const { data, error } = await db
        .from("registros_dispositivo")
        .select("serial_number")
        .in("serial_number", seriales.slice(i, i + POR_TANDA));
      if (error || (data ?? []).length >= TOPE_FILAS) return null;
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        const s = texto(r.serial_number);
        if (s) conTelefono.add(s);
      }
    }
    return armarPasesDeLaLista({ miembros: ids, filas, conTelefono });
  } catch {
    return null;
  }
}
