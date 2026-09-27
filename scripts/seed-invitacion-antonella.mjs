// Siembra la invitación REAL del baby shower de Antonella: sube la
// foto al storage, sustituye los placeholders de la plantilla
// "conejitos" y hace upsert por slug en `invitaciones`.
// Idempotente: se puede correr las veces que haga falta.
//
// Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY.
//
//   node scripts/seed-invitacion-antonella.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  DATOS,
  FILA,
  FOTO_LOCAL,
  FOTO_REMOTA,
  PLANTILLA,
  SLUG,
  TEMA,
  rellenar,
} from "./datos-invitacion-antonella.mjs";

for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 1. La foto al bucket público de siempre.
const { error: eFoto } = await db.storage
  .from("ranchos-fotos")
  .upload(FOTO_REMOTA, readFileSync(FOTO_LOCAL), {
    contentType: "image/webp",
    upsert: true,
  });
if (eFoto) {
  console.error(`✗ subida de la foto: ${eFoto.message}`);
  process.exit(1);
}
const fotoUrl = db.storage.from("ranchos-fotos").getPublicUrl(FOTO_REMOTA).data
  .publicUrl;
console.log(`✓ foto → ${fotoUrl}`);

// 2. La plantilla con todo sustituido.
const html = rellenar(readFileSync(PLANTILLA, "utf8"), {
  ...DATOS,
  FOTO: fotoUrl,
});
const sobran = html.match(/\{\{[A-Z_]+\}\}/g);
if (sobran) {
  console.error(`✗ quedaron placeholders sin llenar: ${[...new Set(sobran)].join(", ")}`);
  process.exit(1);
}

// 3. Upsert por slug.
const { error } = await db
  .from("invitaciones")
  .upsert(
    { slug: SLUG, tema: TEMA, html_personalizado: html, ...FILA },
    { onConflict: "slug" },
  );
if (error) {
  console.error(`✗ ${SLUG}: ${error.message}`);
  process.exit(1);
}

const { data } = await db
  .from("invitaciones")
  .select("slug, estado, fecha_evento, hora, lugar_nombre")
  .eq("slug", SLUG)
  .single();
console.log(`✓ ${SLUG} sembrada (${html.length} caracteres de HTML)`);
console.log("Verificación:", JSON.stringify(data));
console.log(`Link público: https://www.bookea.lat/i/${SLUG}`);
