// Siembra la demo de invitación de ESCUELA DE MAGIA desde su plantilla
// (docs/plantillas-invitaciones/magia.html), sustituyendo los
// placeholders. Idempotente: upsert por slug.
//
// USO:
//   node scripts/seed-demo-magia.mjs
//
// Script propio y aparte a propósito: cada demo maneja el suyo y no hay
// que tocar los de las otras para agregar esta.
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

// Casa Quinta El Roble Viejo, Santa Ana — coordenadas reales de Santa
// Ana, San José (la casa quinta es inventada para la demo).
const COORD = "9.9341,-84.1897";

// "Frost Waltz" de Kevin MacLeod (incompetech.com), CC BY 3.0 — un vals
// delicado y misterioso, del registro del género y de nadie en
// particular. El crédito va en el pie de la invitación.
const CANCION =
  "https://bjhprmtobmualefvcmau.supabase.co/storage/v1/object/public/ranchos-fotos/invitaciones-demo/magia/cancion.mp3";

const DEMO = {
  slug: "demo-magia",
  tema: "magia",
  plantilla: "docs/plantillas-invitaciones/magia.html",
  fila: {
    titulo: "Tomás cumple 8 — Academia Candelaria",
    anfitriones: "Andrea y Rodrigo",
    mensaje:
      "Tomás cumple 8 y el jardín se convierte en escuela de magia por una tarde.",
    fecha_evento: "2027-04-24",
    hora: "3:00 p. m.",
    lugar_nombre: "Casa Quinta El Roble Viejo",
    direccion: "Santa Ana, San José",
    maps_url: `https://www.google.com/maps/search/?api=1&query=${COORD}`,
    estado: "activa",
  },
  datos: {
    NOMBRE: "Tomás",
    EDAD: "8",
    FECHA_CORTA: "Sábado 24 de abril · 2027",
    FECHA_LARGA: "Sábado 24 de abril de 2027",
    DIA: "24",
    MES_CORTO: "Abril",
    ANIO: "2027",
    HORA: "3:00 p. m.",
    HORA_FIN: "7:00 p. m.",
    HORA_QUEQUE: "5:00 p. m.",
    LUGAR: "Casa Quinta El Roble Viejo",
    DIRECCION: "Santa Ana, San José",
    LINK_MAPS: `https://www.google.com/maps/search/?api=1&query=${COORD}`,
    LINK_WAZE: `https://waze.com/ul?ll=${COORD}&navigate=yes`,
    PADRES: "Sus papás — Andrea y Rodrigo",
    // La capitular va aparte: en la carta se dibuja en grande y en
    // color lacre, como en un libro viejo. {{MENSAJE}} es el párrafo
    // SIN su primera letra.
    INICIAL: "T",
    MENSAJE:
      "omás lleva medio año durmiendo con una rama debajo de la almohada porque dice que es su varita. Este sábado le vamos a dar la razón: el jardín se vuelve Academia por una tarde y hacen falta magos de primer curso.",
    LIMITE: "viernes 16 de abril",
    CANCION,
    CREDITO_MUSICA:
      "Música: Frost Waltz — Kevin MacLeod (incompetech.com), CC BY 3.0",
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
  .select("slug, estado, tema, fecha_evento, hora, lugar_nombre")
  .eq("slug", DEMO.slug);
console.log("Verificación:", JSON.stringify(data));
