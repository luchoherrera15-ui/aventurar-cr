/**
 * Comprime UNA VEZ las fotos ya subidas al bucket `ranchos-fotos`.
 *
 * Las fotos nuevas ya se comprimen en el navegador al subirlas
 * (src/lib/imagenes.ts), pero las viejas quedaron a tamaño completo
 * (3–8 MB cada una) y son las que hacen lenta la página. Este script
 * las baja, las reescala a 1600px máximo, las recodifica en JPEG y las
 * vuelve a subir EN LA MISMA RUTA — las URLs guardadas en la base no
 * cambian, así que no hay que tocar nada más.
 *
 * Cómo correrlo (una sola vez, desde tu compu):
 *
 *   1. npm install --no-save sharp
 *   2. SUPABASE_URL="https://TU-PROYECTO.supabase.co" \
 *      SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
 *      node scripts/comprimir-fotos-viejas.mjs
 *
 * La service_role key está en Supabase → Settings → API. NUNCA la
 * subas al repo ni la pongas en .env.local del proyecto web.
 *
 * El script es idempotente: las fotos que ya pesan poco se saltan, así
 * que se puede correr de nuevo sin miedo si se corta a la mitad.
 */

import { createClient } from "@supabase/supabase-js";

const URL_SUPABASE = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "ranchos-fotos";
const LADO_MAX = 1600;
const CALIDAD = 82;
// Por debajo de esto ya está bien: no vale la pena recodificar.
const UMBRAL_BYTES = 400 * 1024;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error(
    "Faltan variables: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Ejemplo:\n" +
      '  SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="eyJ..." node scripts/comprimir-fotos-viejas.mjs',
  );
  process.exit(1);
}

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Falta sharp. Instalalo sin tocar package.json:\n  npm install --no-save sharp");
  process.exit(1);
}

const supabase = createClient(URL_SUPABASE, SERVICE_KEY);

/** Lista recursiva de todos los archivos del bucket. */
async function listarTodo(prefijo = "") {
  const archivos = [];
  let pagina = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefijo, {
      limit: 100,
      offset: pagina * 100,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`No pude listar "${prefijo}": ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const ruta = prefijo ? `${prefijo}/${item.name}` : item.name;
      // Las carpetas vienen sin id — se recorren; los archivos se acumulan.
      if (item.id) archivos.push({ ruta, bytes: item.metadata?.size ?? 0 });
      else archivos.push(...(await listarTodo(ruta)));
    }
    if (data.length < 100) break;
    pagina++;
  }
  return archivos;
}

const EXTENSIONES = /\.(jpe?g|png|webp)$/i;

console.log(`Listando ${BUCKET}…`);
const todos = await listarTodo();
const candidatas = todos.filter((a) => EXTENSIONES.test(a.ruta) && a.bytes > UMBRAL_BYTES);
const yaLivianas = todos.filter((a) => EXTENSIONES.test(a.ruta)).length - candidatas.length;
console.log(
  `${todos.length} archivos; ${candidatas.length} fotos por comprimir (${yaLivianas} ya livianas).`,
);

let ahorrados = 0;
let fallos = 0;

for (const [i, foto] of candidatas.entries()) {
  const etiqueta = `[${i + 1}/${candidatas.length}] ${foto.ruta}`;
  try {
    const { data: blob, error: errorBajada } = await supabase.storage
      .from(BUCKET)
      .download(foto.ruta);
    if (errorBajada) throw new Error(errorBajada.message);

    const original = Buffer.from(await blob.arrayBuffer());
    const comprimida = await sharp(original)
      .rotate() // aplica la orientación EXIF antes de descartar la metadata
      .resize(LADO_MAX, LADO_MAX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: CALIDAD, mozjpeg: true })
      .toBuffer();

    if (comprimida.length >= original.length) {
      console.log(`${etiqueta} — ya estaba óptima, se salta`);
      continue;
    }

    // Misma ruta y contentType image/jpeg: aunque la extensión diga
    // .png, los navegadores respetan el contentType del Storage.
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(foto.ruta, comprimida, { upsert: true, contentType: "image/jpeg" });
    if (errorSubida) throw new Error(errorSubida.message);

    ahorrados += original.length - comprimida.length;
    console.log(
      `${etiqueta} — ${(original.length / 1e6).toFixed(1)} MB → ${(comprimida.length / 1e6).toFixed(2)} MB`,
    );
  } catch (e) {
    fallos++;
    console.error(`${etiqueta} — FALLÓ: ${e.message}`);
  }
}

console.log(
  `\nListo. Ahorrados ${(ahorrados / 1e6).toFixed(1)} MB en total.` +
    (fallos ? ` ${fallos} fotos fallaron (se pueden reintentar corriendo de nuevo).` : ""),
);
