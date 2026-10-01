import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { firmaValida } from "@/lib/plataforma/foorkie";
import { normalizarCorreo } from "@/lib/lealtad/personas";
import {
  configPorDefecto,
  tipoDe,
  validarBeneficio,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "@/lib/lealtad/tipos-tarjeta";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";
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

/** Lo que dice cada rechazo de la puerta, para quien lo tenga que leer en Foorkie. */
export const MOTIVO_PUERTA = {
  no_configurado: "La conexión con Bookea no está configurada en este momento.",
  muy_grande: "El pedido a Bookea es demasiado grande.",
  firma: "Bookea no reconoció la firma del pedido (o venció): probá de nuevo.",
  json: "El pedido a Bookea no vino bien armado.",
} as const;

/** Lee un POST de Foorkie: firma válida y JSON con forma de objeto. */
export async function leerPedidoFirmado(request: Request, max = 8000): Promise<PedidoFirmado> {
  const rechazo = (codigo: keyof typeof MOTIVO_PUERTA, status: number) => ({
    ok: false as const,
    respuesta: responder({ ok: false, codigo, motivo: MOTIVO_PUERTA[codigo] }, status),
  });
  const secreto = process.env.FOORKIE_PLATAFORMA_SECRETO?.trim();
  if (!secreto) return rechazo("no_configurado", 503);
  const cuerpo = await request.text();
  if (cuerpo.length > max) return rechazo("muy_grande", 413);
  if (!firmaValida(cuerpo, request.headers.get("x-foorkie-firma"), secreto)) return rechazo("firma", 401);
  try {
    const leido: unknown = JSON.parse(cuerpo);
    if (!leido || typeof leido !== "object" || Array.isArray(leido)) throw new Error("cuerpo");
    return { ok: true, datos: leido as Record<string, unknown>, secreto };
  } catch {
    return rechazo("json", 400);
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

/**
 * Lo que la tarjeta DICE hoy con este saldo: el tipo, si está en pausa,
 * el texto del pase (`camposSegunModo`) y el «5 de 10». Lo comparten la
 * tarjeta de «Mi cuenta» (`armarTarjeta`) y la caja (`foorkie-caja.ts`),
 * así las dos pantallas de Foorkie leen lo mismo que el teléfono.
 */
export function lecturaDeTarjeta(d: {
  fila: Record<string, unknown>;
  negocio: string;
  saldo: number;
  meta: MetaRecompensa;
  ahora?: Date;
}): {
  modo: TipoTarjeta;
  pausada: boolean;
  textos: CamposTarjeta;
  progreso: { actual: number; total: number } | null;
  beneficio: ConfigBeneficio | null;
} {
  const { config, beneficio } = tarjetaDesdeFila(d.fila);
  const modo = tipoDe(config.modo);
  const pausada = estaPausada(d.fila, d.ahora);
  const textos = camposSegunModo({ negocioNombre: d.negocio, saldo: d.saldo, meta: d.meta, config, beneficio, pausado: pausada });
  const total =
    modo === "sellos"
      ? (d.meta?.costo_puntos ?? (beneficio?.tipo === "sellos" ? beneficio.requeridos : null))
      : null;
  return {
    modo,
    pausada,
    textos,
    progreso: total && total > 0 ? { actual: Math.min(d.saldo, total), total } : null,
    beneficio,
  };
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
  const { modo, pausada, textos, progreso, beneficio } = lecturaDeTarjeta(d);
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
    progreso,
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

// ── La tarjeta de un local, como la ve el panel de Foorkie ──────────

/**
 * La tarjeta de un negocio vinculado: tipo, beneficio, diseño, meta, si
 * está en pausa, cuántos clientes la tienen y la página para unirse. La
 * devuelven `programa` (leer) y `programa/guardar` (después de guardar).
 * null = esa tarjeta no existe.
 */
export async function programaParaFoorkie(
  db: SupabaseClient,
  ranchoId: string,
  programaId: string,
  base: string,
): Promise<Record<string, unknown> | null> {
  const [{ data: fila }, { data: rancho }, meta, { count: miembros }] = await Promise.all([
    db.from("programa_lealtad").select("*").eq("id", programaId).eq("rancho_id", ranchoId).maybeSingle(),
    db.from("ranchos").select("nombre, slug").eq("id", ranchoId).maybeSingle(),
    metaDelPrograma(db, programaId),
    db.from("miembros").select("id", { count: "exact", head: true }).eq("programa_id", programaId).eq("estado", "activa"),
  ]);
  if (!fila) return null;

  const negocio = String(rancho?.nombre ?? "");
  const { config, beneficio } = tarjetaDesdeFila(fila as Record<string, unknown>);
  const pausada = estaPausada(fila as Record<string, unknown>);
  return {
    id: programaId,
    rancho_id: ranchoId,
    negocio,
    nombre: typeof fila.nombre === "string" ? fila.nombre : negocio,
    modo: tipoDe(config.modo),
    estado: typeof fila.estado === "string" ? fila.estado : null,
    pausada,
    beneficio,
    meta,
    diseno: disenoDeFila(fila as Record<string, unknown>),
    // Lo que diría la tarjeta de alguien que recién se une (saldo 0).
    textos: camposSegunModo({ negocioNombre: negocio, saldo: 0, meta, config, beneficio, pausado: pausada }),
    miembros: miembros ?? 0,
    // La página de Bookea donde alguien se une (formulario + consentimiento).
    unirse: rancho?.slug ? `${base.replace(/\/+$/, "")}/tarjeta/${rancho.slug}/${programaId}` : null,
  };
}

// ── Imágenes que llegan de Foorkie ──────────────────────────────────

const BUCKET_FOORKIE = "foorkie_media";
const TIPOS_IMAGEN: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/**
 * Copia una imagen pública de Foorkie (`foorkie_media`) al bucket del
 * alta de Bookea (`comprobantes/logos-negocio/`, como el wizard de alta):
 * un pase instalado no puede depender de un archivo que otro producto
 * puede borrar o cambiar. Devuelve la URL nueva, o "error" si la URL no
 * es de Foorkie, no es PNG/JPG/WebP o pesa más de 4 MB. Nunca lanza.
 */
export async function copiarImagenDeFoorkie(
  db: SupabaseClient,
  url: string,
  destino: "logo" | "banda",
): Promise<string | "error"> {
  if (!esUrlDeNuestroStorage(url, BUCKET_FOORKIE)) return "error";
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!r.ok) return "error";
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = TIPOS_IMAGEN[tipo];
    if (!ext) return "error";
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) return "error";
    const path = `logos-negocio/foorkie-${destino}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from("comprobantes").upload(path, bytes, { contentType: tipo, upsert: false });
    if (error) return "error";
    return db.storage.from("comprobantes").getPublicUrl(path).data.publicUrl ?? "error";
  } catch {
    return "error";
  }
}

// ── Lo que el panel de Foorkie puede cambiar de una tarjeta ─────────
//
// Pedido del dueño (1 oct 2026): «nosotros le damos todo lo que tenemos
// que cambiar, para verse reflejado en las tarjetas de Android y Apple».
// Foorkie edita lo que un restaurante cambia de verdad: los dos colores,
// el logo, la banda y el beneficio (el % del cashback, o la meta y la
// regalía de los sellos). El TIPO no se cambia desde allá: con gente
// adentro reinterpreta saldos (`editable.ts`), y es decisión de Bookea.
// Las reglas son las MISMAS funciones que usa el panel de Bookea
// (`validarBeneficio`, `puedeEditarse`, `acumulacionDe`): un solo criterio.

const HEX = /^#[0-9A-Fa-f]{6}$/;

export type BeneficioDesdeFoorkie =
  | { tipo: "cashback"; porcentaje: number }
  | { tipo: "sellos"; requeridos: number; recompensa: string };

/** Lo que manda el panel de Foorkie. Lo que no viene, no se toca. */
export type EdicionDesdeFoorkie = {
  colorFondo?: string;
  colorSello?: string;
  /** URL de `foorkie_media` (se copia), la que ya tiene la tarjeta (se deja) o null (se saca). */
  logoUrl?: string | null;
  bannerUrl?: string | null;
  beneficio?: BeneficioDesdeFoorkie;
};

/** Lee y valida la FORMA de lo que manda Foorkie (las reglas del negocio van después). */
export function leerEdicionDeFoorkie(
  v: unknown,
): { ok: true; edicion: EdicionDesdeFoorkie } | { ok: false; motivo: string } {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, motivo: "No vino nada para cambiar." };
  const o = v as Record<string, unknown>;
  const e: EdicionDesdeFoorkie = {};

  for (const campo of ["colorFondo", "colorSello"] as const) {
    const c = o[campo];
    if (c === undefined) continue;
    if (typeof c !== "string" || !HEX.test(c)) return { ok: false, motivo: "Los colores tienen que ser #RRGGBB." };
    e[campo] = c.toUpperCase();
  }

  for (const campo of ["logoUrl", "bannerUrl"] as const) {
    const u = o[campo];
    if (u === undefined) continue;
    if (u === null || u === "") {
      e[campo] = null;
      continue;
    }
    if (typeof u !== "string" || u.length > 600) {
      return { ok: false, motivo: `${campo === "logoUrl" ? "El logo" : "La banda"} no se subió bien — probá de nuevo.` };
    }
    e[campo] = u.trim();
  }

  if (o.beneficio !== undefined) {
    const b = o.beneficio && typeof o.beneficio === "object" ? (o.beneficio as Record<string, unknown>) : null;
    if (b?.tipo === "cashback") {
      if (typeof b.porcentaje !== "number" || !Number.isFinite(b.porcentaje)) {
        return { ok: false, motivo: "El cashback va de 1 a 100 por ciento." };
      }
      e.beneficio = { tipo: "cashback", porcentaje: Math.round(b.porcentaje * 100) / 100 };
    } else if (b?.tipo === "sellos") {
      if (typeof b.requeridos !== "number" || typeof b.recompensa !== "string") {
        return { ok: false, motivo: "Contá cuántos sellos pide la tarjeta y qué se gana." };
      }
      e.beneficio = { tipo: "sellos", requeridos: b.requeridos, recompensa: b.recompensa.trim().slice(0, 80) };
    } else {
      return { ok: false, motivo: "Desde Foorkie se editan las tarjetas de cashback y de sellos." };
    }
  }

  if (Object.keys(e).length === 0) return { ok: false, motivo: "No vino nada para cambiar." };
  return { ok: true, edicion: e };
}

/**
 * El beneficio COMPLETO después del cambio. Lo que Foorkie no edita
 * (compra mínima, tope, sellos de regalo, si se repite…) queda como
 * estaba, y el resultado pasa por `validarBeneficio`, igual que en el
 * panel de Bookea.
 */
export function beneficioEditado(
  actual: ConfigBeneficio | null,
  tipo: TipoTarjeta,
  cambio: BeneficioDesdeFoorkie,
): { ok: true; beneficio: ConfigBeneficio } | { ok: false; motivo: string } {
  if (cambio.tipo !== tipo) {
    return { ok: false, motivo: "El tipo de la tarjeta no se cambia desde Foorkie: escribinos y lo vemos." };
  }
  const base = actual && actual.tipo === tipo ? actual : configPorDefecto(tipo);
  let nuevo: ConfigBeneficio;
  if (cambio.tipo === "cashback" && base.tipo === "cashback") {
    nuevo = { ...base, porcentaje: cambio.porcentaje };
  } else if (cambio.tipo === "sellos" && base.tipo === "sellos") {
    nuevo = { ...base, requeridos: cambio.requeridos, recompensa: cambio.recompensa };
  } else {
    return { ok: false, motivo: "Desde Foorkie se editan las tarjetas de cashback y de sellos." };
  }
  const invalido = validarBeneficio(nuevo);
  return invalido ? { ok: false, motivo: invalido } : { ok: true, beneficio: nuevo };
}

/** ¿Cambió lo que Foorkie edita del beneficio? (El jsonb no se compara serializado: el orden de las claves cambia.) */
export function cambioElBeneficio(actual: ConfigBeneficio | null, nuevo: ConfigBeneficio): boolean {
  if (!actual || actual.tipo !== nuevo.tipo) return true;
  if (actual.tipo === "cashback" && nuevo.tipo === "cashback") return actual.porcentaje !== nuevo.porcentaje;
  if (actual.tipo === "sellos" && nuevo.tipo === "sellos") {
    return actual.requeridos !== nuevo.requeridos || actual.recompensa.trim() !== nuevo.recompensa.trim();
  }
  return true;
}
