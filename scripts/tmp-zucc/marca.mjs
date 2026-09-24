import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL LOGO REAL, LA GALLETA Y EL VERDE DE VERDAD
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «utilizá esta para el sello, la
 * tarjeta creo que podemos mejorarla un poco más en cuanto a diseño».
 *
 * La foto que mandó vale por tres cosas que la captura del sitio no
 * daba:
 *
 *   1. **Su logo de verdad** — la «Z» en su marco ovalado con las
 *      hojas. Hasta ahora estaba usando un monograma que dibujé yo,
 *      que era un parche mientras no hubiera el real.
 *   2. **Su verde de verdad.** De la captura del sitio salía menta
 *      (#a8d5c8), que es el color de sus FONDOS. El logo está en un
 *      verde mucho más profundo — ese es el color de la marca.
 *   3. **Una galleta nítida**, iluminada de estudio, en vez de un
 *      recorte de 88 px de una captura.
 *
 * ── CÓMO SE SACA CADA FONDO ─────────────────────────────────────────
 *
 * Son dos problemas distintos y se resuelven distinto:
 *
 * · **El logo** está impreso sobre el cartón blanco del vaso. Lo que
 *   lo separa es que es OSCURO y VERDE sobre un claro casi neutro, así
 *   que se cala por luminancia.
 * · **La galleta** está sobre un plato claro y un fondo blanco. Lo que
 *   la separa es la SATURACIÓN: es tostada, el plato es neutro.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const SRC =
  "C:/Users/LUISH~1/AppData/Local/Temp/claude/c--Users-luis-h-aventurar-cr/c01bf0b5-8e4d-4e60-a6b2-7e69750d54ee/images/22.png";

const hex = (r, g, b) => "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");

// ── 1. EL VERDE DE LA MARCA ─────────────────────────────────────────
// Del trazo de «ZUCCHERINO»: el píxel más oscuro y saturado de ahí.
{
  const { data, info } = await sharp(SRC)
    .extract({ left: 330, top: 665, width: 240, height: 45 })
    .raw().toBuffer({ resolveWithObject: true });
  let mejor = null, max = -1;
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Verde: g por encima de r. Y oscuro.
    if (g <= r) continue;
    const p = (g - r) + (255 - lum) * 0.6;
    if (p > max) { max = p; mejor = [r, g, b]; }
  }
  console.log("VERDE DE LA MARCA:", hex(...mejor));
}

/**
 * Cala el logo por VERDE, no por luz.
 *
 * Se probó por luminancia y dejaba un bloque gris: el vaso tiene una
 * sombra y su parte oscura caía del lado del trazo. Lo que de verdad
 * separa el logo del cartón es el TONO — el logo es verde azulado
 * (g bastante por encima de r) y el cartón es neutro, con r ≈ g.
 */
async function calarPorLuz(caja, { claro, oscuro }) {
  const { data, info } = await sharp(SRC)
    .extract(caja)
    .resize({ width: caja.width * 4, kernel: "lanczos3" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    // Cuánto tira al verde azulado del logo.
    const verde = (g - r + (b - r)) / 2;
    data[i + 3] = verde <= oscuro ? 0 : verde >= claro ? 255
      : Math.round(((verde - oscuro) / (claro - oscuro)) * 255);
  }
  return sharp(data, { raw: info }).png().trim({ threshold: 1 }).toBuffer();
}

/** Cala por saturación: lo neutro se va, lo tostado se queda. */
async function calarPorSaturacion(caja, { luz, fondo, objeto }) {
  const { data, info } = await sharp(SRC)
    .extract(caja)
    .resize({ width: caja.width * 3, kernel: "lanczos3" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (lum <= luz || sat >= objeto) continue;
    data[i + 3] = sat <= fondo ? 0
      : Math.round(((sat - fondo) / (objeto - fondo)) * 255);
  }
  return sharp(data, { raw: info }).png().trim({ threshold: 1 }).toBuffer();
}

/** Centra una pieza en un cuadrado transparente, con aire. */
async function enCuadrado(pieza, lado = 512, adentro = 0.82) {
  const d = Math.round(lado * adentro);
  return sharp({
    create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: await sharp(pieza).resize(d, d, { fit: "inside" }).toBuffer(), gravity: "center" }])
    .png().toBuffer();
}

// ── 2. EL MONOGRAMA ─────────────────────────────────────────────────
const marca = await calarPorLuz(
  { left: 416, top: 576, width: 88, height: 96 },
  { claro: 22, oscuro: 6 },
);
const logo = await enCuadrado(marca, 512, 0.76);
await sharp(logo).toFile("scripts/tmp-zucc/logo-zucc.png");

// ── 3. LA GALLETA ───────────────────────────────────────────────────
// La de arriba, que está entera y mejor iluminada.
const galleta = await calarPorSaturacion(
  { left: 722, top: 628, width: 288, height: 172 },
  { luz: 186, fondo: 24, objeto: 54 },
);
const sello = await enCuadrado(galleta, 512, 0.84);
await sharp(sello).toFile("scripts/tmp-zucc/sello-zucc.png");

// Previas sobre el fondo donde van a vivir.
for (const [n, buf, fondo] of [["logo", logo, "#ffffff"], ["sello", sello, "#ffffff"]]) {
  await sharp({ create: { width: 512, height: 512, channels: 3, background: fondo } })
    .composite([{ input: buf }]).png()
    .toFile(`scripts/tmp-zucc/previa-${n}.png`);
}

// ── 4. A SUPABASE ───────────────────────────────────────────────────
async function subir(nombre, buf) {
  const ruta = `lealtad/${nombre}`;
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
      body: buf,
    },
  );
  console.log(nombre, res.status);
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ranchos-fotos/${ruta}`;
}

console.log("LOGO :", await subir("zuccherino-logo-v3.png", logo));
console.log("SELLO:", await subir("zuccherino-sello-v3.png", sello));
