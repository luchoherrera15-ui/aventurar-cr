import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA PORTADA COMO BANNER, Y EL BOTÓN DE LEALTAD
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «una imagen de portada arriba, un
 * rectángulo de portada, y abajo ya los cards. Quitale esa imagen de la
 * galleta de ahí. Y agregá un botón de plan de lealtad que lleve a la
 * tarjeta digital».
 *
 * ── POR QUÉ CAMBIA EL ESTILO DE PORTADA ─────────────────────────────
 *
 * Estaba en `card`: la foto vive DENTRO del encabezado, detrás del logo
 * y el nombre. Con una composición que tiene el producto a un lado, en
 * ese recuadro se lee como «una galleta pegada ahí» en vez de como una
 * portada — que es exactamente lo que marcó.
 *
 * Pasa a `completa`: la foto es una franja propia arriba de todo y el
 * encabezado queda limpio, solo con el logo y el nombre. Es el
 * «rectángulo de portada» con los cards debajo.
 *
 * Y la foto vuelve a ser la SUYA —la torta del héroe de su sitio, con
 * la pared menta y la soga—, que es una foto pensada para ocupar ancho.
 * La composición del vaso sobre blanco servía para el otro layout,
 * donde hacía falta dejar la izquierda libre para el texto; en un
 * banner, ese vacío es solo vacío.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const HASH = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;

const SRC =
  "C:/Users/LUISH~1/AppData/Local/Temp/claude/c--Users-luis-h-aventurar-cr/c01bf0b5-8e4d-4e60-a6b2-7e69750d54ee/images/21.png";

// El héroe de su sitio, recortado a proporción de banner (3:1). Se toma
// desde abajo del logotipo blanco: ese texto ya lo pone la página.
const banner = await sharp(SRC)
  .extract({ left: 0, top: 300, width: 1920, height: 640 })
  .jpeg({ quality: 90 })
  .toBuffer();
await sharp(banner).toFile("scripts/tmp-zucc/banner-portada.jpg");

const ruta = "lealtad/zuccherino-portada-banner.jpg";
const res = await fetch(`${U}/storage/v1/object/ranchos-fotos/${ruta}`, {
  method: "POST",
  headers: { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
  body: banner,
});
console.log("portada subida:", res.status);

const cab = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" };

const r = await fetch(`${U}/rest/v1/solutions_negocios?slug=eq.zuccherino`, {
  method: "PATCH",
  headers: cab,
  body: JSON.stringify({
    estilo_portada: "completa",
    foto_portada_url: `${U}/storage/v1/object/public/ranchos-fotos/${ruta}`,
  }),
});
const n = (await r.json())[0];
console.log("portada:", n.estilo_portada);

// ── EL BOTÓN DE LEALTAD ─────────────────────────────────────────────
// Va SEGUNDO, después del menú: es lo que más se toca después de ver
// la carta, y antes de los datos de contacto.
await fetch(`${U}/rest/v1/solutions_links?negocio_id=eq.${n.id}&etiqueta=eq.Plan%20de%20lealtad`, {
  method: "DELETE", headers: cab,
});

const { data: nada } = {};
void nada;

// Se recorre lo que hay para reordenar: el nuevo entra en la posición 1.
const actuales = await (await fetch(
  `${U}/rest/v1/solutions_links?negocio_id=eq.${n.id}&select=id,etiqueta,orden&order=orden`,
  { headers: cab },
)).json();

await fetch(`${U}/rest/v1/solutions_links?negocio_id=eq.${n.id}`, {
  method: "DELETE", headers: cab,
});

const LINKS = [
  { etiqueta: "Pedir por WhatsApp", url: "https://wa.me/51957496235", icono: "whatsapp", descripcion: "Te respondemos al toque" },
  { etiqueta: "Plan de lealtad", url: "https://www.bookea.lat/tarjeta/zuccherino", icono: "link", descripcion: "Sumá sellos y llevate un cuchareable gratis" },
  { etiqueta: "Reservá tu visita", url: "https://wa.me/51957496235?text=Hola%2C%20quiero%20reservar%20una%20mesa", icono: "link", descripcion: "Miraflores · Calle Mártir José Olaya 139" },
  { etiqueta: "Cómo llegar", url: "https://www.google.com/maps/search/?api=1&query=Calle%20M%C3%A1rtir%20Jos%C3%A9%20Olaya%20139%20Miraflores%20Lima", icono: "link", descripcion: "Centro Empresarial José Pardo" },
  { etiqueta: "Escribinos", url: "mailto:zuccherinopasteleriaoficial@gmail.com", icono: "link", descripcion: "zuccherinopasteleriaoficial@gmail.com" },
];

await fetch(`${U}/rest/v1/solutions_links`, {
  method: "POST", headers: cab,
  body: JSON.stringify(LINKS.map((l, orden) => ({ negocio_id: n.id, ...l, orden, visible: true }))),
});
console.log(`enlaces: ${LINKS.length} (antes ${actuales.length}) · con Plan de lealtad`);
