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

/**
 * ════════════════════════════════════════════════════════════════════
 *  LINKSY.LAT — EL DOMINIO DEL PRODUCTO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (6 sep 2026): el link hub deja de vivir colgado de
 * bookea.lat y estrena dominio propio, linksy.lat. La página de un
 * negocio pasa de `bookea.lat/s/<slug>` a `linksy.lat/<slug>`.
 *
 * ── POR QUÉ ESTO ES UNA CONSTANTE Y NO UNA VARIABLE DE ENTORNO ──────
 * `esHostPropio` la usa para decidir si un Host es NUESTRO, y de esa
 * decisión depende una regla de seguridad: la acción que guarda el
 * dominio propio de un negocio rechaza todo lo que `esHostPropio`
 * reconozca (ver panel/[id]/actions.ts). Si el nombre viniera de una
 * variable, un entorno mal configurado convertiría linksy.lat en un
 * dominio «ajeno» reclamable — un negocio cualquiera podría quedarse
 * con la raíz del producto. Un dominio que define la seguridad del
 * sistema se escribe en el código, no en la configuración.
 *
 * ⚠️ EL PANEL NO VIVE ACÁ, Y ES A PROPÓSITO. La cookie de sesión de
 * Supabase nace pegada al host que la escribió: la de bookea.lat no
 * viaja a linksy.lat, y no hay ajuste que lo arregle entre dos
 * dominios de apex distinto (sí entre subdominios — es lo que ya está
 * anotado abajo para food.bookea.lat). Servir el panel acá exigiría un
 * inicio de sesión único propio, con tickets de un solo uso y firmas:
 * 300 líneas de seguridad delicada para no ganar nada. Por eso
 * linksy.lat sirve SOLO páginas públicas y manda al panel de Bookea.
 */
export const LINKSY_HOST = "linksy.lat";

/** ¿El Host es linksy.lat (o su www)? */
export function esHostLinksy(host: string): boolean {
  const h = (host ?? "").toLowerCase().split(":")[0];
  return h === LINKSY_HOST || h === `www.${LINKSY_HOST}`;
}

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
  // linksy.lat es nuestro. Dos consecuencias, las dos buscadas: el
  // proxy NO lo trata como el dominio propio de algún negocio (lo
  // resuelve su propia rama, arriba de esa), y la acción de guardar
  // dominio lo rechaza — ningún negocio puede reclamar la raíz del
  // producto para sí.
  if (esHostLinksy(h)) return true;
  // celebrar.lat también es nuestro (CELEBRAR, sep 2026): si no estuviera
  // acá, un negocio de Solutions podría reclamarlo como su dominio.
  if (h === "celebrar.lat" || h === "www.celebrar.lat") return true;
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

// ── El enrutado de linksy.lat ───────────────────────────────────────

export type DestinoLinksy =
  | { tipo: "rewrite"; pathname: string }
  | { tipo: "redirect"; pathname: string }
  /**
   * A bookea.lat, con esa ruta y la query intacta. Es el mundo CON
   * SESIÓN —alta, login, panel, cuenta, lealtad— que no puede vivir en
   * linksy.lat porque la cookie no cruza entre apex distintos (ver
   * LINKSY_HOST). El proxy arma la URL absoluta con NEXT_PUBLIC_SITE_URL.
   */
  | { tipo: "bookea"; pathname: string }
  | { tipo: "pasar" };

/**
 * Los prefijos que son de Bookea aunque se pidan en linksy.lat.
 *
 * Sin esto, el primer clic real de la landing rompía todo: «Crear mi
 * Linksy» iba a `/solutions/crear`, que en linksy.lat es un slug de dos
 * segmentos y caía en la página de un negocio inexistente; el alta sin
 * sesión redirigía a `/cuenta?volver=solutions` RELATIVO, y en
 * linksy.lat `/cuenta` es un 404. Se vio el 7 sep 2026, el día del
 * estreno. Todos están además en `RESERVED_SLUGS`: ningún negocio se
 * puede llamar así.
 */
export const PREFIJOS_BOOKEA = new Set(["solutions", "cuenta", "lealtad", "auth", "admin", "mi-negocio", "linksy"]);

/** La URL absoluta de una ruta en bookea.lat. Sirve en cliente y servidor. */
export function urlBookea(pathname: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat").trim().replace(/\/+$/, "");
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

/**
 * Las TRES palabras que en linksy.lat no son el slug de un negocio.
 *
 * En bookea.lat las páginas viven bajo `/s/<slug>`, así que un negocio
 * podía llamarse «crear» sin chocar con nada. En linksy.lat el slug
 * está en la RAÍZ, y ahí sí choca. Estas tres están replicadas en
 * `RESERVED_SLUGS` (src/lib/slug.ts), que es lo que impide que un alta
 * nueva se quede con una de ellas.
 *
 * La lista es corta a propósito: cada palabra que se reserva es un
 * nombre que un negocio real ya no puede usar. Todo lo demás que el
 * producto necesite va bajo un prefijo (`/s/…`) o en bookea.lat.
 */
export const RUTAS_LINKSY = new Set(["crear", "entrar", "login", "linksy"]);

/**
 * A dónde va cada ruta cuando llega por linksy.lat.
 *
 *   /            la landing del producto
 *   /crear       el alta de una página
 *   /entrar      al login de Linksy en bookea.lat (ver LINKSY_HOST);
 *   /login       lo mismo — es lo que la gente escribe
 *   /<slug>      la página pública de ese negocio
 *   /<slug>/menu su menú / catálogo
 *
 * ── LO QUE PASA DE LARGO, Y POR QUÉ ─────────────────────────────────
 * `/api/`, `/_next/` y cualquier primer segmento CON PUNTO
 * (robots.txt, sitemap.xml, favicon.ico, los .well-known) siguen su
 * camino sin tocarse. El punto es la señal barata y exacta: un slug
 * nunca lo lleva —el CHECK de la 0230 es `^[a-z0-9-]{2,60}$`—, así que
 * no hay forma de confundir un archivo con un negocio.
 *
 * Lo que no encaja en ninguna forma conocida vuelve a la raíz en vez
 * de dar un 404: bajo el dominio del producto, una dirección mal
 * escrita lleva a la portada, no a una pared.
 */
export function destinoEnLinksy(pathname: string): DestinoLinksy {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return { tipo: "rewrite", pathname: "/solutions" };
  if (p.startsWith("/api/") || p.startsWith("/_next/")) return { tipo: "pasar" };

  const partes = p.split("/").filter(Boolean);
  const primero = partes[0] ?? "";

  // Archivos de la raíz: tienen punto, un slug no.
  if (primero.includes(".")) return { tipo: "pasar" };

  // Lo que ya viene resuelto a la ruta interna pasa tal cual: es lo que
  // recibe el propio rewrite de acá cuando Next lo vuelve a evaluar.
  if (primero === "s") return { tipo: "pasar" };

  // `/linksy` a secas es la landing: por el dominio del producto se
  // llega a ella por la raíz, no repitiendo el nombre. Con algo detrás
  // (`/linksy/login`) es del mundo de Bookea, abajo.
  if (primero === "linksy" && partes.length === 1) return { tipo: "redirect", pathname: "/" };

  // El mundo con sesión vive en bookea.lat: el alta, el login, el
  // panel, la cuenta. Se manda allá con la ruta tal cual — el alta que
  // redirige a `/cuenta?volver=solutions` sigue funcionando porque
  // `/cuenta` también cae acá.
  if (primero === "crear") return { tipo: "bookea", pathname: "/solutions/crear" };
  if (primero === "entrar" || primero === "login") return { tipo: "bookea", pathname: "/solutions/login" };
  if (PREFIJOS_BOOKEA.has(primero)) return { tipo: "bookea", pathname: p };

  if (RUTAS_LINKSY.has(primero)) return { tipo: "redirect", pathname: "/" };

  if (!/^[a-z0-9-]{2,60}$/.test(primero)) return { tipo: "redirect", pathname: "/" };
  if (partes.length === 1) return { tipo: "rewrite", pathname: `/s/${primero}` };
  if (partes.length === 2 && partes[1] === "menu") {
    return { tipo: "rewrite", pathname: `/s/${primero}/menu` };
  }
  return { tipo: "redirect", pathname: `/${primero}` };
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

/**
 * LA PORTADA DE LINKSY — a dónde vuelve quien sale del producto.
 *
 * Pedido del dueño (7 sep 2026): «me devolvió a /solutions cuando salí
 * de linksy.lat». La landing vieja de Solutions ya no existe como
 * destino: cerrar sesión, y cualquier ruta que antes llevara ahí, vuelve
 * a la portada de Linksy. En producción es `https://linksy.lat/`
 * (`NEXT_PUBLIC_LINKSY_URL`, la misma variable que arma los links y los
 * QR); sin la variable —local, previews— es `/linksy`, la misma página
 * servida desde bookea.lat.
 */
export function urlLinksy(): string {
  const base = (process.env.NEXT_PUBLIC_LINKSY_URL ?? "").trim().replace(/[/]+$/, "");
  return base ? `${base}/` : "/solutions";
}
