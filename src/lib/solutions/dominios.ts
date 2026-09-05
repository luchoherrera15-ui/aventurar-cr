/**
 * ════════════════════════════════════════════════════════════════════
 *  EL DOMINIO PROPIO — lo puro, compartido por el panel y el proxy
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (5 sep 2026): «que la gente agregue su propio
 * dominio y tenga sus mini portales, como un Linktree».
 *
 * ── CÓMO FUNCIONA, DE PUNTA A PUNTA ────────────────────────────────
 *   1. El negocio escribe su dominio en Mi página (casanostra.com o
 *      menu.casanostra.com). Se guarda normalizado (0234).
 *   2. La pantalla le dice qué registro poner en su DNS: un CNAME a
 *      Vercel para un subdominio, un registro A para el dominio pelado.
 *   3. El dominio se agrega al proyecto de Vercel (por API si hay
 *      token, o a mano por Bookea) para que Vercel lo enrute acá y le
 *      emita el certificado.
 *   4. Cuando una petición llega con ese Host, el proxy (src/proxy.ts)
 *      lo busca, reescribe `/` a `/s/<slug>` y `/menu` a
 *      `/s/<slug>/menu`, y marca la respuesta con una cabecera.
 *   5. «Verificar» hace una petición HTTPS real al dominio y busca esa
 *      cabecera. Si vuelve, está activo — DNS, Vercel y TLS a la vez.
 *
 * Este archivo no toca la base ni Node: son funciones puras (probadas
 * en dominios.test.ts) más la búsqueda que usa el proxy, hecha con
 * `fetch` para que corra en cualquier runtime.
 */

/** La IP y el CNAME públicos de Vercel para dominios propios. */
export const VERCEL_A = "76.76.21.21";
export const VERCEL_CNAME = "cname.vercel-dns.com";

/** La cabecera con la que el proxy marca una página servida por dominio propio. */
export const CABECERA_DOMINIO = "x-bookea-solutions";

const HOST_VALIDO = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * Del texto que escribió el negocio al host que se guarda: minúsculas,
 * sin «https://», sin ruta, sin puerto, sin punto final ni «www.» de
 * más. null si no es un dominio.
 */
export function normalizarDominio(entrada: string): string | null {
  let h = (entrada ?? "").trim().toLowerCase();
  h = h.replace(/^[a-z]+:\/\//, "");
  h = h.split("/")[0].split("?")[0].split("#")[0];
  h = h.split(":")[0];
  h = h.replace(/\.+$/, "");
  if (!HOST_VALIDO.test(h)) return null;
  return h;
}

/** Los hosts que son nuestros: ahí el proxy no busca ningún dominio ajeno. */
export function esHostPropio(host: string, sitio: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): boolean {
  const h = host.toLowerCase().split(":")[0];
  if (!h) return true;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".vercel.app")) return true;
  if (h === "bookea.lat" || h.endsWith(".bookea.lat")) return true;
  try {
    const propio = sitio ? new URL(sitio).hostname.toLowerCase() : "";
    if (propio && (h === propio || h === propio.replace(/^www\./, ""))) return true;
  } catch {
    /* un NEXT_PUBLIC_SITE_URL roto no vuelve ajeno a ningún host */
  }
  return false;
}

/** Sufijos de dos niveles donde el «apex» tiene tres etiquetas (tienda.co.cr). */
const SEGUNDO_NIVEL = new Set(["co", "com", "net", "org", "ac", "go", "ed", "fi", "or", "sa", "gob", "edu"]);

/** ¿Es el dominio pelado (sin subdominio)? Decide A contra CNAME. */
export function esApex(host: string): boolean {
  const partes = host.split(".");
  if (partes.length === 2) return true;
  return partes.length === 3 && SEGUNDO_NIVEL.has(partes[1]) && partes[2].length === 2;
}

export type InstruccionDns = { tipo: "A" | "CNAME"; nombre: string; valor: string };

/**
 * Qué registro poner en el DNS, en la forma en que lo pide cualquier
 * proveedor (GoDaddy, Cloudflare, Namecheap): tipo, nombre, valor.
 * «@» es como todos ellos llaman al dominio pelado.
 */
export function instruccionesDns(host: string): InstruccionDns[] {
  if (esApex(host)) {
    return [
      { tipo: "A", nombre: "@", valor: VERCEL_A },
      { tipo: "CNAME", nombre: "www", valor: VERCEL_CNAME },
    ];
  }
  const partes = host.split(".");
  const apexPartes = esApex(partes.slice(1).join(".")) ? partes.slice(1) : partes.slice(-2);
  const sub = partes.slice(0, partes.length - apexPartes.length).join(".");
  return [{ tipo: "CNAME", nombre: sub || "@", valor: VERCEL_CNAME }];
}

export type DestinoDominio =
  | { tipo: "rewrite"; pathname: string }
  | { tipo: "redirect"; pathname: string }
  | { tipo: "pasar" };

/**
 * A dónde va cada ruta cuando llega por dominio propio. La raíz es la
 * página; /menu es el menú; lo que ya venga como /s/<slug>… pasa tal
 * cual; el resto del sitio (/lealtad, /eventos…) NO se sirve bajo el
 * dominio del negocio: vuelve a la raíz, que es lo suyo.
 */
export function destinoEnDominioPropio(pathname: string, slug: string): DestinoDominio {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return { tipo: "rewrite", pathname: `/s/${slug}` };
  if (p === "/menu" || p.startsWith("/menu/")) return { tipo: "rewrite", pathname: `/s/${slug}/menu` };
  if (p === `/s/${slug}` || p.startsWith(`/s/${slug}/`)) return { tipo: "pasar" };
  if (p.startsWith("/api/")) return { tipo: "pasar" };
  return { tipo: "redirect", pathname: "/" };
}

// ── La búsqueda del proxy ───────────────────────────────────────────

const TTL_MS = 60_000;
const cache = new Map<string, { slug: string | null; hasta: number }>();

/**
 * El slug del negocio dueño de ese host, o null. Con la llave ANÓNIMA
 * y la política pública de la 0230 («Público ve negocios publicados»):
 * un negocio apagado no se sirve por su dominio, igual que no se sirve
 * por /s/<slug>. Cacheado un minuto por host en memoria del runtime:
 * el proxy corre en TODAS las rutas y un dominio propio recibe muchas
 * peticiones seguidas (la página y sus assets).
 */
export async function slugPorDominio(host: string): Promise<string | null> {
  const h = host.toLowerCase().split(":")[0];
  const ahora = Date.now();
  const enCache = cache.get(h);
  if (enCache && enCache.hasta > ahora) return enCache.slug;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let slug: string | null = null;
  if (base && anon) {
    try {
      const r = await fetch(
        `${base}/rest/v1/solutions_negocios?select=slug&dominio=eq.${encodeURIComponent(h)}&publicado=is.true&limit=1`,
        { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, cache: "no-store" },
      );
      if (r.ok) {
        const filas = (await r.json()) as { slug?: string }[];
        slug = filas[0]?.slug ?? null;
      }
    } catch {
      slug = null;
    }
  }
  cache.set(h, { slug, hasta: ahora + TTL_MS });
  return slug;
}
