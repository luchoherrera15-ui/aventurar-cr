// Sube las fotos reales de los bebés al storage y las enchufa en la
// invitación de revelación (reemplaza {{FOTO_NINA}}/{{FOTO_NINO}}).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const FOTOS = [
  {
    placeholder: "{{FOTO_NINO}}",
    local: "docs/plantillas-invitaciones/fotos/ChatGPT Image 30 jul 2026, 07_30_16.png",
    remoto: "invitaciones/revelacion/bebe-nino.png",
  },
  {
    placeholder: "{{FOTO_NINA}}",
    local: "docs/plantillas-invitaciones/fotos/ChatGPT Image 30 jul 2026, 07_33_11.png",
    remoto: "invitaciones/revelacion/bebe-nina.png",
  },
];

const urls = {};
for (const f of FOTOS) {
  const { error } = await db.storage
    .from("ranchos-fotos")
    .upload(f.remoto, readFileSync(f.local), {
      contentType: "image/png",
      upsert: true,
    });
  if (error) {
    console.error(`✗ subida ${f.remoto}: ${error.message}`);
    process.exit(1);
  }
  urls[f.placeholder] = db.storage.from("ranchos-fotos").getPublicUrl(f.remoto).data.publicUrl;
  console.log(`✓ ${f.remoto} → ${urls[f.placeholder]}`);
}

const { data: inv, error: e1 } = await db
  .from("invitaciones")
  .select("html_personalizado")
  .eq("slug", "revelacion-maria-jesus-y-luis")
  .single();
if (e1 || !inv) {
  console.error("✗ no se encontró la invitación:", e1?.message);
  process.exit(1);
}

let html = inv.html_personalizado;
for (const [ph, url] of Object.entries(urls)) html = html.replaceAll(ph, url);

const { error: e2 } = await db
  .from("invitaciones")
  .update({ html_personalizado: html })
  .eq("slug", "revelacion-maria-jesus-y-luis");
if (e2) {
  console.error("✗ update:", e2.message);
  process.exit(1);
}
console.log(
  "✓ Invitación actualizada — placeholders restantes:",
  (html.match(/\{\{FOTO_[A-Z]+\}\}/g) ?? []).length,
);
