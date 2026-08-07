// Siembra las demos de invitación desde sus plantillas de
// docs/plantillas-invitaciones, sustituyendo los placeholders.
// Idempotente: upsert por slug.
//
// USO:
//   node scripts/seed-demo-invitaciones-formal-zoo.mjs            → todas
//   node scripts/seed-demo-invitaciones-formal-zoo.mjs {slug}     → solo esa
// El filtro por slug existe para no pisar el estado de las demás
// (p. ej. demo-zoologico está archivada a propósito: correr el script
// completo la reactivaría).
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

const DEMOS = [
  {
    // La "Invitación Estándar" de boda: UNA sola pantalla sin scroll,
    // blanco con ondas de seda crema — sustituye al ejemplo de esa
    // card en la landing. Confirmación por WhatsApp, no por el RSVP.
    slug: "demo-boda-estandar",
    tema: "boda-estandar",
    plantilla: "docs/plantillas-invitaciones/boda-estandar.html",
    fila: {
      titulo: "Valeria & Andrés — ¡Nos casamos!",
      anfitriones: "Valeria & Andrés",
      mensaje: "Queremos celebrarlo con vos.",
      fecha_evento: "2027-01-03",
      hora: "4:00 p. m.",
      lugar_nombre: "Hacienda Monteflor",
      direccion: "Ciudad Colón, San José",
      estado: "activa",
    },
    datos: {
      NOMBRE_1: "Valeria",
      NOMBRE_2: "Andrés",
      FECHA: "3 · Enero · 2027",
      FECHA_ISO: "2027-01-03T16:00:00-06:00",
      HORA: "4:00 p. m.",
      LUGAR: "Hacienda Monteflor",
      LINK_MAPS: "https://maps.google.com/?q=9.9439,-84.2273",
      LINK_CONFIRMAR: `https://wa.me/50688888888?text=${encodeURIComponent(
        "¡Hola! Confirmo mi asistencia a la boda de Valeria y Andrés 💍",
      )}`,
    },
  },
  {
    // La "Invitación Premium" de boda (Carta de Amor): el sobre lacrado
    // que se abre con música de saxofón y revela la historia por
    // capítulos al scrollear. Usa el bloque RSVP real de la página.
    slug: "demo-boda-premium",
    tema: "boda-premium",
    plantilla: "docs/plantillas-invitaciones/boda-premium.html",
    fila: {
      titulo: "Isabella & Mateo — ¡Nos casamos!",
      anfitriones: "Isabella & Mateo",
      mensaje: "Abrí el sobre — tenemos algo que contarte.",
      fecha_evento: "2027-01-03",
      hora: "4:00 p. m.",
      lugar_nombre: "Jardines del Valle Escondido",
      direccion: "San Rafael de Escazú, San José",
      estado: "activa",
    },
    datos: {
      NOMBRE_1: "Isabella",
      NOMBRE_2: "Mateo",
      INICIALES: "I · M",
      DIA_PALABRA: "Tres",
      MES: "Enero",
      ANIO: "2027",
      HORARIO: "4:00 p. m. a 10:00 p. m.",
      HORA: "4:00 p. m.",
      FECHA_ISO: "2027-01-03T16:00:00-06:00",
      FECHA_CORTA: "03 · 01 · 2027",
      LUGAR: "Jardines del Valle Escondido",
      DIRECCION: "San Rafael de Escazú, San José",
      LINK_MAPS: "https://maps.google.com/?q=9.9189,-84.1370",
      LINK_WAZE: "https://waze.com/ul?ll=9.9189,-84.1370&navigate=yes",
      LINK_CALENDARIO:
        "https://calendar.google.com/calendar/render?action=TEMPLATE" +
        `&text=${encodeURIComponent("Boda de Isabella & Mateo")}` +
        "&dates=20270103T160000/20270103T220000" +
        "&ctz=America/Costa_Rica" +
        `&details=${encodeURIComponent(
          "¡Nos casamos! Acompañanos en Jardines del Valle Escondido. Vestimenta: formal elegante.",
        )}` +
        `&location=${encodeURIComponent(
          "Jardines del Valle Escondido, San Rafael de Escazú, San José, Costa Rica",
        )}`,
      FOTO_1:
        "https://bjhprmtobmualefvcmau.supabase.co/storage/v1/object/public/ranchos-fotos/invitaciones-demo/boda-premium/santorini.jpg",
      FOTO_2:
        "https://bjhprmtobmualefvcmau.supabase.co/storage/v1/object/public/ranchos-fotos/invitaciones-demo/boda-premium/paris.jpg",
      FOTO_3:
        "https://bjhprmtobmualefvcmau.supabase.co/storage/v1/object/public/ranchos-fotos/invitaciones-demo/boda-premium/kioto.jpg",
      CANCION:
        "https://bjhprmtobmualefvcmau.supabase.co/storage/v1/object/public/ranchos-fotos/invitaciones-demo/boda-premium/cancion-sax.mp3",
    },
  },
  {
    slug: "demo-formal",
    tema: "formal",
    plantilla: "docs/plantillas-invitaciones/formal.html",
    fila: {
      titulo: "Gala 50 aniversario — Elena & Rodrigo",
      anfitriones: "Familia Solano Herrera",
      mensaje: "Cincuenta años de historia merecen una noche inolvidable.",
      fecha_evento: "2026-11-21",
      hora: "7:00 p. m.",
      lugar_nombre: "Hotel Casa Real",
      direccion: "Barrio Otoya, San José",
      estado: "activa",
    },
    datos: {
      NOMBRES: "Elena & Rodrigo",
      MONOGRAMA: "E & R",
      OCASION: "Gala 50 aniversario",
      FECHA: "sábado 21 de noviembre, 2026",
      FECHA_ISO: "2026-11-21T19:00:00-06:00",
      HORA: "7:00 p. m.",
      LUGAR: "Hotel Casa Real",
      DIRECCION: "Barrio Otoya, San José",
      LINK_MAPS: maps("Hotel Casa Real, Barrio Otoya, San José, Costa Rica"),
      LINK_WAZE: waze("Hotel Casa Real, Barrio Otoya, San José"),
      LINK_REGALO_1: "https://bookea.lat",
      LINK_REGALO_2: "https://bookea.lat",
      SINPE: "8888-8888",
    },
  },
  {
    slug: "demo-zoologico",
    tema: "zoologico",
    plantilla: "docs/plantillas-invitaciones/zoologico.html",
    fila: {
      titulo: "El safari de Valentina — ¡cumple 4!",
      anfitriones: "Papá y mamá de Valentina",
      mensaje: "¡Nuestra exploradora favorita cumple 4 y lo celebramos en grande!",
      fecha_evento: "2026-10-10",
      hora: "10:00 a. m.",
      lugar_nombre: "Salón La Selva",
      direccion: "San Francisco de Heredia",
      estado: "activa",
    },
    datos: {
      NOMBRE: "Valentina",
      EDAD: "4",
      FECHA: "sábado 10 de octubre, 2026",
      FECHA_ISO: "2026-10-10T10:00:00-06:00",
      HORA: "10:00 a. m.",
      LUGAR: "Salón La Selva",
      DIRECCION: "San Francisco de Heredia",
      LINK_MAPS: maps("Salón La Selva, San Francisco, Heredia, Costa Rica"),
      LINK_WAZE: waze("Salón La Selva, San Francisco, Heredia"),
      LINK_REGALO_1: "https://bookea.lat",
      LINK_REGALO_2: "https://bookea.lat",
      SINPE: "8888-8888",
    },
  },
];

const soloSlug = process.argv[2];
const aSembrar = soloSlug
  ? DEMOS.filter((demo) => demo.slug === soloSlug)
  : DEMOS;
if (soloSlug && aSembrar.length === 0) {
  console.error(`✗ No hay demo con slug "${soloSlug}"`);
  process.exit(1);
}

for (const demo of aSembrar) {
  const html = rellenar(readFileSync(demo.plantilla, "utf8"), demo.datos);
  const { error } = await db
    .from("invitaciones")
    .upsert(
      { slug: demo.slug, tema: demo.tema, html_personalizado: html, ...demo.fila },
      { onConflict: "slug" },
    );
  if (error) {
    console.error(`✗ ${demo.slug}: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${demo.slug} sembrada (${html.length} caracteres de HTML)`);
  }
}

const { data } = await db
  .from("invitaciones")
  .select("slug, estado")
  .in(
    "slug",
    aSembrar.map((demo) => demo.slug),
  );
console.log("Verificación:", JSON.stringify(data));
