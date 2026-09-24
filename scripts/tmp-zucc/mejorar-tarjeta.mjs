import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA TARJETA, MEJOR
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «la tarjeta creo que podemos
 * mejorarla un poco más en cuanto a diseño».
 *
 * Cuatro cambios, y los cuatro salen de la foto que mandó:
 *
 * 1. **El logo de verdad.** Hasta ahora iba un monograma que dibujé yo
 *    porque no había otro. Ahora va la «Z» en su marco ovalado, calada
 *    del vaso.
 *
 * 2. **Su verde, no mi chocolate.** El fondo era #3a2b21, un marrón que
 *    elegí yo para que el texto blanco se leyera. Su color de marca es
 *    #01675f —medido del trazo del logo— y con blanco encima da 7,4:1.
 *    O sea que ya no hay que elegir entre legible y suyo.
 *
 * 3. **Un banner.** El pase soporta una franja arriba y estaba vacía.
 *    Va la composición de su vaso con las galletas, que es exactamente
 *    lo que el cliente se está llevando.
 *
 * 4. **La galleta como sello**, nítida y de estudio, en vez del recorte
 *    de 88 px de la captura del sitio.
 *
 * ── POR QUÉ EL BANNER SE ARMA Y NO SE RECORTA ───────────────────────
 *
 * La foto es cuadrada y el banner del pase es una franja de 2,6:1.
 * Recortarla dejaría fuera el vaso o las galletas. Así que se toma el
 * contenido —sin el aro menta del borde, que a lo ancho se vería como
 * dos rayas sueltas— y se apoya sobre su menta, centrado.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
const SRC =
  "C:/Users/LUISH~1/AppData/Local/Temp/claude/c--Users-luis-h-aventurar-cr/c01bf0b5-8e4d-4e60-a6b2-7e69750d54ee/images/22.png";

const VERDE = "#01675f";
const MENTA = "#dbeae6";

// ── EL BANNER ───────────────────────────────────────────────────────
// 1125 × 432 es la franja de Apple Wallet. El contenido se recorta por
// dentro del aro y se apoya centrado sobre la menta.
const contenido = await sharp(SRC)
  .extract({ left: 215, top: 200, width: 900, height: 820 })
  .resize({ height: 400, fit: "inside" })
  .png()
  .toBuffer();

const banner = await sharp({
  create: { width: 1125, height: 432, channels: 3, background: MENTA },
})
  .composite([{ input: contenido, gravity: "center" }])
  .png()
  .toBuffer();

await sharp(banner).toFile("scripts/tmp-zucc/banner-zucc.png");

async function subir(nombre, buf) {
  const ruta = `lealtad/${nombre}`;
  const res = await fetch(`${U}/storage/v1/object/ranchos-fotos/${ruta}`, {
    method: "POST",
    headers: {
      apikey: K,
      Authorization: `Bearer ${K}`,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`${nombre}: ${res.status} ${await res.text()}`);
  return `${U}/storage/v1/object/public/ranchos-fotos/${ruta}`;
}

const urlBanner = await subir("zuccherino-banner-v3.png", banner);
const urlLogo = `${U}/storage/v1/object/public/ranchos-fotos/lealtad/zuccherino-logo-v3.png`;
const urlSello = `${U}/storage/v1/object/public/ranchos-fotos/lealtad/zuccherino-sello-v3.png`;

// ── LA TARJETA ──────────────────────────────────────────────────────
const cab = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" };

const r1 = await fetch(
  `${U}/rest/v1/programa_lealtad?rancho_id=eq.01f358cb-5a88-4644-b7a8-84cdda49ebed`,
  {
    method: "PATCH",
    headers: cab,
    body: JSON.stringify({
      pase_color_fondo: VERDE,
      pase_color_sello: MENTA,
      pase_logo_url: urlLogo,
      pase_banner_url: urlBanner,
      pase_sello_icono: "propio",
      pase_sello_icono_url: urlSello,
    }),
  },
);
const p = (await r1.json())[0];
console.log("pase:", p.pase_color_fondo, "· banner:", Boolean(p.pase_banner_url), "· sello:", p.pase_sello_icono);

// ── Y EL LINK HUB, QUE USABA EL MISMO LOGO INVENTADO ────────────────
const r2 = await fetch(`${U}/rest/v1/solutions_negocios?slug=eq.zuccherino`, {
  method: "PATCH",
  headers: cab,
  body: JSON.stringify({ logo_url: urlLogo }),
});
console.log("hub:", r2.status, "logo actualizado");
