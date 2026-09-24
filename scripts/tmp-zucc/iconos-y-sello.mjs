import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS ÍCONOS DEL HUB Y EL SELLO DE LA TARJETA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «mejorá esos íconos, el de la tarjeta
 * de lealtad, todos. El de WhatsApp cambialo porque ya no es pedir por
 * WhatsApp. Y los sellos están quedando muy mal — usá la imagen que te
 * di».
 *
 * ── LOS ÍCONOS ──────────────────────────────────────────────────────
 *
 * Cuatro de los seis links salían con la cadena genérica (`link`), que
 * es el ícono de «no sé qué es esto». Cada uno pasa al suyo, de la
 * lista real del producto (`ICONOS_LINK`):
 *
 *   Pedir · exprés o recoger  whatsapp → tienda   (ya no abre WhatsApp:
 *                                                  abre el menú)
 *   Plan de lealtad           link     → reservar
 *   Reservá tu visita         link     → reservar
 *   Cómo llegar               link     → mapa
 *   Escribinos                link     → correo
 *
 * ── EL SELLO ────────────────────────────────────────────────────────
 *
 * Va la imagen tal como la mandó, completa. Yo venía recortando la
 * galleta porque a 32 px la composición entera se lee borrosa —y esa
 * sigue siendo la verdad—, pero es su marca y su decisión.
 *
 * Lo único que se le hace es sacarle el blanco del fondo: el sello se
 * dibuja adentro de un disco y un cuadrado blanco encima de un disco
 * blanco deja las esquinas cortadas. El aro menta queda, que es lo que
 * le da forma de sello.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const cab = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" };

// ── 1. LOS ÍCONOS ───────────────────────────────────────────────────
const [negocio] = await (await fetch(
  `${U}/rest/v1/solutions_negocios?slug=eq.zuccherino&select=id`, { headers: cab })).json();

const ICONOS = {
  "Pedir · exprés o recoger": "tienda",
  "Plan de lealtad": "reservar",
  "Reservá tu visita": "reservar",
  "Cómo llegar": "mapa",
  "Escribinos": "correo",
};

const links = await (await fetch(
  `${U}/rest/v1/solutions_links?negocio_id=eq.${negocio.id}&select=id,etiqueta&order=orden`, { headers: cab })).json();

for (const l of links) {
  const icono = ICONOS[l.etiqueta];
  if (!icono) continue;
  await fetch(`${U}/rest/v1/solutions_links?id=eq.${l.id}`, {
    method: "PATCH", headers: cab, body: JSON.stringify({ icono }),
  });
  console.log(l.etiqueta.padEnd(26), "→", icono);
}

// ── 2. EL SELLO: SU IMAGEN, COMPLETA ────────────────────────────────
const SRC = "puramatcha/zuccherino menú/sellos card.png";

const { data, info } = await sharp(SRC)
  .resize(640, 640, { fit: "inside" })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// Fuera el blanco del fondo. El aro menta (#c0d6d1) y todo lo demás se
// quedan: el umbral está por encima de su luminancia.
for (let i = 0; i < data.length; i += info.channels) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  const luz = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (luz < 244 || sat > 10) continue;
  data[i + 3] = luz >= 250 ? 0 : Math.round(((250 - luz) / 6) * 255);
}

const sello = await sharp(data, { raw: info }).png().toBuffer();
await sharp(sello).toFile("scripts/tmp-zucc/sello-suyo.png");
await sharp({ create: { width: 640, height: 640, channels: 3, background: "#01675f" } })
  .composite([{ input: sello }]).png().toFile("scripts/tmp-zucc/sello-suyo-previa.png");

const ruta = "lealtad/zuccherino-sello-v5.png";
const res = await fetch(`${U}/storage/v1/object/ranchos-fotos/${ruta}`, {
  method: "POST",
  headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "image/png", "x-upsert": "true" },
  body: sello,
});
console.log("sello subido:", res.status);

const r = await fetch(`${U}/rest/v1/programa_lealtad?rancho_id=eq.01f358cb-5a88-4644-b7a8-84cdda49ebed`, {
  method: "PATCH", headers: cab,
  body: JSON.stringify({
    pase_sello_icono: "propio",
    pase_sello_icono_url: `${U}/storage/v1/object/public/ranchos-fotos/${ruta}`,
  }),
});
console.log("tarjeta:", (await r.json())[0].pase_sello_icono_url.slice(-22));
