import { readFile } from "node:fs/promises";
import { PRODUCTOS } from "./extraer.mjs";

/**
 * ════════════════════════════════════════════════════════════════════
 *  ZUCCHERINO — el link hub, el menú y los enlaces
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): armar el link hub de Zuccherino
 * —pastelería de Miraflores, Lima— con sus colores, su tipografía y
 * sus productos, y publicarlo desde el arranque.
 *
 * ── DE DÓNDE SALE CADA DATO ─────────────────────────────────────────
 *
 * Todo de su propia página, medido o transcrito:
 *   · colores   muestreados píxel a píxel de la captura
 *   · productos recortados de su grilla, con sus precios en soles
 *   · contacto  del pie de su sitio
 *
 * ── LAS DOS DECISIONES DE DISEÑO ────────────────────────────────────
 *
 * 1. `color_acento` NO es su menta (#a8d5c8). Sobre crema, el menta da
 *    1,5:1 — un botón con texto blanco encima sería ilegible. Se usa
 *    el mismo tono bajado a #3d7a6d, que da 4,6:1 y sigue siendo
 *    inconfundiblemente suyo. Su menta vive igual: es el fondo de sus
 *    fotos y de sus tarjetas.
 * 2. `fuente: "elegante"` — su identidad es una serif de interletrado
 *    abierto. Es la cara de la casa que más se le parece.
 *
 * ── IDEMPOTENTE ────────────────────────────────────────────────────
 *
 * Borra el menú y los links del negocio antes de recrearlos, y hace
 * upsert del negocio por `slug`. Se puede correr las veces que haga
 * falta sin duplicar nada.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
const HASH = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
const foto = (id) => `https://imagedelivery.net/${HASH}/zuccherino-${id}/gallery`;

const cab = {
  apikey: K,
  Authorization: `Bearer ${K}`,
  "Content-Type": "application/json",
};

async function api(ruta, opciones = {}) {
  const res = await fetch(`${U}/rest/v1/${ruta}`, { ...opciones, headers: { ...cab, ...opciones.headers } });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${ruta} → ${res.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

const OWNER = "a45261b3-d846-40e4-aa14-506d2080be67"; // luchoherrera15@gmail.com

// ── 1. EL NEGOCIO ───────────────────────────────────────────────────

const NEGOCIO = {
  owner_id: OWNER,
  creado_por: OWNER,
  nombre: "Zuccherino",
  slug: "zuccherino",
  bajada: "Pastelería y cafetería · Miraflores, Lima",
  logo_url: foto("logo"),
  foto_portada_url: foto("portada"),
  whatsapp: "957496235",
  whatsapp_pedidos: "957496235",
  direccion: "Calle Mártir José Olaya 139, Miraflores, Lima",
  color_fondo: "#f4f1ed",
  color_acento: "#3d7a6d",
  tema: "marca",
  estilo_links: "lista",
  redondeo: "suave",
  fuente: "elegante",
  estilo_portada: "completa",
  efecto: "plano",
  publicado: true,
  mostrar_menu: true,
  acepta_pedidos: true,
  pedidos_llevar: true,
  pedidos_express: false,
  metodos_pago: ["efectivo", "tarjeta", "transferencia"],
  pais: "PE",
  moneda: "PEN",
  rubro: "cafeteria",
  plan: "gratis",
  origen: "admin",
};

const [negocio] = await api("solutions_negocios?on_conflict=slug", {
  method: "POST",
  headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(NEGOCIO),
});
console.log("negocio:", negocio.id, negocio.slug);

// ── 2. EL MENÚ ──────────────────────────────────────────────────────

await api(`solutions_menu_items?negocio_id=eq.${negocio.id}`, { method: "DELETE" });
await api(`solutions_menu_secciones?negocio_id=eq.${negocio.id}`, { method: "DELETE" });

/** El orden es el de su carta: primero lo dulce, que es lo que venden. */
const SECCIONES = ["Dulces", "Cuchareables", "Cookies", "Saladas"];

const creadas = await api("solutions_menu_secciones", {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: JSON.stringify(
    SECCIONES.map((nombre, orden) => ({ negocio_id: negocio.id, nombre, orden })),
  ),
});
const idDe = Object.fromEntries(creadas.map((s) => [s.nombre, s.id]));

const items = PRODUCTOS.filter((p) => p.seccion).map((p, i) => ({
  negocio_id: negocio.id,
  seccion_id: idDe[p.seccion],
  nombre: p.nombre,
  descripcion: p.desc,
  precio: p.precio,
  foto_url: foto(p.id),
  disponible: true,
  orden: i,
}));

await api("solutions_menu_items", { method: "POST", body: JSON.stringify(items) });
console.log(`menú: ${creadas.length} secciones · ${items.length} productos`);

// ── 3. LOS ENLACES ──────────────────────────────────────────────────

await api(`solutions_links?negocio_id=eq.${negocio.id}`, { method: "DELETE" });

/**
 * El tile «Ver el menú» lo pone la página sola cuando `mostrar_menu`
 * está prendido, así que acá NO va: repetirlo sería tener dos puertas
 * al mismo lugar, una arriba de la otra.
 */
const LINKS = [
  { etiqueta: "Pedir por WhatsApp", url: "https://wa.me/51957496235", icono: "whatsapp", descripcion: "Te respondemos al toque" },
  { etiqueta: "Reservá tu visita", url: "https://wa.me/51957496235?text=Hola%2C%20quiero%20reservar%20una%20mesa", icono: "link", descripcion: "Miraflores · Calle Mártir José Olaya 139" },
  { etiqueta: "Cómo llegar", url: "https://www.google.com/maps/search/?api=1&query=Calle%20M%C3%A1rtir%20Jos%C3%A9%20Olaya%20139%20Miraflores%20Lima", icono: "link", descripcion: "Centro Empresarial José Pardo" },
  { etiqueta: "Escribinos", url: "mailto:zuccherinopasteleriaoficial@gmail.com", icono: "link", descripcion: "zuccherinopasteleriaoficial@gmail.com" },
];

await api("solutions_links", {
  method: "POST",
  body: JSON.stringify(
    LINKS.map((l, orden) => ({ negocio_id: negocio.id, ...l, orden, visible: true })),
  ),
});
console.log(`enlaces: ${LINKS.length}`);

// ── 4. LOS ADD-ONS ──────────────────────────────────────────────────

await api(`solutions_addons?negocio_id=eq.${negocio.id}`, { method: "DELETE" });
await api("solutions_addons", {
  method: "POST",
  body: JSON.stringify(
    ["menu", "pedidos"].map((addon) => ({ negocio_id: negocio.id, addon, activo: true })),
  ),
});
console.log("add-ons: menu, pedidos");

console.log(`\nLISTO → /s/${negocio.slug}`);
