import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentidadCliente } from "@/lib/lealtad/identidad-miembro";
import { identidadesDeMiembros } from "@/lib/lealtad/identidades-db";
import {
  ausente,
  leerVinculo,
  uuidDe,
  type Lectura,
  type Vinculo,
} from "@/lib/plataforma/foorkie-caja";
import { localDeFoorkieDeLaTarjeta } from "@/lib/plataforma/foorkie-marca";
import { esAnterior, filaDeMiembroDelPanel, type FalloDelPanel } from "@/lib/plataforma/foorkie-panel";

type Db = SupabaseClient;

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL CONTACTO DE LOS CLIENTES QUE ACEPTARON QUE EL NEGOCIO LOS CONTACTE
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (13 oct 2026), mirando la base de clientes de Pura
 * Matcha en el panel de Foorkie: «la idea es que se puedan ver los
 * números de teléfono y los correos, y poder exportarlos a Excel».
 *
 * Hasta hoy el panel de Foorkie nunca vio un contacto completo: `clientes`
 * y `clientes/detalle` devuelven el correo y el teléfono enmascarados
 * («l***@gmail.com», «****-7777») y eso no cambia. Esta ruta es la única
 * que entrega un contacto entero, y lo hace con una sola regla:
 *
 *     el contacto de una persona sale SOLO si esa persona aceptó que ESTE
 *     negocio le escriba por ESE canal.
 *
 * ── QUÉ ES «ACEPTÓ» ─────────────────────────────────────────────────
 * Exactamente lo que dice `persona_acepta` (0138), la función con la que
 * la web, la app y los jobs deciden si se le puede escribir a alguien:
 * por canal ('correo' | 'whatsapp'),
 *
 *   · la última fila de la plataforma (`ambito = 'bookea'`) revocada → NO
 *     (se bajó de todo);
 *   · la última fila de ESTE negocio (`ambito = 'negocio'`, por su rancho
 *     o su cuenta) aceptada → SÍ;
 *   · sin filas → NO. Acá el silencio NO es un permiso: quien entró por un
 *     QR vio una casilla explícita, y quien no la marcó no la marcó.
 *
 * Escrita acá otra vez, en lotes, porque `persona_acepta` es de a una
 * persona: cien llamadas por página de clientes no tienen sentido. Es la
 * MISMA cuenta (el orden es `created_at` desc y `id` desc, con los
 * microsegundos de la base), y la prueba la fija caso por caso.
 *
 * El correo suprimido (rebote o queja, `supresiones_correo`) NO cambia
 * esto: que un buzón rebote no le quita al negocio el permiso de ver cómo
 * se llama su cliente, y le conviene saberlo. Quien mande correos sigue
 * pasando por `persona_acepta`, que sí lo mira.
 *
 * ── LO QUE SALE, Y LO QUE NO ────────────────────────────────────────
 * Por cliente: `acepta` (qué canales aceptó) y, solo de los canales que
 * aceptó, el dato. El correo sale si aceptó el canal 'correo'; el
 * teléfono, si aceptó 'whatsapp'; el nombre completo, si aceptó alguno. El
 * resto va en null: Foorkie sigue mostrando lo enmascarado que ya tenía.
 * Nunca sale nada de quien revocó, de quien no tiene fila de consentimiento
 * o de un miembro de otra tarjeta (se ignora, como si no existiera).
 *
 * ── SOLO TARJETAS DE FOORKIE, SOLO LECTURA ──────────────────────────
 * La puerta es la del panel (firma, vínculo con un local de Foorkie) más
 * la marca `lealtad_por_foorkie` (`localDeFoorkieDeLaTarjeta`): una
 * tarjeta vinculada pero de Bookea contesta 403. Nada se escribe, y si
 * alguna lectura falla la respuesta es un error: nunca una lista a medias
 * que parezca que nadie aceptó.
 */

// ════════════════════════════════════════════════════════════════════
//  1. Lo que manda Foorkie
// ════════════════════════════════════════════════════════════════════

/** Cuántos clientes se piden por llamada (la exportación pide de a tandas de este tamaño). */
export const CONTACTOS_MAXIMO = 200;

export type PedidoContacto = Vinculo & { miembroIds: string[] };

export function leerPedidoContacto(d: Record<string, unknown>): Lectura<PedidoContacto> {
  const v = leerVinculo(d);
  if (!v.ok) return v;
  if (ausente(d.miembro_ids) || !Array.isArray(d.miembro_ids)) {
    return { ok: false, motivo: "Faltan los clientes (miembro_ids: una lista de uuid)." };
  }
  if (d.miembro_ids.length === 0 || d.miembro_ids.length > CONTACTOS_MAXIMO) {
    return { ok: false, motivo: `Mandá de 1 a ${CONTACTOS_MAXIMO} clientes por vez (miembro_ids).` };
  }
  const ids = new Set<string>();
  for (const crudo of d.miembro_ids) {
    const id = uuidDe(crudo);
    if (!id) return { ok: false, motivo: "Alguno de los clientes (miembro_ids) no es un uuid válido." };
    ids.add(id);
  }
  return { ok: true, valor: { ...v.valor, miembroIds: [...ids] } };
}

// ════════════════════════════════════════════════════════════════════
//  2. El permiso: la misma cuenta que `persona_acepta` (0138), en lote
// ════════════════════════════════════════════════════════════════════

export const CANALES_DE_CONTACTO = ["correo", "whatsapp"] as const;
export type CanalDeContacto = (typeof CANALES_DE_CONTACTO)[number];

/** Una fila de `consentimientos_persona`, solo lo que hace falta para decidir. */
export type FilaDeConsentimiento = {
  id: string;
  persona_id: string;
  ambito: string;
  canal: string;
  estado: string;
  cuenta_id: string | null;
  rancho_id: string | null;
  created_at: string;
};

/** El negocio por sus dos raíces (0134): la cuenta y/o el rancho. Una fila vale si coincide con cualquiera. */
export type NegocioDelPermiso = { ranchoId: string | null; cuentaId: string | null };

/** Del dato de la base a una fila, o null si no tiene la forma. */
export function filaDeConsentimiento(v: unknown): FilaDeConsentimiento | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  const texto = (x: unknown) => (typeof x === "string" ? x : null);
  if (typeof f.id !== "string" || typeof f.persona_id !== "string" || typeof f.created_at !== "string") return null;
  const ambito = texto(f.ambito);
  const canal = texto(f.canal);
  const estado = texto(f.estado);
  if (!ambito || !canal || !estado) return null;
  return {
    id: f.id,
    persona_id: f.persona_id,
    ambito,
    canal,
    estado,
    cuenta_id: texto(f.cuenta_id),
    rancho_id: texto(f.rancho_id),
    created_at: f.created_at,
  };
}

/** ¿`a` va antes que `b` en el orden de la base (`created_at` desc, `id` desc)? */
function esMasNueva(a: FilaDeConsentimiento, b: FilaDeConsentimiento): boolean {
  if (esAnterior(b.created_at, a.created_at)) return true;
  if (esAnterior(a.created_at, b.created_at)) return false;
  return a.id > b.id;
}

/** La fila más nueva de una lista (el vigente de cada canal), o null. */
function laMasNueva(filas: readonly FilaDeConsentimiento[]): FilaDeConsentimiento | null {
  let ganadora: FilaDeConsentimiento | null = null;
  for (const f of filas) if (!ganadora || esMasNueva(f, ganadora)) ganadora = f;
  return ganadora;
}

/** ¿La fila es de ESTE negocio? Por su rancho o por su cuenta, como en `persona_acepta`. */
function esDelNegocio(f: FilaDeConsentimiento, n: NegocioDelPermiso): boolean {
  return (n.ranchoId !== null && f.rancho_id === n.ranchoId) || (n.cuentaId !== null && f.cuenta_id === n.cuentaId);
}

/**
 * ¿Esta persona aceptó que ESTE negocio le escriba por este canal?
 * `filas` son las filas de consentimiento de ESA persona (las de otras
 * personas y las de otros negocios no cuentan: se descartan acá).
 */
export function aceptaContacto(
  filas: readonly FilaDeConsentimiento[],
  personaId: string,
  canal: CanalDeContacto,
  negocio: NegocioDelPermiso,
): boolean {
  const suyas = filas.filter((f) => f.persona_id === personaId && f.canal === canal);
  // Se bajó de todo: la última fila de la plataforma, revocada.
  const plataforma = laMasNueva(suyas.filter((f) => f.ambito === "bookea"));
  if (plataforma?.estado === "revocado") return false;
  const delNegocio = laMasNueva(suyas.filter((f) => f.ambito === "negocio" && esDelNegocio(f, negocio)));
  return delNegocio?.estado === "aceptado";
}

// ════════════════════════════════════════════════════════════════════
//  3. Lo que sale de un cliente
// ════════════════════════════════════════════════════════════════════

export type ContactoDelCliente = {
  miembro_id: string;
  /** El nombre completo, solo si aceptó algún canal. */
  nombre: string | null;
  /** El correo completo, solo si aceptó el canal de correo. */
  correo: string | null;
  /** El teléfono (solo dígitos), solo si aceptó el canal de WhatsApp. */
  telefono: string | null;
  /** Qué canales aceptó (aunque todavía no haya dejado el dato). */
  acepta: { correo: boolean; whatsapp: boolean };
};

/**
 * El nombre tal cual lo escribió, sin las palabras que parecen un correo o
 * un teléfono (importaciones viejas que los dejaron en el campo del
 * nombre): «nombre» no puede ser la puerta por la que se escapa un
 * contacto de quien no aceptó. null si no queda nada.
 */
export function nombreCompleto(nombre: string | null | undefined): string | null {
  const limpio = (nombre ?? "")
    .replace(/\p{Cc}/gu, " ")
    .split(/\s+/)
    .filter((p) => p && !p.includes("@") && !/\d{3,}/.test(p))
    .join(" ")
    .trim();
  if (!limpio) return null;
  return limpio.length > 80 ? limpio.slice(0, 80).trimEnd() : limpio;
}

/** Solo los dígitos del teléfono (de 7 a 15), o null si no parece uno. */
export function telefonoEnDigitos(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  return digitos.length >= 7 && digitos.length <= 15 ? digitos : null;
}

/** El correo en minúsculas y de una línea, o null si no parece uno. */
export function correoLimpio(correo: string | null | undefined): string | null {
  const c = (correo ?? "").trim().toLowerCase();
  return c.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : null;
}

export function armarContacto(
  miembroId: string,
  identidad: Pick<IdentidadCliente, "nombre" | "correo" | "telefono"> | undefined,
  acepta: { correo: boolean; whatsapp: boolean },
): ContactoDelCliente {
  return {
    miembro_id: miembroId,
    nombre: acepta.correo || acepta.whatsapp ? nombreCompleto(identidad?.nombre) : null,
    correo: acepta.correo ? correoLimpio(identidad?.correo) : null,
    telefono: acepta.whatsapp ? telefonoEnDigitos(identidad?.telefono) : null,
    acepta: { correo: acepta.correo, whatsapp: acepta.whatsapp },
  };
}

// ════════════════════════════════════════════════════════════════════
//  4. La lectura
// ════════════════════════════════════════════════════════════════════

/** Una URL con cientos de uuid es kilométrica: las consultas con `in (…)` van de a cien. */
const POR_TANDA = 100;
const PAGINA_BASE = 1000;
/** Tope de filas de consentimiento que se leen en una llamada (200 clientes no se le acercan). */
const TOPE_CONSENTIMIENTOS = 20_000;

function enGrupos<T>(lista: readonly T[], tamano: number): T[][] {
  const grupos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) grupos.push(lista.slice(i, i + tamano));
  return grupos;
}

const ERROR_AL_LEER: FalloDelPanel = {
  ok: false,
  codigo: "error_base",
  motivo: "No pudimos leer los contactos. Probá de nuevo.",
  status: 500,
};

/** Las filas de consentimiento de estas personas, por páginas. null = no se pudo leer entero. */
async function consentimientosDe(db: Db, personaIds: readonly string[]): Promise<FilaDeConsentimiento[] | null> {
  const filas: FilaDeConsentimiento[] = [];
  for (const tanda of enGrupos(personaIds, POR_TANDA)) {
    for (let desde = 0; ; desde += PAGINA_BASE) {
      if (filas.length >= TOPE_CONSENTIMIENTOS) return null;
      const { data, error } = await db
        .from("consentimientos_persona")
        .select("id, persona_id, ambito, canal, estado, cuenta_id, rancho_id, created_at")
        .in("persona_id", tanda)
        .in("canal", [...CANALES_DE_CONTACTO])
        .order("id", { ascending: true })
        .range(desde, desde + PAGINA_BASE - 1);
      if (error) return null;
      const lote = (data ?? []) as unknown[];
      for (const f of lote) {
        const fila = filaDeConsentimiento(f);
        if (fila) filas.push(fila);
      }
      if (lote.length < PAGINA_BASE) break;
    }
  }
  return filas;
}

/**
 * Los contactos de estos clientes de ESTA tarjeta. Un `miembro_id` que no
 * es de la tarjeta (o está dado de baja) se ignora, igual que uno que no
 * existe. Las respuestas siguen el orden del pedido.
 */
export async function contactosDeLaTarjeta(
  db: Db,
  p: PedidoContacto,
): Promise<{ ok: true; contactos: ContactoDelCliente[] } | FalloDelPanel> {
  // Solo tarjetas de Foorkie: una vinculada sin la marca (la de Bookea) no entrega contactos.
  const local = await localDeFoorkieDeLaTarjeta(db, { programaId: p.programaId, ranchoId: p.ranchoId });
  if (!local) {
    return {
      ok: false,
      codigo: "no_es_de_foorkie",
      motivo: "Esta tarjeta no es de Foorkie Lealtad: sus contactos no se entregan por acá.",
      status: 403,
    };
  }

  const programa = await db.from("programa_lealtad").select("*").eq("id", p.programaId).eq("rancho_id", p.ranchoId).maybeSingle();
  if (programa.error) return ERROR_AL_LEER;
  if (!programa.data) return { ok: false, codigo: "sin_programa", motivo: "Esa tarjeta no existe.", status: 404 };
  const cuenta = (programa.data as Record<string, unknown>).cuenta_id;
  const negocio: NegocioDelPermiso = { ranchoId: p.ranchoId, cuentaId: typeof cuenta === "string" && cuenta ? cuenta : null };

  // Los miembros pedidos que de verdad son de esta tarjeta.
  const miembros = new Map<string, NonNullable<ReturnType<typeof filaDeMiembroDelPanel>>>();
  for (const tanda of enGrupos(p.miembroIds, POR_TANDA)) {
    const { data, error } = await db
      .from("miembros")
      .select("id, cliente_id, persona_id, estado, created_at")
      .eq("programa_id", p.programaId)
      .in("estado", ["activa", "pausada"])
      .in("id", tanda);
    if (error) return ERROR_AL_LEER;
    for (const f of (data ?? []) as unknown[]) {
      const m = filaDeMiembroDelPanel(f);
      if (m) miembros.set(m.id, m);
    }
  }
  if (miembros.size === 0) return { ok: true, contactos: [] };

  const lista = [...miembros.values()];
  const identidades = new Map<string, IdentidadCliente>();
  try {
    for (const tanda of enGrupos(lista, POR_TANDA)) {
      // `db` es el cliente con la llave de servicio que abrió la puerta del panel.
      const resueltas = await identidadesDeMiembros(db, tanda, p.ranchoId);
      for (const [id, identidad] of resueltas) identidades.set(id, identidad);
    }
  } catch {
    return ERROR_AL_LEER;
  }

  const personaIds = [...new Set(lista.map((m) => m.persona_id).filter((v): v is string => !!v))];
  const consentimientos = personaIds.length > 0 ? await consentimientosDe(db, personaIds) : [];
  if (!consentimientos) return ERROR_AL_LEER;

  const contactos = p.miembroIds
    .map((id) => miembros.get(id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    .map((m) => {
      // Sin persona (una membresía anterior a la 0138) no hay fila de consentimiento: no aceptó nada.
      const acepta = m.persona_id
        ? {
            correo: aceptaContacto(consentimientos, m.persona_id, "correo", negocio),
            whatsapp: aceptaContacto(consentimientos, m.persona_id, "whatsapp", negocio),
          }
        : { correo: false, whatsapp: false };
      return armarContacto(m.id, identidades.get(m.id), acepta);
    });
  return { ok: true, contactos };
}
