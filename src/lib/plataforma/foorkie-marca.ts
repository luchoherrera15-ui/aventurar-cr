import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUMNA_LEALTAD_POR_FOORKIE } from "@/lib/plataforma/negocio-de-foorkie";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA MARCA DEL PASE — Bookea o Foorkie
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (1 oct 2026): Foorkie vende la lealtad de sus locales
 * con su marca («Foorkie Lealtad») y Bookea queda como el motor que no se
 * ve —los certificados de Apple, Google Wallet, los pases y el ledger—.
 *
 * ── QUÉ TARJETA ES «DE FOORKIE»: UNA MARCA EXPLÍCITA ─────────────────
 * Estar vinculada no alcanza: hay tarjetas de Bookea conectadas a un
 * local de Foorkie —la de Pura Matcha— que siguen siendo de Bookea en
 * todo (regla dura de Luis: ni su pase ni sus correos se tocan). Una
 * tarjeta es de Foorkie SOLO si un local de Foorkie la tiene vinculada
 * (`foorkie_restaurantes.bookea_programa_id`, con su `bookea_rancho_id`)
 * Y marcada con `lealtad_por_foorkie = true` (la pone Foorkie; nace en
 * false). Es la misma marca que usa la guardia de los correos al dueño
 * (`negocio-de-foorkie.ts`). Para esas tarjetas, y SOLO para esas:
 *
 *   · el pase firma «Powered by Foorkie», bajo el QR dice «Foorkie
 *     Lealtad» y sus links llevan a Foorkie (el reverso de Apple, el
 *     módulo de links de Google y el encabezado de sus mensajes);
 *   · Bookea no le escribe correos al cliente: los manda Foorkie
 *     (`losCorreosLosMandaFoorkie`, la guardia de los correos).
 *
 * Si la consulta falla (la base no contesta, o la columna todavía no
 * existe) la tarjeta es de Bookea: el pase y los correos de siempre.
 *
 * El nombre y el logo del negocio no cambian: ya son los del local.
 *
 * Los negocios propios de Bookea no cambian en NADA: `MARCA_BOOKEA` es
 * exactamente lo que el pase decía antes, y los digests de
 * `pausa.test.ts` lo fijan byte por byte.
 *
 * Esto no avisa a los pases instalados ni los regenera: la marca nueva
 * entra en la próxima actualización natural de cada pase (un sello, un
 * canje, un cambio de diseño).
 *
 * Sin nada de servidor adentro (la base llega por parámetro): lo importa
 * `wallet/tarjeta.ts`, que también corre en la vista previa del panel.
 */

/** Donde viven las cuentas, la ayuda y los legales de Foorkie. */
export const SITIO_FOORKIE = "https://www.foorkie.tech";
/** La vitrina de Foorkie, donde está la página para unirse a una tarjeta. */
export const VITRINA_FOORKIE = "https://www.foorkie.app";

export type IdLinkDelPase = "unirse" | "cuenta" | "soporte" | "terminos" | "privacidad";

/** Un link del pase: un renglón del reverso de Apple y un link del módulo de Google. */
export type LinkDelPase = {
  id: IdLinkDelPase;
  /** El rótulo del renglón (Apple) y el texto del link (Google). */
  etiqueta: string;
  /** Lo que se toca en Apple: la dirección corta, para que se vea adónde lleva. */
  texto: string;
  url: string;
};

export type MarcaDelPase = {
  marca: "bookea" | "foorkie";
  /** El último renglón del reverso de Apple. */
  firma: { key: string; label: string; value: string };
  /** El texto que Apple dibuja bajo el QR. */
  altText: string;
  /** Vacío en Bookea: su pase no lleva links (ni los llevaba). */
  links: readonly LinkDelPase[];
  /** El encabezado de los mensajes que llegan al pase de Google. */
  encabezadoMensaje: string;
};

/** Lo que el pase decía siempre. Cambiar una coma acá cambia los pases de todos los negocios de Bookea. */
export const MARCA_BOOKEA: MarcaDelPase = Object.freeze({
  marca: "bookea" as const,
  firma: Object.freeze({ key: "bookea", label: "Powered by", value: "Bookea.lat" }),
  altText: "Powered by Bookea.lat",
  links: Object.freeze([] as LinkDelPase[]),
  encabezadoMensaje: "Bookea",
});

/** El local de Foorkie dueño de la marca de una tarjeta. */
export type LocalDeFoorkie = { slug: string | null };

/**
 * Un slug de Foorkie (`foorkie_slugify`: minúsculas, números y guiones) o
 * null. Va dentro de un link del pase: lo que no tenga esa forma no sale.
 */
export function slugDeFoorkie(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(s) ? s : null;
}

/** La dirección donde alguien se une a la tarjeta de ese local desde Foorkie. */
export function urlUnirseFoorkie(slug: string): string {
  return `${VITRINA_FOORKIE}/lealtad/${encodeURIComponent(slug)}`;
}

/** «https://www.foorkie.tech/cuenta» → «foorkie.tech/cuenta»: lo que se lee en el reverso. */
function corta(url: string): string {
  return url.replace(/^https:\/\/(www\.)?/, "");
}

/** QUÉ MARCA LLEVA EL PASE. Pura: sin local de Foorkie, la de siempre. */
export function marcaDelPase(local: LocalDeFoorkie | null): MarcaDelPase {
  if (!local) return MARCA_BOOKEA;

  const slug = slugDeFoorkie(local.slug);
  const links: LinkDelPase[] = [];
  // Sin slug no hay página para unirse: el renglón no sale (los demás sí).
  if (slug) {
    const url = urlUnirseFoorkie(slug);
    links.push({ id: "unirse", etiqueta: "Invitá a alguien a esta tarjeta", texto: corta(url), url });
  }
  const del = (id: IdLinkDelPase, etiqueta: string, ruta: string): LinkDelPase => {
    const url = `${SITIO_FOORKIE}${ruta}`;
    return { id, etiqueta, texto: corta(url), url };
  };
  links.push(
    del("cuenta", "Tus tarjetas en Foorkie", "/cuenta"),
    del("soporte", "Soporte", "/soporte"),
    del("terminos", "Términos y condiciones", "/terminos"),
    del("privacidad", "Política de privacidad", "/privacidad"),
  );

  return {
    marca: "foorkie",
    firma: { key: "foorkie", label: "Powered by", value: "Foorkie" },
    altText: "Foorkie Lealtad",
    links,
    encabezadoMensaje: "Foorkie",
  };
}

/** Una fila de `foorkie_restaurantes`, como llega (sin confiar en los tipos). */
export type FilaLocalDeFoorkie = {
  slug?: unknown;
  activo?: unknown;
  estado_publicacion?: unknown;
  created_at?: unknown;
  bookea_rancho_id?: unknown;
};

/** Más viejo primero; sin fecha, al final (una incógnita no gana el primer puesto). */
function porAntiguedad(a: FilaLocalDeFoorkie, b: FilaLocalDeFoorkie): number {
  const fa = typeof a.created_at === "string" ? a.created_at : null;
  const fb = typeof b.created_at === "string" ? b.created_at : null;
  if (fa === fb) return 0;
  if (fa === null) return 1;
  if (fb === null) return -1;
  return fa < fb ? -1 : 1;
}

/**
 * QUÉ LOCAL PONE LA MARCA cuando varios comparten la tarjeta (las
 * sucursales de una marca): el primero publicado y activo; si ninguno lo
 * está, el primero. «Primero» = el más viejo.
 *
 * `ranchoId`, si se sabe, descarta las filas mal vinculadas: una que
 * apunta esta tarjeta con OTRO negocio de Bookea no vale (es el mismo par
 * que exige `vinculoConFoorkie`). Sin negocio anotado todavía, vale.
 */
export function elegirLocalDeFoorkie(
  filas: readonly FilaLocalDeFoorkie[],
  ranchoId?: string | null,
): LocalDeFoorkie | null {
  const validas = filas.filter(
    (f) => !ranchoId || f.bookea_rancho_id === null || f.bookea_rancho_id === undefined || f.bookea_rancho_id === ranchoId,
  );
  if (validas.length === 0) return null;
  const ordenadas = [...validas].sort(porAntiguedad);
  const publicada = ordenadas.find((f) => f.activo === true && f.estado_publicacion === "aprobado");
  return { slug: slugDeFoorkie((publicada ?? ordenadas[0]).slug) };
}

/** Más que esto no comparte una tarjeta (una marca con sus sucursales). */
const MAX_LOCALES = 50;

/**
 * El local de Foorkie de una tarjeta, o null si la tarjeta no es de
 * Foorkie: ningún local la tiene vinculada CON la marca
 * `lealtad_por_foorkie` (una vinculada sin la marca, como la de Pura
 * Matcha, es de Bookea). UNA consulta. Nunca lanza: si la base no
 * contesta o la columna todavía no existe, null — o sea, el pase y los
 * correos de siempre, que es lo que pasaba antes de que esto existiera.
 */
export async function localDeFoorkieDeLaTarjeta(
  db: SupabaseClient,
  { programaId, ranchoId = null }: { programaId: string; ranchoId?: string | null },
): Promise<LocalDeFoorkie | null> {
  if (!programaId) return null;
  try {
    const { data, error } = await db
      .from("foorkie_restaurantes")
      .select("slug, activo, estado_publicacion, created_at, bookea_rancho_id")
      .eq("bookea_programa_id", programaId)
      .eq(COLUMNA_LEALTAD_POR_FOORKIE, true)
      .limit(MAX_LOCALES);
    if (error) {
      console.warn("[foorkie] No se pudo leer si la tarjeta es de Foorkie:", error.message);
      return null;
    }
    return elegirLocalDeFoorkie((data ?? []) as FilaLocalDeFoorkie[], ranchoId);
  } catch (e) {
    console.warn("[foorkie] No se pudo leer si la tarjeta es de Foorkie:", e);
    return null;
  }
}

/** La marca del pase de una tarjeta: una lectura por armado del pase. */
export async function marcaDeLaTarjeta(
  db: SupabaseClient,
  tarjeta: { programaId: string; ranchoId?: string | null },
): Promise<MarcaDelPase> {
  return marcaDelPase(await localDeFoorkieDeLaTarjeta(db, tarjeta));
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA GUARDIA DE LOS CORREOS AL CLIENTE
 * ════════════════════════════════════════════════════════════════════
 *
 * true = esta tarjeta es de Foorkie —vinculada a un local de Foorkie Y
 * marcada `lealtad_por_foorkie`— y Bookea NO le escribe al cliente (el
 * sello acreditado, los sellos por vencer, la bienvenida, el rescate):
 * esos correos los manda Foorkie, con su marca. Cada correo al miembro la
 * pregunta una vez, antes de armar nada.
 *
 * Una tarjeta vinculada sin la marca (Pura Matcha) y, ante la duda (la
 * base no contestó, la columna todavía no existe), cualquier tarjeta: false,
 * el correo de siempre. Un negocio de Bookea no puede quedarse sin sus
 * avisos por una consulta que falló.
 */
export async function losCorreosLosMandaFoorkie(
  db: SupabaseClient,
  tarjeta: { programaId: string; ranchoId?: string | null },
): Promise<boolean> {
  return (await localDeFoorkieDeLaTarjeta(db, tarjeta)) !== null;
}
