// Siembra la demo de invitación de QUINCE AÑOS desde su plantilla
// (docs/plantillas-invitaciones/quince-anos.html), sustituyendo los
// placeholders. Idempotente: upsert por slug.
//
// USO:
//   node scripts/seed-demo-quince-anos.mjs
//
// Script propio y aparte a propósito: seed-demo-invitaciones-formal-zoo.mjs
// maneja sus cuatro demos y no hay que tocarlo para agregar esta.
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

// Salón Villa Sofía, Santa Ana — coordenadas reales de Santa Ana,
// San José (el salón es inventado para la demo).
const COORD = "9.9328,-84.1836";

const DEMO = {
  slug: "demo-quince-anos",
  tema: "quince-anos",
  plantilla: "docs/plantillas-invitaciones/quince-anos.html",
  fila: {
    titulo: "Camila Fernanda — Mis XV Años",
    anfitriones: "Marcela Vargas & Esteban Solano",
    mensaje:
      "Camila Fernanda cumple quince y quiere celebrarlo con la gente que la vio crecer.",
    fecha_evento: "2027-03-20",
    hora: "7:00 p. m.",
    lugar_nombre: "Salón Villa Sofía",
    direccion: "Santa Ana, San José",
    maps_url: `https://www.google.com/maps/search/?api=1&query=${COORD}`,
    estado: "activa",
  },
  datos: {
    NOMBRE: "Camila Fernanda",
    OCASION: "Mis XV Años",
    PADRES: "Sus papás · Marcela Vargas & Esteban Solano",
    FECHA: "Sábado 20 de marzo, 2027",
    DIA: "20",
    MES: "Marzo",
    ANIO: "2027",
    HORA: "7:00 p. m.",
    LUGAR: "Salón Villa Sofía",
    DIRECCION: "Santa Ana, San José",
    LINK_MAPS: `https://www.google.com/maps/search/?api=1&query=${COORD}`,
    LINK_WAZE: `https://waze.com/ul?ll=${COORD}&navigate=yes`,
    MENSAJE:
      "Hay una canción que mi papá me canta desde que tengo memoria. Esa noche la vamos a bailar de verdad, delante de todos ustedes. No quiero que falte nadie de los que me trajeron hasta acá.",
    FIRMA: "Camila Fernanda",
    VESTIMENTA: "Etiqueta rigurosa",
    COLOR_RESERVADO: "rosa empolvado",
    LINK_REGALO: "https://bookea.lat",
    SINPE: "8888-8888",
  },
};

const html = rellenar(readFileSync(DEMO.plantilla, "utf8"), DEMO.datos);

// Aviso temprano si quedó algún placeholder sin sustituir: es el error
// que más caro sale (la invitación sale publicada con {{LUGAR}} adentro).
const sueltos = [...new Set(html.match(/\{\{[A-Z_0-9]+\}\}/g) ?? [])];
if (sueltos.length) {
  console.error(`✗ Placeholders sin sustituir: ${sueltos.join(", ")}`);
  process.exit(1);
}

const { error } = await db
  .from("invitaciones")
  .upsert(
    { slug: DEMO.slug, tema: DEMO.tema, html_personalizado: html, ...DEMO.fila },
    { onConflict: "slug" },
  );

if (error) {
  console.error(`✗ ${DEMO.slug}: ${error.message}`);
  process.exit(1);
}
console.log(`✓ ${DEMO.slug} sembrada (${html.length} caracteres de HTML)`);

const { data } = await db
  .from("invitaciones")
  .select("slug, estado, tema, fecha_evento, hora")
  .eq("slug", DEMO.slug);
console.log("Verificación:", JSON.stringify(data));
