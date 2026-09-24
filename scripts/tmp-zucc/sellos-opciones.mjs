import sharp from "sharp";

/**
 * Las dos lecturas de «usá esta imagen para los sellos», al tamaño en
 * que el pase los dibuja de verdad.
 *
 * En el pase, ocho sellos entran en una tarjeta de ~300 px: cada disco
 * mide unos 32 px. Todo lo que se decida acá hay que mirarlo a ESE
 * tamaño, no a 500.
 *
 *   A · la composición entera (vaso + galletas + aro)
 *   B · solo la galleta, recortada y sin fondo
 */

const SRC = "puramatcha/zuccherino menú/sellos card.png";
const VERDE = "#01675f";

// ── A: la composición entera ────────────────────────────────────────
const completa = await sharp(SRC).resize(512, 512, { fit: "inside" }).png().toBuffer();

// ── B: la galleta sola ──────────────────────────────────────────────
const { data, info } = await sharp(SRC)
  .extract({ left: 722, top: 628, width: 288, height: 172 })
  .resize({ width: 288 * 3, kernel: "lanczos3" })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += info.channels) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const luz = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (luz <= 186 || sat >= 54) continue;
  data[i + 3] = sat <= 24 ? 0 : Math.round(((sat - 24) / 30) * 255);
}
const recorte = await sharp(data, { raw: info }).png().trim({ threshold: 1 }).toBuffer();
const galleta = await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([{ input: await sharp(recorte).resize(430, 430, { fit: "inside" }).toBuffer(), gravity: "center" }])
  .png().toBuffer();

await sharp(galleta).toFile("scripts/tmp-zucc/sello-galleta-final.png");

// ── La comparación, como los dibuja el pase ─────────────────────────
const disco = Buffer.from('<svg width="256" height="256"><circle cx="128" cy="128" r="128" fill="#fff"/></svg>');
const piezas = [];
for (const [i, img] of [completa, galleta].entries()) {
  const sello = await sharp(disco)
    .composite([{ input: await sharp(img).resize(200, 200, { fit: "inside" }).toBuffer(), gravity: "center" }])
    .png().toBuffer();
  // Fila de cuatro a 32 px — el tamaño real — y uno grande al lado.
  for (let n = 0; n < 4; n++) {
    piezas.push({ input: await sharp(sello).resize(32, 32).toBuffer(), left: 24 + n * 40, top: 24 + i * 90 });
  }
  piezas.push({ input: await sharp(sello).resize(72, 72).toBuffer(), left: 210, top: 4 + i * 90 });
  piezas.push({
    input: Buffer.from(`<svg width="60" height="20"><text x="0" y="15" font-family="sans-serif" font-size="15" fill="#fff">${i === 0 ? "A" : "B"}</text></svg>`),
    left: 300, top: 36 + i * 90,
  });
}
await sharp({ create: { width: 360, height: 190, channels: 3, background: VERDE } })
  .composite(piezas).png().toFile("scripts/tmp-zucc/sellos-opciones.png");
console.log("ok");
