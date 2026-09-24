import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PORTADA DEL ENCABEZADO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): la foto adentro del card, no a
 * pantalla completa, y los enlaces debajo. Eso es `estilo_portada:
 * "card"` — ya está puesto.
 *
 * Pero con ese estilo el logo y el nombre se escriben ENCIMA del borde
 * inferior de la foto. La portada que venía —la torta del héroe— tiene
 * justo ahí el chocolate, y «Zuccherino» en tinta oscura sobre
 * chocolate oscuro no se lee.
 *
 * Así que la portada se arma para ese layout: el producto a la
 * DERECHA y la izquierda libre y clara, que es donde caen el disco del
 * logo y el nombre. Es la misma regla de cualquier portada con texto
 * encima — se deja el aire donde va la tipografía, no donde sobra.
 *
 * La fuente es la foto del vaso con las galletas: fondo blanco de
 * estudio, que es exactamente el claro que hace falta.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;

const SRC =
  "C:/Users/LUISH~1/AppData/Local/Temp/claude/c--Users-luis-h-aventurar-cr/c01bf0b5-8e4d-4e60-a6b2-7e69750d54ee/images/22.png";

/**
 * BLANCO, no menta.
 *
 * La foto viene con fondo blanco de estudio. Apoyada sobre un papel
 * menta dejaba un rectángulo blanco con borde duro, y en el encabezado
 * —que recorta la portada— ese borde asomaba como un triángulo en la
 * esquina. Con el papel del mismo blanco, la foto no tiene dónde
 * terminar: se funde.
 */
const PAPEL = "#ffffff";

// El contenido sin el aro del borde.
//
// ⚠️ La caja tiene que quedar INSCRITA en el círculo del aro, que está
// en un radio de ~539 px desde el centro (627, 627) — medido barriendo
// una fila: el aro va de x=50 a x=88. Una caja corrida a la derecha
// mete su esquina superior dentro del aro y en la portada aparece un
// triángulo menta. Centrada, las cuatro esquinas caen a 530 px.
const pieza = await sharp(SRC)
  .extract({ left: 232, top: 278, width: 790, height: 698 })
  .resize({ height: 388, fit: "inside" })
  .png()
  .toBuffer();

const { width: pw } = await sharp(pieza).metadata();

const ANCHO = 1200, ALTO = 500;
const portada = await sharp({
  create: { width: ANCHO, height: ALTO, channels: 3, background: PAPEL },
})
  .composite([
    // Pegado a la derecha, con aire: los 520 px de la izquierda quedan
    // limpios para el disco del logo y el nombre.
    { input: pieza, left: ANCHO - pw - 58, top: Math.round((ALTO - 388) / 2) },
  ])
  .jpeg({ quality: 92 })
  .toBuffer();

await sharp(portada).toFile("scripts/tmp-zucc/portada-card.jpg");

const ruta = "lealtad/zuccherino-portada-card.jpg";
const res = await fetch(`${U}/storage/v1/object/ranchos-fotos/${ruta}`, {
  method: "POST",
  headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
  body: portada,
});
console.log("subida:", res.status);

const url = `${U}/storage/v1/object/public/ranchos-fotos/${ruta}`;
const r = await fetch(`${U}/rest/v1/solutions_negocios?slug=eq.zuccherino`, {
  method: "PATCH",
  headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ foto_portada_url: url }),
});
console.log("portada:", (await r.json())[0].foto_portada_url.slice(-30));
