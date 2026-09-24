import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MENÚ COMPLETO DE ZUCCHERINO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «el menú no va a ser todo con
 * imágenes grandes y abajo el texto, sino una imagen y a la par el
 * texto. Tampoco agregaste los menús de día, el desayuno, de noche —
 * tenés que agregar todo».
 *
 * Tenía razón en las dos cosas.
 *
 * ── LO QUE FALTABA ──────────────────────────────────────────────────
 *
 * Su sitio tiene DOS menús y yo había cargado uno solo:
 *
 *   · La carta con fotos: Dulces, Cuchareables, Cookies, Saladas.
 *   · Los «Beneficios de septiembre»: tres franjas horarias con precio
 *     promocional y bebida de cortesía incluida — Desayunos,
 *     Hora del dulce y Noche.
 *
 * Van las siete secciones. Las de foto primero porque entran por los
 * ojos; las franjas después, cada una con su horario en el nombre para
 * que nadie pida un desayuno a las siete de la tarde.
 *
 * ── LAS FOTOS NUEVAS ────────────────────────────────────────────────
 *
 * Cuatro llegaron como archivo de estudio con fondo recortado
 * (`puramatcha/zuccherino menú/`). Reemplazan al recorte de la captura
 * de su web, que venía a 254 px y se notaba.
 *
 * ── LA DISPOSICIÓN ──────────────────────────────────────────────────
 *
 * `lista` + `cuadrada`: foto cuadrada a la izquierda, nombre,
 * descripción y precio al lado. Antes estaba en `revista` —foto ancha
 * arriba, texto abajo—, que es lindo para seis platos y agotador para
 * cuarenta.
 */

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8")).split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const CUENTA = env.CLOUDFLARE_ACCOUNT_ID, TOKEN = env.CLOUDFLARE_IMAGES_API_TOKEN;
const HASH = env.CLOUDFLARE_IMAGES_ACCOUNT_HASH;
const cab = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" };
const foto = (id) => `https://imagedelivery.net/${HASH}/zuccherino-${id}/gallery`;

// ── 1. LAS CUATRO FOTOS DE ESTUDIO ──────────────────────────────────
// Llegan con fondo recortado, así que se apoyan sobre blanco: en la
// ficha del menú un PNG transparente se vería con el fondo de la
// página metido adentro del cuadro.
const NUEVAS = {
  "carrot-cake": "carrot cacke",
  "cheesecake-pistacho": "pistacho cheesecake",
  "torta-chocolate": "tarta de chocolate",
  "tarta-opera": "tarta opera",
};

for (const [id, archivo] of Object.entries(NUEVAS)) {
  const jpg = await sharp({
    create: { width: 1000, height: 1000, channels: 3, background: "#ffffff" },
  })
    .composite([{
      input: await sharp(`puramatcha/zuccherino menú/${archivo}.png`)
        .resize(940, 940, { fit: "inside" }).toBuffer(),
      gravity: "center",
    }])
    .jpeg({ quality: 90 })
    .toBuffer();

  const form = new FormData();
  form.append("id", `zuccherino-${id}`);
  form.append("file", new Blob([jpg], { type: "image/jpeg" }), `${id}.jpg`);
  // `PUT` no existe en esta API: se borra y se sube con el mismo id.
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${CUENTA}/images/v1/zuccherino-${id}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CUENTA}/images/v1`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: form,
  });
  console.log(id, (await res.json()).success ? "ok" : "FALLÓ");
}

// ── 2. EL MENÚ ──────────────────────────────────────────────────────

/** `f` = id de la foto en Cloudflare. Sin `f`, la ficha va tipográfica. */
const CARTA = [
  {
    nombre: "Dulces",
    items: [
      { n: "Cheesecake de pistacho", d: "Sablée de avellana y pistacho, con crema de pistacho, biscuit tierno y cobertura verde espejo", p: 22.90, f: "cheesecake-pistacho" },
      { n: "Tarta Ópera", d: "Biscocho de almendras bañado en espresso, con capas de buttercream de café y chocolate, terminado con glaseado brillante de cacao", p: 19.90, f: "tarta-opera" },
      { n: "Carrot cake", d: "Biscocho de zanahoria y frutos secos, relleno de crema de queso y compota de albaricoque", p: 19.90, f: "carrot-cake" },
      { n: "Torta de chocolate", d: "Biscochuelo húmedo de chocolate, fudge a la olla, cremoso de chocolate y café, con corazón de frutos rojos", p: 19.90, f: "torta-chocolate" },
      { n: "Brownie supreme", d: "Brownie con fudge caliente, acompañado de una bola de helado de vainilla", p: 18.90, f: "brownie-supreme" },
      { n: "Tarta vasca", d: "Tarta de queso crema artesanal, horneada a alta temperatura, con superficie caramelizada y un centro cremoso", p: 18.90, f: "tarta-vasca" },
      { n: "Brownie clásico", d: "Brownie amasado con chocolate al 70 % y frutos secos, acompañado de fresa y fudge", p: 14.90, f: "brownie-clasico" },
    ],
  },
  {
    nombre: "Cuchareables",
    items: [
      { n: "Tiramisú", d: "Biscotela embebida en espresso, crema de mascarpone y cremoso de chocolate y café", p: 19.90, f: "cucha-tiramisu" },
      { n: "Pie de limón", d: "Galleta de mantequilla con harina de almendras, curd de limón y merengue italiano", p: 19.90, f: "cucha-pie-limon" },
      { n: "Carrot cake", d: "Biscocho de zanahoria y frutos secos con crema de queso", p: 19.90, f: "cucha-carrot" },
      { n: "Tres leches", d: "Biscochuelo genovés bañado en tres leches, con relleno de crema pastelera y un tope de nata montada y canela", p: 18.90, f: "cucha-tres-leches" },
    ],
  },
  {
    nombre: "Cookies",
    items: [
      { n: "Cookie de manjar lúcuma", d: "Galleta crujiente por fuera y suave por dentro, rellena de manjar blanco de lúcuma artesanal", p: 11.90, f: "cookie-manjar" },
      { n: "Cookie de fudge", d: "Galleta de chocolate melosa, rellena de abundante fudge casero de cacao intenso", p: 11.90, f: "cookie-fudge" },
      { n: "Cookie de marshmallow", d: "Galleta horneada con chips de chocolate y un centro suave de marshmallow derretido", p: 10.90, f: "cookie-marshmallow" },
      { n: "Zuccherino macaron collection", d: "Finas galletas de harina de almendras y merengue italiano, rellenas de fudge de chocolate a la olla y compota de frutos rojos y/o albaricoque", p: 35.90, f: "macarron-collection" },
      { n: "Giganto roll", d: "Masa brioche enrollada con crema de canela, coronada con glaseado de queso crema y terminada con fudge a la olla y/o crema de frutos rojos", p: 22.90, f: "giganto-roll" },
      { n: "Pan de maní (2 unidades)", d: "Masa dulce con trozos de maní tostado y barnizado con leche", p: 12.90, f: "pan-de-mani" },
    ],
  },
  {
    nombre: "Saladas",
    items: [
      { n: "Capresse", d: "Baguette, mozzarella fresca, tomate, albahaca y aceite de oliva", p: 20.90, f: "capresse" },
      { n: "Jambon-beurre", d: "Baguette, mantequilla con sal y jamón inglés", p: 20.90, f: "jambon-beurre" },
      { n: "Croissant mixto", d: "Jamón inglés y queso gouda", p: 20.90, f: "croissant-mixto" },
      { n: "Clásico de pollo", d: "Brioche, pollo deshilachado, tomate, lechuga y mayonesa al gusto", p: 19.90, f: "clasico-pollo" },
      { n: "Tostada con palta", d: "Pan de masa madre con semillas andinas, media palta, queso crema philadelphia, tomate cherry y sazonador de especias", p: 19.90, f: "tostada-palta" },
      { n: "Quiche de characata", d: "Pastel de lomo con rocoto confitado en salsa de tres quesos", p: 17.00, f: "quiche-characata" },
    ],
  },
  // ── Las tres franjas de «Beneficios de septiembre» ────────────────
  // El horario va en el NOMBRE de la sección: es lo único que el
  // catálogo enseña siempre, y sin él alguien pide un desayuno a las
  // siete de la tarde. La bebida de cortesía va en cada descripción
  // por el mismo motivo — la promesa tiene que viajar con el plato.
  {
    nombre: "Desayunos · 8:00 a 10:00 am",
    items: [
      { n: "Capresse", d: "Baguette, mozzarella fresco, tomate, albahaca y aceite de oliva. Incluye café americano o infusión de cortesía de 12 oz", p: 20.90 },
      { n: "Jambon-beurre", d: "Baguette, mantequilla con sal y jamón inglés. Incluye café americano o infusión de cortesía de 12 oz", p: 20.90 },
      { n: "Croissant mixto", d: "Jamón inglés y queso gouda. Incluye café americano o infusión de cortesía de 12 oz", p: 19.90 },
      { n: "Clásico de pollo", d: "Brioche, pollo deshilachado, tomate, lechuga y mayonesa al gusto. Incluye café americano o infusión de cortesía de 12 oz", p: 19.90 },
      { n: "Tostada con palta", d: "Pan de masa madre con semillas andinas, media palta, queso crema philadelphia, tomate cherry y sazonador de especias. Incluye bebida de cortesía", p: 19.90 },
      { n: "Quiche de characata", d: "Pastel de lomo con rocoto confitado en salsa de tres quesos. Incluye bebida de cortesía", p: 17.00 },
      { n: "Pastel de acelgas", d: "Con salsa bechamel, huevo, queso edam y salchicha alemana. Incluye bebida de cortesía", p: 15.90 },
      { n: "Pastel de acelgas vegetariano", d: "Con salsa bechamel, huevo y queso edam. Incluye bebida de cortesía", p: 15.90 },
      { n: "Empanada de lomo saltado", d: "Lomo salteado en salsa oriental. Incluye bebida de cortesía", p: 14.90 },
      { n: "Pan de maní (2 unidades)", d: "Masa dulce con trozos de maní tostado y barnizado con leche. Incluye bebida de cortesía", p: 12.90 },
    ],
  },
  {
    nombre: "Hora del dulce · 1:00 a 2:00 pm",
    items: [
      { n: "Torta de chocolate premium", d: "Biscochuelo húmedo de chocolate, fudge a la olla, cremoso de chocolate y café, con corazón de frutos rojos. Incluye bebida frutal del día de 12 oz", p: 19.90 },
      { n: "Tarta Ópera", d: "Biscocho de almendras bañado en espresso, con capas de buttercream de café y chocolate, terminado con glaseado brillante de cacao. Incluye bebida frutal del día", p: 19.90 },
      { n: "Torta de chocolate cuchareable", d: "Biscochuelo húmedo de chocolate, fudge a la olla, cremoso de chocolate y café, con corazón de frutos rojos. Incluye bebida frutal del día", p: 19.90 },
      { n: "Tiramisú cuchareable", d: "Biscotela embebida en espresso, crema de mascarpone y cremoso de chocolate y café. Incluye bebida frutal del día", p: 19.90 },
      { n: "Pie de limón cuchareable", d: "Galleta de mantequilla con harina de almendras, curd de limón y merengue italiano. Incluye bebida frutal del día", p: 19.90 },
      { n: "Tarta vasca", d: "Tarta de queso crema artesanal, horneada a alta temperatura, con superficie caramelizada y un centro cremoso. Incluye bebida frutal del día", p: 18.90 },
      { n: "Tres leches cuchareable", d: "Biscochuelo genovés bañado en tres leches, con relleno de crema pastelera y un tope de nata montada y canela. Incluye bebida frutal del día", p: 18.90 },
      { n: "Cuchareable de alfajor", d: "Galleta de alfajor rellena de manjar de lúcuma a la olla, con un centro de fudge de chocolate artesanal. Incluye bebida frutal del día", p: 18.90 },
    ],
  },
  {
    nombre: "Noche · 6:00 a 8:00 pm",
    items: [
      { n: "Zuccherino macaron collection", d: "Finas galletas de harina de almendras y merengue italiano, rellenas de fudge de chocolate a la olla y compota de frutos rojos y/o albaricoque. Incluye café americano o infusión de cortesía de 12 oz", p: 35.90 },
      { n: "Giganto rolls", d: "Masa brioche enrollada con crema de canela, coronada con glaseado de queso crema y terminada con fudge a la olla y/o crema de frutos rojos. Incluye bebida de cortesía", p: 21.90 },
      { n: "Giganto cookie de manjar de lúcuma", d: "Galletas artesanales de mantequilla, rellenas de manjar de lúcuma a la olla. Incluye bebida de cortesía", p: 19.90 },
      { n: "Giganto cookie de fudge", d: "Galletas artesanales de mantequilla con trozos de chocolate, rellenas de fudge a la olla. Incluye bebida de cortesía", p: 19.90 },
      { n: "Giganto cookie de marshmallow", d: "Galletas artesanales de mantequilla con trozos de chocolate, rellenas de marshmallow. Incluye bebida de cortesía", p: 19.90 },
    ],
  },
];

const [negocio] = await (await fetch(
  `${U}/rest/v1/solutions_negocios?slug=eq.zuccherino&select=id`, { headers: cab },
)).json();

await fetch(`${U}/rest/v1/solutions_menu_items?negocio_id=eq.${negocio.id}`, { method: "DELETE", headers: cab });
await fetch(`${U}/rest/v1/solutions_menu_secciones?negocio_id=eq.${negocio.id}`, { method: "DELETE", headers: cab });

const secciones = await (await fetch(`${U}/rest/v1/solutions_menu_secciones`, {
  method: "POST", headers: cab,
  body: JSON.stringify(CARTA.map((s, orden) => ({ negocio_id: negocio.id, nombre: s.nombre, orden }))),
})).json();
const idDe = Object.fromEntries(secciones.map((s) => [s.nombre, s.id]));

let n = 0;
const items = CARTA.flatMap((s) =>
  s.items.map((i) => ({
    negocio_id: negocio.id,
    seccion_id: idDe[s.nombre],
    nombre: i.n,
    descripcion: i.d,
    precio: i.p,
    foto_url: i.f ? foto(i.f) : null,
    disponible: true,
    orden: n++,
  })),
);
await fetch(`${U}/rest/v1/solutions_menu_items`, { method: "POST", headers: cab, body: JSON.stringify(items) });
console.log(`menú: ${secciones.length} secciones · ${items.length} productos`);

// ── 3. LA DISPOSICIÓN ───────────────────────────────────────────────
const r = await fetch(`${U}/rest/v1/solutions_negocios?slug=eq.zuccherino`, {
  method: "PATCH", headers: cab,
  body: JSON.stringify({
    diseno: {
      menuAjustes: {
        plantilla: "clasico",
        tema: "marca",
        fondo: "#f4f1ed",
        tinta: "#2b2723",
        acento: "#01675f",
        fuente: "editorial",
        titulo: "serif",
        foto: "cuadrada",
        disposicion: "lista",
        separador: "tarjeta",
        precio: "derecha",
        aire: "normal",
        portada: "completa",
      },
    },
  }),
});
console.log("disposición:", (await r.json())[0].diseno.menuAjustes.disposicion, "· foto cuadrada");
