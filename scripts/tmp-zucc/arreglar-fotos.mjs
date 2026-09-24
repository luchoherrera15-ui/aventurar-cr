import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Dos correcciones después de ver el menú armado.
 *
 * 1. **Las fotos de estudio no aparecían.** Se subieron con el MISMO id
 *    de las viejas (borrar + volver a subir), pero Cloudflare sirve por
 *    CDN y siguió entregando la versión cacheada. Van con id nuevo: una
 *    URL distinta no tiene caché que valga.
 *
 * 2. **El banner arrastraba un texto.** El recorte del héroe llegaba
 *    hasta la franja menta de abajo, donde dice «Beneficios de
 *    septiembre» — y en la portada aparecía ese texto fantasma. Se
 *    sube el corte inferior.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const CUENTA = env.CLOUDFLARE_ACCOUNT_ID, TOKEN = env.CLOUDFLARE_IMAGES_API_TOKEN;
const HASH = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
const cab = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" };

const NUEVAS = {
  "Carrot cake": "carrot cacke",
  "Cheesecake de pistacho": "pistacho cheesecake",
  "Torta de chocolate": "tarta de chocolate",
  "Tarta Ópera": "tarta opera",
};

const [negocio] = await (await fetch(
  `${U}/rest/v1/solutions_negocios?slug=eq.zuccherino&select=id`, { headers: cab })).json();

for (const [plato, archivo] of Object.entries(NUEVAS)) {
  const id = `zucc-hd-${archivo.replace(/\s+/g, "-")}`;
  const jpg = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: "#ffffff" } })
    .composite([{
      input: await sharp(`puramatcha/zuccherino menú/${archivo}.png`).resize(940, 940, { fit: "inside" }).toBuffer(),
      gravity: "center",
    }])
    .jpeg({ quality: 90 }).toBuffer();

  const form = new FormData();
  form.append("id", id);
  form.append("file", new Blob([jpg], { type: "image/jpeg" }), `${id}.jpg`);
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CUENTA}/images/v1`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: form,
  });
  const j = await res.json();
  if (!j.success && !JSON.stringify(j.errors).includes("already exists")) {
    console.error("FALLÓ", id, JSON.stringify(j.errors)); continue;
  }
  const url = `https://imagedelivery.net/${HASH}/${id}/gallery`;

  // El mismo plato aparece en la carta Y en una franja horaria; solo
  // lleva foto el de la carta, así que se filtra por foto no nula.
  const r = await fetch(
    `${U}/rest/v1/solutions_menu_items?negocio_id=eq.${negocio.id}&nombre=eq.${encodeURIComponent(plato)}&foto_url=not.is.null`,
    { method: "PATCH", headers: cab, body: JSON.stringify({ foto_url: url }) },
  );
  console.log(plato, "→", (await r.json()).length, "ficha(s)");
}

// ── EL BANNER, SIN EL TEXTO DE ABAJO ────────────────────────────────
const SRC = "C:/Users/LUISH~1/AppData/Local/Temp/claude/c--Users-luis-h-aventurar-cr/c01bf0b5-8e4d-4e60-a6b2-7e69750d54ee/images/21.png";
const banner = await sharp(SRC)
  .extract({ left: 0, top: 250, width: 1920, height: 560 })
  .jpeg({ quality: 90 }).toBuffer();

const ruta = "lealtad/zuccherino-portada-banner-v2.jpg";
await fetch(`${U}/storage/v1/object/ranchos-fotos/${ruta}`, {
  method: "POST",
  headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
  body: banner,
});
const r2 = await fetch(`${U}/rest/v1/solutions_negocios?slug=eq.zuccherino`, {
  method: "PATCH", headers: cab,
  body: JSON.stringify({ foto_portada_url: `${U}/storage/v1/object/public/ranchos-fotos/${ruta}` }),
});
console.log("banner:", (await r2.json())[0].foto_portada_url.slice(-24));
