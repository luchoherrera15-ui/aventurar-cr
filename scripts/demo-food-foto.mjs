// Baja UNA foto de Unsplash (licencia libre, nunca Unsplash+) para la
// demo comercial de FOOD.BOOKEA. Uso:
//   node scripts/demo-food-foto.mjs "<query>" <ruta-destino.jpg> [salto]
// `salto` (0 por defecto) elige el N-ésimo resultado aceptable — sirve
// para que dos restaurantes de la misma cocina no terminen con la
// misma foto.
import { writeFile } from "node:fs/promises";

const [query, destino, saltoRaw] = process.argv.slice(2);
if (!query || !destino) {
  console.error('uso: node scripts/demo-food-foto.mjs "<query>" <destino.jpg> [salto]');
  process.exit(1);
}
const salto = Number(saltoRaw ?? 0);

const r = await fetch(
  `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=30`,
);
const json = await r.json();
const aceptables = (json.results ?? []).filter(
  (f) =>
    f.urls?.regular &&
    !f.premium &&
    !f.plus &&
    !f.urls.regular.includes("plus.unsplash.com"),
);
const foto = aceptables[salto] ?? aceptables[aceptables.length - 1];
if (!foto) {
  console.error(`SIN RESULTADO: ${query}`);
  process.exit(2);
}
const img = await fetch(foto.urls.regular);
const buf = Buffer.from(await img.arrayBuffer());
await writeFile(destino, buf);
console.log(`${destino} <- ${foto.id} (${Math.round(buf.length / 1024)} KB) por ${foto.user?.name ?? "?"}`);
