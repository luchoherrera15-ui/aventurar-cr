// Sube los tres PNG originales de ChatGPT (referencia/imagenes) a Cloudflare
// Images con un id fijo por escena, y dice qué URL de entrega usar.
// Empareja cada PNG con la escena comparando contra los webp actuales.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const raiz = "c:/Users/luis h/aventurar-cr";
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()];
    }),
);
const cuenta = env.CLOUDFLARE_ACCOUNT_ID;
const token = env.CLOUDFLARE_IMAGES_API_TOKEN;
const entrega = env.CLOUDFLARE_IMAGES_DELIVERY_URL.replace(/[/]+$/, "");
if (!cuenta || !token || !entrega) throw new Error("faltan variables de Cloudflare en .env.local");

const escenas = ["gimnasio", "restaurante", "lavacar"];
const dirOrig = path.join(raiz, "referencia/imagenes");
const originales = fs.readdirSync(dirOrig).filter((f) => f.toLowerCase().endsWith(".png"));

// Huella chica (16×16 gris) para emparejar original ↔ webp actual.
async function huella(archivo) {
  const buf = await sharp(archivo).resize(16, 16, { fit: "fill" }).grayscale().raw().toBuffer();
  return [...buf];
}
const distancia = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);

const huellasOrig = await Promise.all(originales.map((f) => huella(path.join(dirOrig, f))));
const pares = {};
for (const e of escenas) {
  const h = await huella(path.join(raiz, "public/linksy", `${e}.webp`));
  let mejor = 0;
  for (let i = 1; i < originales.length; i++) if (distancia(h, huellasOrig[i]) < distancia(h, huellasOrig[mejor])) mejor = i;
  pares[e] = originales[mejor];
}
console.log("emparejado:", pares);
if (new Set(Object.values(pares)).size !== escenas.length) throw new Error("dos escenas apuntan al mismo original");

async function cf(ruta, init) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/images/v1${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok && j.success !== false, j };
}

for (const e of escenas) {
  const id = `linksy-hero-${e}`;
  const archivo = path.join(dirOrig, pares[e]);
  // Si ya existe (409), se borra y se vuelve a subir: queremos el original de ahora.
  const previo = await cf(`/${id}`, { method: "GET" });
  if (previo.ok) {
    const b = await cf(`/${id}`, { method: "DELETE" });
    console.log(`${id}: existía, borrado →`, b.status);
  }
  const form = new FormData();
  form.set("file", new Blob([fs.readFileSync(archivo)], { type: "image/png" }), `${e}.png`);
  form.set("id", id);
  form.set("metadata", JSON.stringify({ producto: "linksy", uso: "hero", escena: e, origen: pares[e] }));
  const r = await cf("", { method: "POST", body: form });
  if (!r.ok) {
    console.error(`${id}: FALLÓ`, r.status, JSON.stringify(r.j.errors ?? r.j).slice(0, 300));
    process.exit(1);
  }
  const m = await sharp(archivo).metadata();
  console.log(`${id}: subida ${m.width}×${m.height} →`, `${entrega}/${id}/gallery`);
}
