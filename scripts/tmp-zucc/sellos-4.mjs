import sharp from "sharp";

/**
 * Las cuatro candidatas a sello, al tamaño en que el pase las dibuja.
 *
 * Ocho sellos entran en una tarjeta de 300 px: cada disco mide 32 px.
 * Todo lo que se decida acá hay que juzgarlo a ESE tamaño.
 *
 *   A · la composición entera, como la mandó
 *   B · la galleta sola
 *   C · el vaso solo
 *   D · el monograma de la marca
 */
const SRC = "puramatcha/zuccherino menú/sellos card.png";
const VERDE = "#01675f";

/** Cala por saturación: lo claro y neutro se va. */
async function porSaturacion(caja, { luz, fondo, objeto }) {
  const { data, info } = await sharp(SRC).extract(caja)
    .resize({ width: caja.width * 3, kernel: "lanczos3" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    const s = Math.max(r, g, b) - Math.min(r, g, b);
    if (l <= luz || s >= objeto) continue;
    data[i + 3] = s <= fondo ? 0 : Math.round(((s - fondo) / (objeto - fondo)) * 255);
  }
  return sharp(data, { raw: info }).png().trim({ threshold: 1 }).toBuffer();
}

async function enCuadrado(p, adentro = 0.86) {
  const d = Math.round(512 * adentro);
  return sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(p).resize(d, d, { fit: "inside" }).toBuffer(), gravity: "center" }])
    .png().toBuffer();
}

const A = await sharp(SRC).resize(512, 512, { fit: "inside" }).png().toBuffer();
const B = await enCuadrado(await porSaturacion({ left: 722, top: 628, width: 288, height: 172 }, { luz: 186, fondo: 24, objeto: 54 }));
// El vaso: se cala por LUZ porque es blanco sobre blanco — lo que lo
// separa del fondo es su sombra y el verde del logo, no la saturación.
const vaso = await (async () => {
  const caja = { left: 218, top: 235, width: 480, height: 640 };
  const { data, info } = await sharp(SRC).extract(caja)
    .resize({ width: caja.width * 2, kernel: "lanczos3" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const s = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    if (l < 246 || s > 8) continue;
    data[i + 3] = l >= 251 ? 0 : Math.round(((251 - l) / 5) * 255);
  }
  return sharp(data, { raw: info }).png().trim({ threshold: 1 }).toBuffer();
})();
const C = await enCuadrado(vaso, 0.92);
const D = await sharp("scripts/tmp-zucc/logo-zucc.png").png().toBuffer();

const disco = Buffer.from('<svg width="256" height="256"><circle cx="128" cy="128" r="128" fill="#fff"/></svg>');
const piezas = [];
for (const [i, [letra, img]] of [["A", A], ["B", B], ["C", C], ["D", D]].entries()) {
  const sello = await sharp(disco)
    .composite([{ input: await sharp(img).resize(196, 196, { fit: "inside" }).toBuffer(), gravity: "center" }])
    .png().toBuffer();
  for (let n = 0; n < 4; n++) {
    piezas.push({ input: await sharp(sello).resize(32, 32).toBuffer(), left: 46 + n * 40, top: 22 + i * 78 });
  }
  piezas.push({ input: await sharp(sello).resize(64, 64).toBuffer(), left: 224, top: 6 + i * 78 });
  piezas.push({
    input: Buffer.from(`<svg width="30" height="26"><text x="0" y="20" font-family="sans-serif" font-size="19" font-weight="bold" fill="#fff">${letra}</text></svg>`),
    left: 12, top: 26 + i * 78,
  });
}
await sharp({ create: { width: 310, height: 318, channels: 3, background: VERDE } })
  .composite(piezas).png().toFile("scripts/tmp-zucc/sellos-4.png");

// Se deja lista la B, que es la que se lee.
await sharp(B).toFile("scripts/tmp-zucc/sello-B.png");
console.log("ok");
