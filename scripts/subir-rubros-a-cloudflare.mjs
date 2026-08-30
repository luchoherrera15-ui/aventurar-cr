/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS SEIS FOTOS DEL DESFILE DE RUBROS → CLOUDFLARE IMAGES
 * ════════════════════════════════════════════════════════════════════
 *
 * Trae las fotos de Pexels (licencia libre, sin atribución obligatoria)
 * y las sube a Cloudflare Images con el id `lealtad/rubros/<rubro>`, que
 * es exactamente lo que arma `src/lib/lealtad/pantallas-rubro.ts`.
 *
 * NO se guardan en `public/`: el 30 ago 2026 se vació esa carpeta de
 * 61 MB a 1,6 MB porque su peso se clonaba y volvía a subir en cada
 * despliegue. Seis fotos nuevas ahí habrían empezado a deshacerlo.
 *
 * Idempotente: un id repetido devuelve «ya existe» y cuenta como éxito.
 *
 * Uso:  node scripts/subir-rubros-a-cloudflare.mjs
 *       node scripts/subir-rubros-a-cloudflare.mjs --listar
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const SOLO_LISTAR = process.argv.includes("--listar");

/** id del rubro → id de la foto en Pexels. Elegidas a mano y miradas
 *  una por una: el repo ya descartó una foto de café por mostrar la
 *  marca de la máquina, así que acá tampoco entra ninguna con una marca
 *  ajena reconocible. */
const FOTOS = [
  { rubro: "barberia", pexels: 7518728 },
  { rubro: "belleza", pexels: 3993449 },
  // 6873020 (un cepillo contra la carrocería) se leía como cepillo de
  // PELO dentro del teléfono chico: se cambió por un auto entero en el
  // lavadero, que no deja dudas del rubro.
  { rubro: "lavacar", pexels: 3354648 },
  { rubro: "tienda", pexels: 7857535 },
  { rubro: "joyeria", pexels: 20858959 },
  { rubro: "cafeteria", pexels: 2467287 },
];

/** Vertical y grande: entra en un teléfono de 9/17 sin recorte feo. */
const urlPexels = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&h=2100&fit=crop`;

function entorno() {
  const archivo = path.join(RAIZ, ".env.local");
  if (!existsSync(archivo)) throw new Error("No encuentro .env.local");
  const env = {};
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  const faltan = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_IMAGES_API_TOKEN"].filter((v) => !env[v]);
  if (faltan.length) throw new Error(`Faltan variables: ${faltan.join(", ")}`);
  return env;
}

async function subir(env, { rubro, pexels }) {
  const id = `lealtad/rubros/${rubro}`;
  const res = await fetch(urlPexels(pexels));
  if (!res.ok) return { rubro, estado: "error", detalle: `Pexels devolvió ${res.status}` };
  const bytes = Buffer.from(await res.arrayBuffer());

  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: "image/jpeg" }), `${rubro}.jpg`);
  fd.append("id", id);

  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_IMAGES_API_TOKEN}` },
      body: fd,
    },
  );
  const json = await r.json().catch(() => ({}));
  if (json.success) return { rubro, estado: "subida", kb: Math.round(bytes.length / 1024) };
  const textos = (json.errors || []).map((e) => e.message).join(" ");
  if (r.status === 409 || /exist/i.test(textos)) return { rubro, estado: "ya-estaba" };
  return { rubro, estado: "error", detalle: textos || r.status };
}

if (SOLO_LISTAR) {
  for (const f of FOTOS) console.log(`${f.rubro.padEnd(10)} pexels:${f.pexels}  →  lealtad/rubros/${f.rubro}`);
} else {
  const env = entorno();
  for (const f of FOTOS) {
    const r = await subir(env, f);
    console.log(
      `${r.rubro.padEnd(10)} ${r.estado}${r.kb ? ` (${r.kb} KB)` : ""}${r.detalle ? " — " + r.detalle : ""}`,
    );
    if (r.estado === "error") process.exitCode = 1;
  }
}
