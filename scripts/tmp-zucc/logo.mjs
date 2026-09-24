import sharp from "sharp";

/**
 * El logo del link hub: monograma «Z» en serif, blanco sobre su menta.
 *
 * ── POR QUÉ NO SE USA SU SELLO DE CHOCOLATE ─────────────────────────
 * Se probó recortarlo del héroe (el disco menta que corona la torta) y
 * a 600 px ya sale borroso: es un objeto fotografiado de costado, no un
 * archivo. En el disco de 48 px del link hub quedaría una mancha.
 *
 * ── POR QUÉ UNA «Z» Y NO EL NOMBRE COMPLETO ─────────────────────────
 * Porque el logo se pinta en un círculo de 48 px. «ZUCCHERINO» ahí
 * mide 4 px por letra: ilegible. El nombre ya va al lado, en texto de
 * verdad. Es la misma decisión que toma cualquier avatar de marca.
 *
 * Los colores y la familia tipográfica son los suyos, medidos de la
 * captura: menta #a8d5c8 y una serif de interletrado abierto.
 */
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#a8d5c8"/>
  <text x="256" y="300" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="260" letter-spacing="6" fill="#ffffff">Z</text>
  <text x="256" y="372" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="30" letter-spacing="11" fill="#ffffff" opacity="0.9">ZUCCHERINO</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("scripts/tmp-zucc/fotos-logo.png");
console.log("ok");
