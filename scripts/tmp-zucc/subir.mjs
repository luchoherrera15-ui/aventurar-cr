import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  SUBIR LAS FOTOS DE ZUCCHERINO A CLOUDFLARE IMAGES
 * ════════════════════════════════════════════════════════════════════
 *
 * ── POR QUÉ LEE EL .env.local A MANO ────────────────────────────────
 *
 * `source ./.env.local` en Git Bash se corta en alguna línea larga y
 * deja variables vacías — se probó y las de Cloudflare volvían en
 * blanco aunque están en el archivo. Leer y parsear acá es dos líneas
 * y no depende del shell.
 *
 * ── LOS IDS SON LEGIBLES, NO UUID ───────────────────────────────────
 *
 * `zuccherino-<producto>`. Cloudflare deja elegir el id, y uno legible
 * hace que la URL de la foto diga qué es: si mañana hay que revisar
 * cuál se rompió, se ve en el log sin abrir nada. Es lo mismo que ya
 * se hizo con `linksy-hero-*`.
 *
 * Es idempotente: si el id ya existe, Cloudflare devuelve 409 y el
 * script lo cuenta como «ya estaba» en vez de fallar. Así se puede
 * correr de nuevo sin borrar nada.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const CUENTA = env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = env.CLOUDFLARE_IMAGES_API_TOKEN;
const HASH = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
if (!CUENTA || !TOKEN || !HASH) throw new Error("faltan credenciales de Cloudflare");

const DIR = "scripts/tmp-zucc/fotos";
const archivos = (await readdir(DIR)).filter((f) => f.endsWith(".jpg")).sort();

const salida = {};
let subidas = 0;
let yaEstaban = 0;

for (const archivo of archivos) {
  const base = archivo.replace(/\.jpg$/, "");
  const id = `zuccherino-${base}`;
  const bin = await readFile(`${DIR}/${archivo}`);

  const form = new FormData();
  form.append("id", id);
  form.append("file", new Blob([bin], { type: "image/jpeg" }), archivo);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CUENTA}/images/v1`,
    { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: form },
  );
  const json = await res.json();

  if (json.success) {
    subidas++;
  } else if (JSON.stringify(json.errors).includes("already exists")) {
    yaEstaban++;
  } else {
    console.error("FALLÓ", id, JSON.stringify(json.errors));
    continue;
  }
  salida[base] = `https://imagedelivery.net/${HASH}/${id}/gallery`;
}

console.log(`subidas: ${subidas} · ya estaban: ${yaEstaban} · total: ${Object.keys(salida).length}`);
console.log(JSON.stringify(salida, null, 2));
