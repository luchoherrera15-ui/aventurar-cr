import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firmaValida } from "@/lib/plataforma/foorkie";
import { normalizarCorreo } from "@/lib/lealtad/personas";
import { tipoDe, type ConfigBeneficio, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { minutoISOCR } from "@/lib/fechas";
import {
  camposSegunModo,
  coloresDe,
  tarjetaDesdeFila,
  type CamposTarjeta,
  type MetaRecompensa,
} from "@/lib/wallet/tarjeta";
import { tarjetaDelPase } from "@/lib/wallet/programa-principal";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA API DE FOORKIE — lo que Foorkie lee y manda sobre la lealtad
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 oct 2026): «vamos a crear un API desde Bookea que
 * nos dé toda la info y nosotros le damos todo lo que tenemos que
 * cambiar, para verse reflejado en las tarjetas de Android y Apple, y
 * también lo veremos en "nuestra cuenta" a nivel web y app».
 *
 * Bookea sigue siendo el motor y el único que escribe sus tablas: Foorkie
 * pide y manda por estas rutas (`/api/plataforma/foorkie/*`), firmadas
 * con la misma llave que `acreditar` (ver `foorkie.ts`). Nada de esto
 * abre una puerta a un negocio de Bookea que no esté vinculado a un
 * local de Foorkie (`foorkie_restaurantes.bookea_programa_id`).
 *
 * Los LINKS AL WALLET son la pieza nueva: las rutas de siempre
 * (`/api/pases/<negocio>`) reconocen a la persona por la cookie o la
 * sesión de Bookea, que alguien que abre su cuenta en Foorkie no tiene.
 * Acá Bookea firma un link que vale 30 minutos y nombra a UN miembro;
 * solo se le da a Foorkie para el correo de quien tiene la sesión allá.
 */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SIN_CACHE = { "Cache-Control": "no-store" };

export function responder(cuerpo: Record<string, unknown>, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE });
}

export type PedidoFirmado =
  | { ok: true; datos: Record<string, unknown>; secreto: string }
  | { ok: false; respuesta: NextResponse };

/** Lee un POST de Foorkie: firma válida y JSON con forma de objeto. */
export async function leerPedidoFirmado(request: Request, max = 8000): Promise<PedidoFirmado> {
  const secreto = process.env.FOORKIE_PLATAFORMA_SECRETO?.trim();
  if (!secreto) return { ok: false, respuesta: responder({ ok: false, codigo: "no_configurado" }, 503) };
  const cuerpo = await request.text();
  if (cuerpo.length > max) return { ok: false, respuesta: responder({ ok: false, codigo: "muy_grande" }, 413) };
  if (!firmaValida(cuerpo, request.headers.get("x-foorkie-firma"), secreto)) {
    return { ok: false, respuesta: responder({ ok: false, codigo: "firma" }, 401) };
  }
  try {
    const leido: unknown = JSON.parse(cuerpo);
    if (!leido || typeof leido !== "object" || Array.isArray(leido)) throw new Error("cuerpo");
    return { ok: true, datos: leido as Record<string, unknown>, secreto };
  } catch {
    return { ok: false, respuesta: responder({ ok: false, codigo: "json" }, 400) };
  }
}

// ── Links al Wallet ─────────────────────────────────────────────────

export type Billetera = "apple" | "google";
export type LinkPase = { m: string; w: Billetera; e: number };

/** Cuánto vale un link al Wallet: lo que tarda alguien en tocar el botón. */
export const VIDA_LINK_PASE_MS = 30 * 60_000;

/** La llave de los links sale de la de la puerta, pero no es la misma firma. */
function llaveLinks(secreto: string): Buffer {
  return createHmac("sha256", secreto).update("foorkie-pase-v1").digest();
}

/** `<datos>.<firma>` en base64url: nombra al miembro, la billetera y el vencimiento. */
export function firmarLinkPase(p: LinkPase, secreto: string): string {
  const datos = Buffer.from(JSON.stringify(p)).toString("base64url");
  const firma = createHmac("sha256", llaveLinks(secreto)).update(datos).digest("base64url");
  return `${datos}.${firma}`;
}

/** El link si es nuestro y no venció; si no, null (nunca lanza). */
export function leerLinkPase(token: string, secreto: string, ahora: number = Date.now()): LinkPase | null {
  const partes = (token ?? "").split(".");
  if (partes.length !== 2) return null;
  const [datos, firma] = partes;
  if (!datos || !firma || datos.length > 400 || firma.length > 100) return null;
  const esperada = createHmac("sha256", llaveLinks(secreto)).update(datos).digest();
  const recibida = Buffer.from(firma, "base64url");
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
  let leido: unknown;
  try {
    leido = JSON.parse(Buffer.from(datos, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!leido || typeof leido !== "object") return null;
  const { m, w, e } = leido as Record<string, unknown>;
  if (typeof m !== "string" || !UUID.test(m)) return null;
  if (w !== "apple" && w !== "google") return null;
  if (typeof e !== "number" || !Number.isFinite(e) || e < ahora) return null;
  return { m, w, e };
}

/** La URL pública de un link al Wallet. */
export function urlLinkPase(base: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/api/plataforma/foorkie/pase?t=${encodeURIComponent(token)}`;
}

/** El sitio de Bookea, para armar links absolutos. */
export function sitioDeBookea(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

// ── Quién es esta persona ───────────────────────────────────────────

/**
 * Las personas de Bookea con ese correo: la global (`personas.correo`)
 * y las identidades locales de cualquier negocio (`correo_declarado`,
 * 0200). Mismo criterio que `miembroPorCorreo`, sin atarse a un negocio.
 */
export async function personasPorCorreo(db: SupabaseClient, correoCrudo: string): Promise<string[]> {
  const correo = normalizarCorreo(correoCrudo);
  if (!correo) return [];
  const [{ data: global }, { data: locales }] = await Promise.all([
    db.from("personas").select("id").eq("correo", correo).maybeSingle(),
    db.from("personas_negocio").select("persona_id").eq("correo_declarado", correo).limit(50),
  ]);
  const ids = new Set<string>();
  if (typeof global?.id === "string") ids.add(global.id);
  for (const l of locales ?? []) if (typeof l.persona_id === "string") ids.add(l.persona_id);
  return [...ids];
}

// ── Una tarjeta, como la ve Foorkie ─────────────────────────────────

export type DisenoTarjeta = {
  colorFondo: string;
  colorSello: string;
  logoUrl: string | null;
  bannerUrl: string | null;
};

export type TarjetaParaFoorkie = {
  miembro_id: string;
  programa_id: string;
  rancho_id: string;
  negocio: string;
  nombre: string;
  modo: TipoTarjeta;
  pausada: boolean;
  /** Suma del ledger: sellos, puntos o colones según `modo`. */
  saldo: number;
  meta: MetaRecompensa;
  /** Solo en tarjetas de sellos: «5 de 10». */
  progreso: { actual: number; total: number } | null;
  /** Lo mismo que dice el pase del teléfono (`camposSegunModo`). */
  textos: CamposTarjeta;
  beneficio: ConfigBeneficio | null;
  diseno: DisenoTarjeta;
  wallet: { apple: string; google: string; vence: string };
};

/** La meta de un programa: la recompensa activa más barata (la misma que usa el pase). */
export async function metaDelPrograma(db: SupabaseClient, programaId: string): Promise<MetaRecompensa> {
  const { data } = await db
    .from("recompensas")
    .select("nombre, costo_puntos")
    .eq("programa_id", programaId)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? { nombre: String(data.nombre ?? ""), costo_puntos: Number(data.costo_puntos) } : null;
}

/** El saldo del miembro: la suma del ledger (null si no se pudo leer; nunca inventa un 0). */
export async function saldoDelMiembro(db: SupabaseClient, miembroId: string): Promise<number | null> {
  const { data, error } = await db.from("transacciones_puntos").select("puntos").eq("miembro_id", miembroId);
  if (error || !data) return null;
  return data.reduce((suma: number, fila: { puntos: number }) => suma + Number(fila.puntos ?? 0), 0);
}

/** El diseño de la fila con los colores por defecto de Bookea, como los pinta el pase. */
export function disenoDeFila(fila: Record<string, unknown>): DisenoTarjeta {
  const { config } = tarjetaDesdeFila(fila);
  const { fondo, sello } = coloresDe(config);
  return { colorFondo: fondo, colorSello: sello, logoUrl: config.pase_logo_url, bannerUrl: config.pase_banner_url ?? null };
}

/** ¿La tarjeta está en pausa? La misma lectura que hace el generador del pase. */
export function estaPausada(fila: Record<string, unknown>, ahora: Date = new Date()): boolean {
  return tarjetaDelPase([fila], minutoISOCR(ahora), String(fila.id ?? "")).pausado === true;
}

/** Todo lo que Foorkie necesita para dibujar UNA tarjeta y ofrecer el Wallet. */
export function armarTarjeta(d: {
  miembroId: string;
  fila: Record<string, unknown>;
  negocio: string;
  saldo: number;
  meta: MetaRecompensa;
  links: { apple: string; google: string; vence: string };
  ahora?: Date;
}): TarjetaParaFoorkie {
  const { config, beneficio } = tarjetaDesdeFila(d.fila);
  const modo = tipoDe(config.modo);
  const pausada = estaPausada(d.fila, d.ahora);
  const textos = camposSegunModo({ negocioNombre: d.negocio, saldo: d.saldo, meta: d.meta, config, beneficio, pausado: pausada });
  const total =
    modo === "sellos"
      ? (d.meta?.costo_puntos ?? (beneficio?.tipo === "sellos" ? beneficio.requeridos : null))
      : null;
  return {
    miembro_id: d.miembroId,
    programa_id: String(d.fila.id),
    rancho_id: String(d.fila.rancho_id),
    negocio: d.negocio,
    nombre: typeof d.fila.nombre === "string" ? d.fila.nombre : d.negocio,
    modo,
    pausada,
    saldo: d.saldo,
    meta: d.meta,
    progreso: total && total > 0 ? { actual: Math.min(d.saldo, total), total } : null,
    textos,
    beneficio,
    diseno: disenoDeFila(d.fila),
    wallet: d.links,
  };
}

/** Los dos links al Wallet de un miembro, firmados y con su vencimiento. */
export function linksDelMiembro(base: string, miembroId: string, secreto: string, ahora: number = Date.now()) {
  const e = ahora + VIDA_LINK_PASE_MS;
  return {
    apple: urlLinkPase(base, firmarLinkPase({ m: miembroId, w: "apple", e }, secreto)),
    google: urlLinkPase(base, firmarLinkPase({ m: miembroId, w: "google", e }, secreto)),
    vence: new Date(e).toISOString(),
  };
}
