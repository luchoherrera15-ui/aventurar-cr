// Siembra la demo de invitación de DINOSAURIOS desde su plantilla
// (docs/plantillas-invitaciones/dinosaurios.html), sustituyendo los
// placeholders. Idempotente: upsert por slug.
//
// USO:
//   node scripts/seed-demo-dinosaurios.mjs
//
// Script propio y aparte a propósito, igual que seed-demo-quince-anos.mjs:
// seed-demo-invitaciones-formal-zoo.mjs maneja sus demos y no hay que
// tocarlo para agregar esta.
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

/**
 * "Emiliano" → un <span class="dino-letra"> por letra, numerados con
 * --i para que el título de la portada suba letra por letra. Los
 * espacios van con &nbsp; para que no colapsen entre inline-blocks.
 */
function enLetras(nombre) {
  return [...nombre]
    .map((letra, i) =>
      letra === " "
        ? `<span class="dino-letra" style="--i: ${i}">&nbsp;</span>`
        : `<span class="dino-letra" style="--i: ${i}">${letra}</span>`,
    )
    .join("");
}

// Rancho El Roble, San Rafael de Alajuela — coordenadas reales de San
// Rafael de Alajuela (el rancho es inventado para la demo).
const COORD = "9.9862,-84.1985";

const DEMO = {
  slug: "demo-dinosaurios",
  tema: "dinosaurios",
  plantilla: "docs/plantillas-invitaciones/dinosaurios.html",
  fila: {
    titulo: "El cumple de Emiliano — ¡ya ruge 5 años!",
    anfitriones: "Karla y Josué",
    mensaje:
      "Emiliano cumple 5 y quiere celebrarlo excavando fósiles en la selva.",
    fecha_evento: "2026-11-07",
    hora: "11:00 a. m.",
    lugar_nombre: "Rancho El Roble",
    direccion: "San Rafael de Alajuela",
    maps_url: `https://www.google.com/maps/search/?api=1&query=${COORD}`,
    estado: "activa",
  },
  datos: {
    NOMBRE_LETRAS: enLetras("Emiliano"),
    EDAD: "5",
    ESPECIE: "Emilianosaurus Rex",
    DIETA: "Herbívoro de queque",
    DIA_SEMANA: "Sábado",
    DIA: "07",
    MES: "Noviembre",
    ANIO: "2026",
    FECHA: "Sábado 7 de noviembre de 2026",
    HORA: "11:00 a. m.",
    HORA_FIN: "3:00 p. m.",
    LUGAR: "Rancho El Roble",
    LUGAR_CORTO: "El Roble",
    DIRECCION: "San Rafael de Alajuela",
    NOTA_LUGAR:
      "Hay parqueo dentro del rancho. Entrás por el portón verde y seguís las huellas hasta el área de la excavación.",
    LINK_MAPS: `https://www.google.com/maps/search/?api=1&query=${COORD}`,
    LINK_WAZE: `https://waze.com/ul?ll=${COORD}&navigate=yes`,
    PADRES: "Sus papás — Karla y Josué",
    MENSAJE:
      "Emiliano lleva medio año convencido de que es un dinosaurio. Ya nos rendimos: le vamos a hacer la fiesta en la selva. Vení a rugir con él.",
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
