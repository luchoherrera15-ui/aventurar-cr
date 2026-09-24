import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS FOTOS DE ZUCCHERINO, SACADAS DE SU PROPIA PÁGINA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): armar el link hub de Zuccherino
 * —pastelería de Miraflores, Lima— con sus colores, su tipografía y
 * SUS PRODUCTOS. «Ahí están las imágenes de algunos productos, debés
 * utilizarlas en el menú también».
 *
 * La única fuente es la captura de su sitio (1920 × 8668). Este script
 * recorta cada plato de ahí y lo deja listo para subir.
 *
 * ── CÓMO SE MIDIERON LAS CAJAS ──────────────────────────────────────
 *
 * Recortando bandas horizontales a 900 px de ancho, mirándolas, y
 * pasando las coordenadas a la escala original (1920/900 = 2,1333).
 * Por eso los números están en píxeles del ORIGINAL y no son redondos:
 * salen de una medición, no de una cuenta.
 *
 * ── LO QUE NO SE PUEDE ARREGLAR ACÁ ─────────────────────────────────
 *
 * Son recortes de una captura de pantalla, así que heredan su
 * resolución: los platos quedan entre 190 y 340 px de lado. Alcanza
 * para las fichas del menú (se muestran a 96 px) pero NO para una foto
 * de portada a pantalla completa. Para eso hacen falta los originales.
 */

const SRC =
  "C:/Users/LUISH~1/AppData/Local/Temp/claude/c--Users-luis-h-aventurar-cr/c01bf0b5-8e4d-4e60-a6b2-7e69750d54ee/images/21.png";

const OUT = "scripts/tmp-zucc/fotos";

/** Cada plato con su caja en el original y sus datos de menú. */
export const PRODUCTOS = [
  // ── DULCES ────────────────────────────────────────────────────────
  { id: "cheesecake-pistacho", seccion: "Dulces", nombre: "Cheesecake de pistacho",
    desc: "Sablée de avellana y pistacho, con crema de pistacho, biscuit tierno y cobertura verde espejo",
    precio: 22.90, caja: [397, 2739, 254, 337] },
  { id: "tarta-opera", seccion: "Dulces", nombre: "Tarta Ópera",
    desc: "Biscocho de almendras bañado en espresso, con capas de buttercream de café y chocolate, terminado con glaseado brillante",
    precio: 19.90, caja: [681, 2739, 254, 337] },
  { id: "carrot-cake", seccion: "Dulces", nombre: "Carrot cake",
    desc: "Biscocho de zanahoria y frutos secos, relleno de crema de queso y compota de albaricoque",
    precio: 19.90, caja: [962, 2739, 254, 337] },
  { id: "torta-chocolate", seccion: "Dulces", nombre: "Torta de chocolate",
    desc: "Biscocho húmedo de chocolate, fudge a la olla, cremoso de chocolate y café, con corazón de frutos rojos",
    precio: 19.90, caja: [1244, 2739, 254, 337] },
  { id: "brownie-supreme", seccion: "Dulces", nombre: "Brownie supreme",
    desc: "Brownie con fudge caliente, acompañado de una bola de helado de vainilla",
    precio: 18.90, caja: [397, 3240, 254, 327] },
  { id: "tarta-vasca", seccion: "Dulces", nombre: "Tarta vasca",
    desc: "Tarta de queso crema artesanal, horneada a alta temperatura con superficie caramelizada y un centro cremoso",
    precio: 18.90, caja: [681, 3240, 254, 327] },
  { id: "brownie-clasico", seccion: "Dulces", nombre: "Brownie clásico",
    desc: "Brownie amasado con chocolate al 70 % y frutos secos, acompañado de fresa y fudge",
    precio: 14.90, caja: [962, 3240, 254, 327] },

  // ── CUCHAREABLES ──────────────────────────────────────────────────
  { id: "cucha-tiramisu", seccion: "Cuchareables", nombre: "Tiramisú",
    desc: "Cuchareable", precio: 19.90, caja: [740, 3862, 195, 172] },
  { id: "cucha-pie-limon", seccion: "Cuchareables", nombre: "Pie de limón",
    desc: "Cuchareable", precio: 19.90, caja: [1007, 3862, 195, 172] },
  { id: "cucha-carrot", seccion: "Cuchareables", nombre: "Carrot cake cuchareable",
    desc: "Cuchareable", precio: 19.90, caja: [740, 4140, 195, 172] },
  { id: "cucha-tres-leches", seccion: "Cuchareables", nombre: "Tres leches cuchareable",
    desc: "Cuchareable", precio: 18.90, caja: [1007, 4140, 195, 172] },

  // ── COOKIES ───────────────────────────────────────────────────────
  { id: "cookie-manjar", seccion: "Cookies", nombre: "Cookie de manjar lúcuma",
    desc: "Galleta crujiente por fuera y suave por dentro, rellena de manjar blanco de lúcuma artesanal",
    precio: 11.90, caja: [373, 4900, 280, 150] },
  { id: "cookie-fudge", seccion: "Cookies", nombre: "Cookie de fudge",
    desc: "Galleta de chocolate melosa, rellena de abundante fudge casero de cacao intenso",
    precio: 11.90, caja: [747, 4900, 280, 150] },
  { id: "cookie-marshmallow", seccion: "Cookies", nombre: "Cookie de marshmallow",
    desc: "Galleta horneada con chips de chocolate y un centro suave de marshmallow derretido",
    precio: 10.90, caja: [1269, 4900, 280, 150] },
  { id: "macarron-collection", seccion: "Cookies", nombre: "Zuccherino macarron collection",
    desc: "Finas galletas de harina de almendras y merengue italiano, rellenas de fudge de chocolate a la olla y compota de frutos rojos y/o albaricoque",
    precio: 35.90, caja: [373, 5570, 280, 165] },
  { id: "giganto-roll", seccion: "Cookies", nombre: "Giganto roll",
    desc: "Masa brioche enrollada con crema de canela, coronada con glaseado de queso crema y terminada con fudge a la olla y/o crema de frutos rojos",
    precio: 22.90, caja: [747, 5570, 280, 165] },
  { id: "pan-de-mani", seccion: "Cookies", nombre: "Pan de maní (2 unidades)",
    desc: "Masa dulce con trozos de maní tostado y barnizado con leche",
    precio: 12.90, caja: [1269, 5570, 280, 165] },

  // ── SALADAS ───────────────────────────────────────────────────────
  { id: "capresse", seccion: "Saladas", nombre: "Capresse",
    desc: "Baguette, mozzarella fresca, tomate, albahaca y aceite de oliva",
    precio: 20.90, caja: [761, 6211, 192, 252] },
  { id: "jambon-beurre", seccion: "Saladas", nombre: "Jambon-beurre",
    desc: "Baguette, mantequilla con sal y jamón inglés",
    precio: 20.90, caja: [975, 6211, 192, 252] },
  { id: "croissant-mixto", seccion: "Saladas", nombre: "Croissant mixto",
    desc: "Jamón inglés y queso gouda",
    precio: 20.90, caja: [761, 6640, 192, 252] },
  { id: "clasico-pollo", seccion: "Saladas", nombre: "Clásico de pollo",
    desc: "Brioche, pollo deshilachado, tomate, lechuga y mayonesa al gusto",
    precio: 19.90, caja: [975, 6640, 192, 252] },
  { id: "tostada-palta", seccion: "Saladas", nombre: "Tostada con palta",
    desc: "Pan de masa madre con semillas andinas, media palta, queso crema philadelphia, tomate cherry y sazonador de especias",
    precio: 19.90, caja: [761, 7016, 192, 252] },
  { id: "quiche-characata", seccion: "Saladas", nombre: "Quiche characata",
    desc: "Pastel de lomo con rocoto confitado en salsa de tres quesos",
    precio: 17.00, caja: [975, 7016, 192, 252] },

  // ── LA PORTADA ────────────────────────────────────────────────────
  { id: "portada", seccion: null, nombre: "Portada",
    desc: null, precio: null, caja: [0, 216, 1920, 620] },
];

await mkdir(OUT, { recursive: true });

for (const p of PRODUCTOS) {
  const [left, top, width, height] = p.caja;
  await sharp(SRC)
    .extract({ left, top, width, height })
    // 900 px de lado largo: más que suficiente para una ficha de menú
    // y liviano para subir. Sin `withoutEnlargement` los recortes
    // chicos se estirarían y se verían borrosos.
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toFile(`${OUT}/${p.id}.jpg`);
}

console.log(`${PRODUCTOS.length} fotos en ${OUT}`);
