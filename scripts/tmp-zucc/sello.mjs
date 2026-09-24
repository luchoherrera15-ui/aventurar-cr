import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA GALLETA COMO SELLO DE LA TARJETA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «en la tarjeta digital utilizá esta
 * imagen para los sellos».
 *
 * ── POR QUÉ NO SE PUEDE USAR TAL CUAL ───────────────────────────────
 *
 * El sello se dibuja adentro de un círculo de unos 24 px. La foto es
 * un plato entero: a ese tamaño el plato se come el cuadro y la galleta
 * queda en 8 px. Y el plato, recortado en círculo sobre el chocolate
 * del pase, dejaría un disco gris claro con una manchita adentro.
 *
 * ── CÓMO SE SACA EL FONDO ───────────────────────────────────────────
 *
 * No por distancia al color de una esquina: el plato y el fondo son dos
 * claros distintos y un solo color de referencia deja siempre uno de
 * los dos. Se usa lo que de verdad los separa de la galleta:
 *
 *     el plato y el fondo son CLAROS y NEUTROS
 *     la galleta es MEDIA y SATURADA (tostado)
 *
 * Medido: plato ≈ #d9d6d1 (luz 215, saturación 8), galleta ≈ #c9a271
 * (luz 168, saturación 88). La saturación los separa sin ambigüedad, y
 * los trozos de chocolate son oscuros, así que la luz los salva.
 *
 * El borde va con una rampa entre los dos umbrales, o el recorte queda
 * dentado — a 24 px un borde escalonado se ve como suciedad.
 *
 * ── POR QUÉ VA A SUPABASE Y NO A CLOUDFLARE ─────────────────────────
 *
 * `crear-actions.ts` valida el sello propio con
 * `esUrlDeNuestroStorage(url, "ranchos-fotos")`, que exige una URL de
 * storage de Supabase. Una de Cloudflare se VERÍA igual hoy —el lector
 * acepta cualquier https— pero el día que el dueño edite su tarjeta
 * desde el panel, el guardado la rechazaría y el sello desaparecería
 * sin que nadie entienda por qué.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const SRC =
  "C:/Users/LUISH~1/AppData/Local/Temp/claude/c--Users-luis-h-aventurar-cr/c01bf0b5-8e4d-4e60-a6b2-7e69750d54ee/images/21.png";

/** La galleta de adelante, medida sobre un aumento de 2× del plato. */
const CAJA = { left: 897, top: 4919, width: 82, height: 68 };

const { data, info } = await sharp(SRC)
  .extract(CAJA)
  // ×6 antes de calar: el borde se calcula sobre más píxeles y queda
  // limpio. Calar primero y agrandar después agranda los dientes.
  .resize({ width: CAJA.width * 6, kernel: "lanczos3" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const LUZ = 188;      // por encima de esto empieza a ser «claro»
const SAT_FONDO = 26; // por debajo de esto es «neutro»
const SAT_GALLETA = 52;

for (let i = 0; i < data.length; i += info.channels) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const luz = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);

  if (luz <= LUZ) continue;           // oscuro: es galleta o chocolate
  if (sat >= SAT_GALLETA) continue;   // saturado: es galleta
  data[i + 3] =
    sat <= SAT_FONDO
      ? 0
      : Math.round(((sat - SAT_FONDO) / (SAT_GALLETA - SAT_FONDO)) * 255);
}

const galleta = await sharp(data, { raw: info })
  .png()
  .trim({ threshold: 1 })   // recorta el transparente que sobra
  .toBuffer();

/** Cuadrado de 256 con aire: el pase lo mete en un círculo. */
const png = await sharp({
  create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: await sharp(galleta).resize(212, 212, { fit: "inside" }).toBuffer(), gravity: "center" },
  ])
  .png()
  .toBuffer();

await sharp(png).toFile("scripts/tmp-zucc/sello-galleta.png");
// Una previa sobre el chocolate del pase: es donde de verdad va a vivir.
await sharp({ create: { width: 256, height: 256, channels: 3, background: "#3a2b21" } })
  .composite([{ input: png }])
  .png()
  .toFile("scripts/tmp-zucc/sello-sobre-pase.png");

const ruta = "lealtad/zuccherino-sello-galleta-v2.png";
const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/ranchos-fotos/${ruta}`,
  {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "image/png",
      "x-upsert": "true",
    },
    body: png,
  },
);
console.log("subida:", res.status);
console.log(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ranchos-fotos/${ruta}`,
);
