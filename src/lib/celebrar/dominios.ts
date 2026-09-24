import { SITIO } from "@/lib/sitio";
import { rutaInternaSegura } from "@/lib/url-segura";
import { PREFIJO_CELEBRAR, RUTA } from "./rutas";

/**
 * ══════════════════════════════════════════════════════════════════
 *  CELEBRAR.LAT — UN PRODUCTO, DOS PUERTAS
 * ══════════════════════════════════════════════════════════════════
 *
 * Hoy CELEBRAR se sirve en `bookea.lat/celebrar/…`. El día que exista
 * `celebrar.lat`, el MISMO despliegue tiene que responder también ahí,
 * sin duplicar un archivo: `celebrar.lat/app` es `bookea.lat/celebrar/app`.
 *
 * Este módulo decide, con funciones PURAS y probadas en
 * `dominios.test.ts`, qué hacer con cada petición según el host y la
 * ruta. `src/proxy.ts` solo ejecuta lo que estas funciones deciden —
 * igual que hace con Linksy (`src/lib/solutions/dominios.ts`), que es
 * el precedente de este patrón en el repo. No se comparte código con
 * ese módulo a propósito: cada producto tiene sus rutas, y un cambio
 * en las de uno no debe poder romper al otro.
 *
 * El interruptor del estreno es UNA variable de entorno:
 *   NEXT_PUBLIC_CELEBRAR_URL=https://celebrar.lat
 * Vacía, todo lo que se comparte (links, QR, Open Graph) apunta a
 * `bookea.lat/celebrar`; puesta, apunta al dominio propio. Nada más
 * cambia en el código.
 */

export const CELEBRAR_HOST = "celebrar.lat";

/** ¿El host de la petición es el dominio propio de CELEBRAR? */
export function esHostCelebrar(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase().split(":")[0];
  return h === CELEBRAR_HOST || h === `www.${CELEBRAR_HOST}`;
}

/**
 * El prefijo que hay que anteponer a una ruta de `RUTA` para que sea
 * navegable en ESTE host: "" en `celebrar.lat`, "/celebrar" en Bookea.
 */
export function prefijoParaHost(host: string | null | undefined): string {
  return esHostCelebrar(host) ? "" : PREFIJO_CELEBRAR;
}

/**
 * Completa una ruta de `RUTA` con el prefijo del host. `conPrefijo("/", "/celebrar")`
 * es "/celebrar" (no "/celebrar/"), y `conPrefijo("/", "")` es "/".
 */
export function conPrefijo(ruta: string, prefijo: string): string {
  const r = ruta.startsWith("/") ? ruta : `/${ruta}`;
  if (!prefijo) return r;
  if (r === "/") return prefijo;
  // "/#precios" → "/celebrar#precios": el ancla cuelga del prefijo, no
  // de una barra suelta.
  if (r.startsWith("/#")) return `${prefijo}${r.slice(1)}`;
  return `${prefijo}${r}`;
}

/** Quita el prefijo si lo trae. Sirve para comparar rutas entre hosts. */
export function sinPrefijo(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === PREFIJO_CELEBRAR) return "/";
  if (p.startsWith(`${PREFIJO_CELEBRAR}/`)) return p.slice(PREFIJO_CELEBRAR.length);
  return p;
}

/** ¿Está esta ruta (con o sin prefijo) dentro de CELEBRAR? */
export function esRutaDeCelebrar(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === PREFIJO_CELEBRAR || p.startsWith(`${PREFIJO_CELEBRAR}/`);
}

export type DestinoCelebrar =
  | { tipo: "rewrite"; pathname: string }
  | { tipo: "redirect"; pathname: string }
  | { tipo: "pasar" };

/**
 * Qué hacer con una petición que llegó por `celebrar.lat`.
 *
 *  - "/"                → rewrite a /celebrar (la portada)
 *  - "/app", "/entrar", "/maria-y-juan", …  → rewrite con el prefijo
 *  - "/auth/callback"   → rewrite a /celebrar/auth/callback (el
 *                         aterrizaje del login vive dentro del producto)
 *  - "/celebrar/…"      → redirect a la misma ruta SIN prefijo: bajo el
 *                         dominio propio la URL canónica no lo lleva
 *  - "/api/…", "/_next/…", archivos con extensión → pasar tal cual
 *
 * Todo lo que no es de CELEBRAR (por ejemplo `/mi-negocio`) cae en el
 * rewrite general y termina en el 404 de CELEBRAR: bajo `celebrar.lat`
 * no se sirve Bookea. Es lo mismo que hace Linksy con su dominio.
 */
export function destinoEnCelebrar(pathname: string): DestinoCelebrar {
  const p = pathname.replace(/\/+$/, "") || "/";

  if (p === "/") return { tipo: "rewrite", pathname: PREFIJO_CELEBRAR };
  if (p.startsWith("/api/") || p.startsWith("/_next/")) return { tipo: "pasar" };

  const primero = p.split("/").filter(Boolean)[0] ?? "";
  // robots.txt, sitemap.xml, favicon.ico, *.png… — siguen su camino.
  // Cuando CELEBRAR tenga sitemap propio (Fase 9) acá se reescriben.
  if (primero.includes(".")) return { tipo: "pasar" };

  if (esRutaDeCelebrar(p)) {
    return { tipo: "redirect", pathname: sinPrefijo(p) };
  }

  if (p === RUTA.authCallback) {
    return { tipo: "rewrite", pathname: `${PREFIJO_CELEBRAR}${RUTA.authCallback}` };
  }

  return { tipo: "rewrite", pathname: `${PREFIJO_CELEBRAR}${p}` };
}

/**
 * La URL pública de CELEBRAR (la que se comparte por WhatsApp, va en
 * los QR y en el Open Graph). Con `NEXT_PUBLIC_CELEBRAR_URL` puesta es
 * el dominio propio; sin ella, Bookea con el prefijo.
 */
export function sitioCelebrar(
  entorno: string | undefined = process.env.NEXT_PUBLIC_CELEBRAR_URL,
): string {
  const propio = (entorno ?? "").trim().replace(/\/+$/, "");
  if (propio) return propio;
  return `${SITIO}${PREFIJO_CELEBRAR}`;
}

export function hayDominioPropio(
  entorno: string | undefined = process.env.NEXT_PUBLIC_CELEBRAR_URL,
): boolean {
  return (entorno ?? "").trim() !== "";
}

/** `urlPublicaCelebrar("/app")` → "https://www.bookea.lat/celebrar/app" (o el dominio propio). */
export function urlPublicaCelebrar(
  ruta: string,
  entorno: string | undefined = process.env.NEXT_PUBLIC_CELEBRAR_URL,
): string {
  const base = sitioCelebrar(entorno);
  const r = ruta.startsWith("/") ? ruta : `/${ruta}`;
  if (r === "/") return base;
  if (r.startsWith("/#")) return `${base}${r.slice(1)}`;
  return `${base}${r}`;
}

/**
 * A dónde volver después de entrar. `next` viene de la URL y no se le
 * cree a ciegas: tiene que ser una ruta interna (cero open redirect,
 * ver `rutaInternaSegura`) Y quedarse dentro de CELEBRAR. En Bookea eso
 * quiere decir que arranca con `/celebrar`; en `celebrar.lat` cualquier
 * ruta interna es de CELEBRAR. Ante la duda, al panel.
 */
export function destinoDentroDeCelebrar(
  next: string | null | undefined,
  prefijo: string,
  origin = "https://www.bookea.lat",
): string {
  const porDefecto = conPrefijo(RUTA.app, prefijo);
  const segura = rutaInternaSegura(next, origin);
  if (!segura) return porDefecto;
  if (prefijo && !esRutaDeCelebrar(segura)) return porDefecto;
  // Volver al propio login sería un bucle.
  if (sinPrefijo(segura).startsWith(RUTA.entrar)) return porDefecto;
  return segura;
}
