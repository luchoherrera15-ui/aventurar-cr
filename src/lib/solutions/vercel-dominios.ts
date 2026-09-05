import "server-only";

import { promises as dns } from "node:dns";
import { CABECERA_DOMINIO, VERCEL_A, esApex } from "./dominios";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL DOMINIO PROPIO, DEL LADO DEL SERVIDOR — Vercel, DNS y la sonda
 * ════════════════════════════════════════════════════════════════════
 *
 * Tres cosas que solo pueden pasar en Node y con secretos:
 *
 *   · Registrar / quitar el dominio en el proyecto de Vercel, por API.
 *     Necesita VERCEL_TOKEN y VERCEL_PROJECT_ID (y VERCEL_TEAM_ID si el
 *     proyecto es de un equipo). Sin ellos no falla: devuelve
 *     `configurado: false` y el dominio queda para que Bookea lo agregue
 *     a mano en el tablero de Vercel — la nota se lo dice al negocio.
 *
 *   · Mirar el DNS del dominio (A o CNAME), para poder decirle al
 *     negocio «tu registro todavía no apunta acá» con el valor que
 *     encontramos, en vez de un «no funciona» mudo.
 *
 *   · LA SONDA: una petición HTTPS real al dominio buscando la cabecera
 *     que pone nuestro proxy. Es la única prueba que vale para «activo»:
 *     si vuelve, el DNS, Vercel y el certificado están bien a la vez.
 */

const API = "https://api.vercel.com";

function credenciales() {
  const token = process.env.VERCEL_TOKEN;
  const proyecto = process.env.VERCEL_PROJECT_ID;
  const equipo = process.env.VERCEL_TEAM_ID;
  if (!token || !proyecto) return null;
  return { token, proyecto, sufijo: equipo ? `?teamId=${encodeURIComponent(equipo)}` : "" };
}

export function vercelConfigurado(): boolean {
  return credenciales() !== null;
}

export type ResultadoVercel = { configurado: false } | { configurado: true; ok: boolean; motivo?: string };

/** Agrega el dominio al proyecto. Idempotente: si ya estaba, es ok. */
export async function agregarDominioEnVercel(dominio: string): Promise<ResultadoVercel> {
  const c = credenciales();
  if (!c) return { configurado: false };
  try {
    const r = await fetch(`${API}/v10/projects/${c.proyecto}/domains${c.sufijo}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: dominio }),
      cache: "no-store",
    });
    if (r.ok) return { configurado: true, ok: true };
    const cuerpo = (await r.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (cuerpo.error?.code === "domain_already_in_use" || r.status === 409) return { configurado: true, ok: true };
    return { configurado: true, ok: false, motivo: cuerpo.error?.message ?? `Vercel respondió ${r.status}` };
  } catch (e) {
    return { configurado: true, ok: false, motivo: e instanceof Error ? e.message : "No se pudo hablar con Vercel." };
  }
}

export async function quitarDominioEnVercel(dominio: string): Promise<ResultadoVercel> {
  const c = credenciales();
  if (!c) return { configurado: false };
  try {
    const r = await fetch(`${API}/v9/projects/${c.proyecto}/domains/${encodeURIComponent(dominio)}${c.sufijo}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${c.token}` },
      cache: "no-store",
    });
    return { configurado: true, ok: r.ok || r.status === 404 };
  } catch (e) {
    return { configurado: true, ok: false, motivo: e instanceof Error ? e.message : "No se pudo hablar con Vercel." };
  }
}

export type LecturaDns = { apunta: boolean; detalle: string };

/** ¿El DNS del dominio ya apunta a Vercel? Con lo que se encontró, para decirlo. */
export async function leerDns(dominio: string): Promise<LecturaDns> {
  const apex = esApex(dominio);
  const a = await dns.resolve4(dominio).catch(() => [] as string[]);
  const cname = apex ? [] : await dns.resolveCname(dominio).catch(() => [] as string[]);
  if (cname.some((c) => c.toLowerCase().endsWith("vercel-dns.com"))) return { apunta: true, detalle: `CNAME → ${cname[0]}` };
  if (a.includes(VERCEL_A)) return { apunta: true, detalle: `A → ${VERCEL_A}` };
  if (cname.length > 0) return { apunta: false, detalle: `CNAME → ${cname.join(", ")} (esperábamos cname.vercel-dns.com)` };
  if (a.length > 0) return { apunta: false, detalle: `A → ${a.join(", ")} (esperábamos ${VERCEL_A})` };
  return { apunta: false, detalle: "todavía no resuelve: el registro no existe o no se propagó" };
}

/**
 * La sonda: pide la raíz del dominio por HTTPS y busca la cabecera del
 * proxy con el slug esperado. Sin seguir redirecciones y con 8 s de
 * tope: un dominio que no responde no puede colgar el panel.
 */
export async function sondaDominio(dominio: string, slug: string): Promise<{ vivo: boolean; detalle: string }> {
  try {
    const r = await fetch(`https://${dominio}/`, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Bookea-Solutions-sonda/1" },
    });
    const marca = r.headers.get(CABECERA_DOMINIO);
    if (marca === slug) return { vivo: true, detalle: "responde con tu página" };
    if (marca) return { vivo: false, detalle: "responde, pero con la página de otro negocio" };
    return { vivo: false, detalle: `responde (${r.status}) pero no con tu página: falta activarlo en Vercel` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/certificate|CERT|SSL|TLS/i.test(msg)) return { vivo: false, detalle: "el certificado todavía no está listo (suele tardar unos minutos)" };
    return { vivo: false, detalle: "no responde todavía" };
  }
}
