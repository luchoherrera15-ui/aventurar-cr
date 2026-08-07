// Siembra la demo CORPORATIVA (/i/demo-corporativa) desde la plantilla
// docs/plantillas-invitaciones/corporativa.html, sustituyendo los
// placeholders. Idempotente: upsert por slug.
//
// USO:  node scripts/seed-demo-corporativa.mjs
//
// El evento y la empresa son INVENTADOS (Grupo Altamar): es una demo de
// catálogo, no un cliente real. Vive en su propio script para no pisar el
// estado de las otras demos.
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

// Salón Panorama es un lugar inventado; las coordenadas son de Escazú.
const COORDENADAS = "9.9186,-84.1407";

const CALENDARIO =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  `&text=${encodeURIComponent("Cena de Fin de Año 2026 — Grupo Altamar")}` +
  "&dates=20261211T183000/20261211T233000" +
  "&ctz=America/Costa_Rica" +
  `&details=${encodeURIComponent(
    "Recepción 6:30 p. m. · Palabras de bienvenida 7:15 · Cena 8:00 · " +
      "Premiación 9:30 · Música y baile 10:30. Vestimenta: formal de " +
      "negocios / cóctel. Confirmá antes del 1 de diciembre.",
  )}` +
  `&location=${encodeURIComponent(
    "Salón Panorama, Escazú, San José, Costa Rica",
  )}`;

const DEMO = {
  slug: "demo-corporativa",
  tema: "corporativa",
  plantilla: "docs/plantillas-invitaciones/corporativa.html",
  fila: {
    titulo: "Cena de Fin de Año 2026 — Grupo Altamar",
    anfitriones: "Grupo Altamar",
    mensaje: "Cerramos el año como se debe: juntos.",
    fecha_evento: "2026-12-11",
    hora: "6:30 p. m.",
    lugar_nombre: "Salón Panorama",
    direccion: "Escazú, San José",
    maps_url: `https://www.google.com/maps/search/?api=1&query=${COORDENADAS}`,
    estado: "activa",
  },
  datos: {
    EMPRESA: "Grupo Altamar",
    EMPRESA_NOTA: "Costa Rica · desde 2011",
    EVENTO: "Cena de Fin de Año",
    ANIO: "2026",
    FECHA_LARGA: "Viernes 11 de diciembre",
    DIA: "11",
    MES: "Diciembre",
    DIA_SEMANA: "Viernes",
    HORA: "6:30 p. m.",
    HORA_NUM: "6:30",
    HORA_SUF: "p. m.",
    LUGAR: "Salón Panorama",
    DIRECCION: "Escazú, San José",
    LINK_MAPS: `https://www.google.com/maps/search/?api=1&query=${COORDENADAS}`,
    LINK_WAZE: `https://waze.com/ul?ll=${COORDENADAS}&navigate=yes`,
    LINK_CALENDARIO: CALENDARIO,

    HITO_1_HORA: "6:30 p. m.",
    HITO_1_TITULO: "Recepción",
    HITO_1_TEXTO:
      "Registro en el lobby y cóctel de bienvenida. Llegá con tiempo: la foto de grupo es a las 7:00 en punto.",
    HITO_2_HORA: "7:15 p. m.",
    HITO_2_TITULO: "Palabras de bienvenida",
    HITO_2_TEXTO:
      "Un repaso corto del año a cargo de la Dirección General, y el brindis que abre la noche.",
    HITO_3_HORA: "8:00 p. m.",
    HITO_3_TITULO: "Cena",
    HITO_3_TEXTO:
      "Servicio a la mesa, tres tiempos. Si tenés alguna restricción alimentaria, indicanosla al confirmar.",
    HITO_4_HORA: "9:30 p. m.",
    HITO_4_TITULO: "Premiación",
    HITO_4_TEXTO:
      "Reconocimientos por trayectoria y a los equipos del año. Son quince minutos que valen la pena.",
    HITO_5_HORA: "10:30 p. m.",
    HITO_5_TITULO: "Música y baile",
    HITO_5_TEXTO:
      "La noche sigue con música en vivo hasta la 1:00 a. m. El salón queda a la orden.",

    CIFRA_1: "15",
    CIFRA_1_LBL: "Años de historia",
    CIFRA_2: "340",
    CIFRA_2_LBL: "Colaboradores",
    CIFRA_3: "6",
    CIFRA_3_LBL: "Sedes en el país",
    CIFRA_4: "1",
    CIFRA_4_LBL: "Noche para celebrarlo",

    VESTIMENTA: "Formal de negocios / cóctel",
    VESTIMENTA_NOTA:
      "Traje oscuro o vestido de cóctel. Sugerimos tonos sobrios —navy, grafito, negro— y un detalle en dorado si te provoca. El salón es fresco de noche: llevá saco o chal.",

    NOTA_PARQUEO:
      "Parqueo techado sin costo: presentá tu tiquete en recepción para la validación. Hay valet desde las 6:00 p. m. y salida directa a la autopista.",

    FECHA_LIMITE: "1 de diciembre",
    NOTA_RSVP:
      "La invitación es para colaboradores y un acompañante. Si necesitás transporte de regreso, contanoslo al confirmar y lo coordinamos.",
  },
};

const html = rellenar(readFileSync(DEMO.plantilla, "utf8"), DEMO.datos);

// Red de seguridad contra un placeholder olvidado. Los comentarios se
// sacan antes: el encabezado de la plantilla DOCUMENTA los placeholders
// ({{HITO_N_HORA}} y compañía) y no son sustituciones pendientes.
const pendientes = html.replace(/<!--[\s\S]*?-->/g, "").match(/\{\{[A-Z0-9_]+\}\}/g);
if (pendientes) {
  console.error(`✗ Quedaron placeholders sin sustituir: ${[...new Set(pendientes)].join(", ")}`);
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
  .select("slug, estado, fecha_evento, hora")
  .eq("slug", DEMO.slug);
console.log("Verificación:", JSON.stringify(data));
