// Valida el set de la demo de FOOD.BOOKEA: 45 restaurantes, slugs y
// nombres únicos, y que TODA foto referenciada exista en public/ con
// un tamaño razonable. Complementa al chequeo de tipos de `next build`
// (este script no compila TS: extrae los literales por regex).
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const DATOS = "src/lib/food/demo/datos";
const raiz = process.cwd();
const errores = [];

const archivos = (await readdir(join(raiz, DATOS))).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts",
);

let total = 0;
const slugs = new Map();
const nombres = new Map();
const fotos = new Set();

for (const archivo of archivos) {
  const texto = await readFile(join(raiz, DATOS, archivo), "utf8");
  const enArchivo = [...texto.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
  total += enArchivo.length;
  for (const s of enArchivo) {
    if (slugs.has(s)) errores.push(`slug repetido: "${s}" (${archivo} y ${slugs.get(s)})`);
    slugs.set(s, archivo);
  }
  for (const m of texto.matchAll(/nombre:\s*"([^"]+)"/g)) {
    if (nombres.has(m[1])) errores.push(`nombre repetido: "${m[1]}"`);
    nombres.set(m[1], archivo);
  }
  for (const m of texto.matchAll(/"(\/food-demo\/[rm]\/[^"]+\.jpg)"/g)) fotos.add(m[1]);
  const menus = [...texto.matchAll(/menu:\s*\[/g)].length;
  if (menus !== enArchivo.length) {
    errores.push(`${archivo}: ${enArchivo.length} restaurantes pero ${menus} menús`);
  }
  console.log(`${archivo}: ${enArchivo.length} restaurantes, ${menus} menús`);
}

if (total !== 45) errores.push(`total de restaurantes: ${total} (se esperaban 45)`);

for (const foto of fotos) {
  try {
    const s = await stat(join(raiz, "public", foto.replace(/^\//, "")));
    if (s.size < 15_000) errores.push(`foto sospechosamente chica (${Math.round(s.size / 1024)} KB): ${foto}`);
  } catch {
    errores.push(`foto faltante: ${foto}`);
  }
}

console.log(`\nTotal: ${total} restaurantes, ${fotos.size} fotos referenciadas`);
if (errores.length) {
  console.error(`\n${errores.length} PROBLEMAS:`);
  for (const e of errores) console.error(` - ${e}`);
  process.exit(1);
}
console.log("TODO OK");
