// Siembra la demo de invitación CASTILLO DE PRINCESAS desde su
// plantilla (docs/plantillas-invitaciones/princesas.html), sustituyendo
// los placeholders. Idempotente: upsert por slug.
//
// USO:
//   node scripts/seed-demo-princesas.mjs
//
// Script propio y aparte a propósito: cada demo de la vitrina siembra
// la suya y así dos agentes pueden trabajar en paralelo sin pisarse
// (seed-demo-invitaciones-formal-zoo.mjs, seed-demo-invitacion-aracnida.mjs
// y seed-demo-quince-anos.mjs siguen intactos).
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

// Salón Los Jardines, Heredia — coordenadas reales del centro de
// Heredia (el salón es inventado, es una demo de vitrina).
const COORD = "9.9981,-84.1197";
const LINK_MAPS = `https://www.google.com/maps/search/?api=1&query=${COORD}`;
const LINK_WAZE = `https://waze.com/ul?ll=${COORD}&navigate=yes`;

const DEMO = {
  slug: "demo-princesas",
  tema: "princesas",
  plantilla: "docs/plantillas-invitaciones/princesas.html",
  fila: {
    titulo: "Los 6 años de Julieta",
    anfitriones: "Natalia y Diego",
    mensaje:
      "Julieta cumple seis años y abre las puertas de su castillo en Heredia.",
    fecha_evento: "2027-03-13",
    hora: "2:00 p. m.",
    lugar_nombre: "Salón Los Jardines",
    direccion: "Heredia, Costa Rica",
    maps_url: LINK_MAPS,
    estado: "activa",
  },
  datos: {
    NOMBRE: "Julieta",
    EDAD: "6",
    FECHA_CORTA: "Sábado 13 de marzo · 2027",
    FECHA_LARGA: "Sábado 13 de marzo de 2027",
    DIA: "13",
    MES_CORTO: "MARZO",
    HORA: "2:00 p. m.",
    HORA_FIN: "6:00 p. m.",
    HORA_QUEQUE: "4:00",
    LUGAR: "Salón Los Jardines",
    DIRECCION: "Heredia, Costa Rica",
    LINK_MAPS,
    LINK_WAZE,
    PADRES: "Sus papás — Natalia y Diego",
    // La capitular va aparte: en la hoja del cuento se dibuja grande y
    // dorada, y el párrafo arranca en la segunda letra.
    INICIAL: "É",
    MENSAJE:
      "rase una vez una niña de Heredia que se ríe fuerte, pide cuentos " +
      "largos y baila hasta quedarse sin zapatos. Este sábado cumple seis " +
      "años, abre las puertas de su castillo y quiere que vengás a " +
      "celebrarla con ella.",
    LIMITE: "viernes 6 de marzo",
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
