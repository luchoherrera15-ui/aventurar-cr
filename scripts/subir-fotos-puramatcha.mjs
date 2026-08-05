/**
 * Sube las fotos del menú de PuraMatcha Bar al bucket `ranchos-fotos`
 * y las liga a su producto, y de paso corrige los datos que venían
 * copiados del molde de un LUGAR (rancho) — PuraMatcha no alquila un
 * salón: es una barra de matcha que se monta en el evento del cliente.
 *
 * Las fotos se leen de ./puramatcha (fuera del control de versiones).
 * Es seguro correrlo varias veces: sube con upsert y actualiza la fila.
 *
 *   node scripts/subir-fotos-puramatcha.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SLUG = "puramatchabar";
const CARPETA = "puramatcha";

/** Qué foto es cada producto (mirando una por una). */
const FOTOS = {
  "Matcha Latte Caliente": "PHOTO-2026-08-05-07-54-23.jpg",
  "Matcha Latte Frío": "PHOTO-2026-08-05-07-54-53_1.jpg",
  "Matcha Tonic": "PHOTO-2026-08-05-07-54-52_1.jpg",
  "Matcha para Llevar": "PHOTO-2026-08-05-07-54-53.jpg",
  Cappuccino: "PHOTO-2026-08-05-07-54-52.jpg",
  "Té Frío de Naranja": "PHOTO-2026-08-05-07-54-53_3.jpg",
  "Croissant de Mantequilla": "PHOTO-2026-08-05-07-54-52_4.jpg",
  "Croissant de Jamón y Queso": "PHOTO-2026-08-05-07-54-52_2.jpg",
  "Croissant de Fresa, Banano y Chocolate": "PHOTO-2026-08-05-07-54-52_3.jpg",
  "Pain au Chocolat": "PHOTO-2026-08-05-07-54-53_2.jpg",
  "Cinnamon Roll": "PHOTO-2026-08-05-07-54-53_4.jpg",
  // La foto real de la barra montada: el combo es lo que más se pide.
  "Combo Matcha #1": "PHOTO-2026-08-05-07-54-43.jpg",
};

/**
 * Lo que venía del molde de un LUGAR y no aplica a una barra móvil:
 *
 *  - `anticipacion_dias` estaba en 25 000 (unos 68 años): el calendario
 *    salía entero en gris y era imposible reservar. Una barra necesita
 *    unos días para organizarse, no siete décadas.
 *  - `deposito_reserva` era ₡25 000, el adelanto típico para apartar un
 *    salón entero. Para una barra el adelanto va acorde a su propio
 *    mínimo de contratación.
 *  - `eventos_por_dia` en null dejaba el día libre para siempre; una
 *    barra sí puede atender más de un evento por día, pero no infinitos.
 */
const AJUSTES_BARRA = {
  deposito_reserva: 15000,
  eventos_por_dia: 2,
};
const ANTICIPACION_DIAS = 3;

async function main() {
  const { data: rancho } = await db
    .from("ranchos")
    .select("id, nombre, detalles")
    .eq("slug", SLUG)
    .maybeSingle();

  if (!rancho) {
    console.error("No encontré el negocio", SLUG);
    process.exit(1);
  }

  const { data: items } = await db
    .from("rancho_items")
    .select("id, nombre")
    .eq("rancho_id", rancho.id);

  let subidas = 0;
  for (const [nombreItem, archivo] of Object.entries(FOTOS)) {
    const item = (items ?? []).find((i) => i.nombre === nombreItem);
    if (!item) {
      console.warn("· sin producto para", nombreItem);
      continue;
    }

    const binario = readFileSync(join(CARPETA, archivo));
    // Misma convención que el panel del dueño: {ranchoId}/catalogo/...
    const ruta = `${rancho.id}/catalogo/${item.id}${extname(archivo).toLowerCase()}`;

    const { error: errorSubida } = await db.storage
      .from("ranchos-fotos")
      .upload(ruta, binario, { contentType: "image/jpeg", upsert: true });
    if (errorSubida) {
      console.error("✗", basename(archivo), errorSubida.message);
      continue;
    }

    const { data: publica } = db.storage.from("ranchos-fotos").getPublicUrl(ruta);
    const { error } = await db
      .from("rancho_items")
      .update({ foto_url: publica.publicUrl })
      .eq("id", item.id);

    if (error) console.error("✗", nombreItem, error.message);
    else subidas++;
  }

  // Los datos del negocio, ya como barra móvil y no como salón.
  const detalles = { ...(rancho.detalles ?? {}), anticipacion_dias: ANTICIPACION_DIAS };
  const { error: errorRancho } = await db
    .from("ranchos")
    .update({ ...AJUSTES_BARRA, detalles })
    .eq("id", rancho.id);

  console.log(
    `${rancho.nombre}: ${subidas} fotos ligadas.`,
    errorRancho ? "Error al ajustar el negocio: " + errorRancho.message : "Datos de barra ajustados.",
  );
}

main();
