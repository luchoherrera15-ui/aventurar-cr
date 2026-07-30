// Siembra la invitación REAL de la revelación de género de María Jesús
// Zamora y Luis Herrera desde la plantilla "revelacion-genero" de
// docs/plantillas-invitaciones, sustituyendo los placeholders.
// Idempotente: upsert por slug. Sin cliente asignado (eso lo hace el
// admin después). FOTO_NINA/FOTO_NINO quedan con el placeholder literal
// a propósito: el onerror del <img> lo oculta y muestra los bebés SVG;
// cuando haya fotos reales se re-siembra con las URLs.
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

function rellenar(plantilla, datos) {
  return Object.entries(datos).reduce(
    (html, [clave, valor]) => html.replaceAll(`{{${clave}}}`, valor),
    plantilla,
  );
}

const maps = (q) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const waze = (q) => `https://waze.com/ul?q=${encodeURIComponent(q)}`;

const SLUG = "revelacion-maria-jesus-y-luis";

const fila = {
  slug: SLUG,
  tema: "revelacion-genero",
  titulo: "¿Niño o Niña? — María Jesús & Luis",
  anfitriones: "María Jesús Zamora y Luis Herrera",
  mensaje:
    "Si creés que es NIÑO, traé pañales 💙 · Si creés que es NIÑA, traé toallitas 🌸",
  fecha_evento: "2026-08-01",
  hora: "1:00 p. m.",
  lugar_nombre: "Hacienda Los Reyes",
  direccion: "Hacienda Los Reyes",
  estado: "activa",
};

const datos = {
  NOMBRES: "María Jesús & Luis",
  FECHA: "sábado 1 de agosto, 2026",
  FECHA_ISO: "2026-08-01T13:00:00-06:00",
  HORA: "1:00 p. m.",
  LUGAR: "Hacienda Los Reyes",
  DIRECCION:
    "Con un toque en el botón, el mapa te lleva directito a la hacienda.",
  LINK_MAPS: maps("Hacienda Los Reyes, Costa Rica"),
  LINK_WAZE: waze("Hacienda Los Reyes"),
  // FOTO_NINA y FOTO_NINO se quedan como placeholders literales (ver
  // arriba): así los marcos muestran los bebés SVG mientras no haya
  // fotos reales.
};

const html = rellenar(
  readFileSync("docs/plantillas-invitaciones/revelacion-genero.html", "utf8"),
  datos,
);

const { error } = await db
  .from("invitaciones")
  .upsert({ ...fila, html_personalizado: html }, { onConflict: "slug" });
if (error) {
  console.error(`✗ ${SLUG}: ${error.message}`);
  process.exit(1);
}
console.log(`✓ ${SLUG} sembrada (${html.length} caracteres de HTML)`);

const { data } = await db
  .from("invitaciones")
  .select("slug, tema, titulo, estado, fecha_evento, hora, lugar_nombre")
  .eq("slug", SLUG);
console.log("Verificación:", JSON.stringify(data, null, 2));
