import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Dos correcciones después de ver el pase armado.
 *
 * 1. **Fuera el banner.** El pase no lo dibuja como una franja aparte:
 *    lo usa de FONDO de la fila de sellos. Con una foto detrás, los
 *    ocho discos blancos quedaron ilegibles. La franja sirve para una
 *    textura plana, no para una composición con objetos.
 *
 * 2. **El logo, en blanco.** Su verde (#01675f) sobre su mismo verde de
 *    fondo da 1:1 — el logo desaparecía. Se rellena la silueta ya
 *    calada con blanco: mismo dibujo, tinta que sí se ve.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;

// El logo calado, repintado de blanco: se toma su canal alfa como
// máscara y se aplica sobre un cuadrado blanco.
const base = await sharp("scripts/tmp-zucc/logo-zucc.png").ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
for (let i = 0; i < base.data.length; i += base.info.channels) {
  base.data[i] = 255; base.data[i + 1] = 255; base.data[i + 2] = 255;
}
const blanco = await sharp(base.data, { raw: base.info }).png().toBuffer();
await sharp(blanco).toFile("scripts/tmp-zucc/logo-blanco.png");

const res = await fetch(`${U}/storage/v1/object/ranchos-fotos/lealtad/zuccherino-logo-blanco.png`, {
  method: "POST",
  headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "image/png", "x-upsert": "true" },
  body: blanco,
});
console.log("logo blanco:", res.status);

const r = await fetch(`${U}/rest/v1/programa_lealtad?rancho_id=eq.01f358cb-5a88-4644-b7a8-84cdda49ebed`, {
  method: "PATCH",
  headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({
    pase_banner_url: null,
    pase_logo_url: `${U}/storage/v1/object/public/ranchos-fotos/lealtad/zuccherino-logo-blanco.png`,
  }),
});
const p = (await r.json())[0];
console.log("banner:", p.pase_banner_url, "· logo:", p.pase_logo_url.slice(-24));
