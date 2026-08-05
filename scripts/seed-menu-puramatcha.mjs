/**
 * Siembra el MENÚ de PuraMatcha Bar en `rancho_items`.
 *
 * Los precios son SEMILLA (al azar, del orden correcto para una barra
 * de matcha en Costa Rica): están para que el menú se vea completo y
 * el dueño los corrija desde su panel → Catálogo. Lo mismo las fotos:
 * cada ítem queda listo con su `grupo` y su descripción; la foto se
 * sube desde el mismo panel (bucket `ranchos-fotos`).
 *
 * Es seguro correrlo varias veces: hace upsert por (rancho_id, nombre)
 * — si el ítem ya existe se actualiza, no se duplica.
 *
 *   node scripts/seed-menu-puramatcha.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SLUG = "puramatchabar";

/** El menú, en el orden en que se quiere leer en la página. */
const MENU = [
  // ---------- Matcha ----------
  {
    grupo: "Matcha",
    nombre: "Matcha Latte Caliente",
    descripcion: "Matcha ceremonial batido a mano con leche vaporizada y arte en la espuma.",
    precio: 5500,
  },
  {
    grupo: "Matcha",
    nombre: "Matcha Latte Frío",
    descripcion: "Nuestro clásico sobre hielo: capa de leche fría y matcha recién batido encima.",
    precio: 5900,
  },
  {
    grupo: "Matcha",
    nombre: "Matcha Tonic",
    descripcion: "Matcha con agua tónica y mucho hielo — burbujeante y refrescante.",
    precio: 6200,
  },
  {
    grupo: "Matcha",
    nombre: "Matcha para Llevar",
    descripcion: "El mismo matcha latte de siempre, en vaso para llevar.",
    precio: 5500,
  },

  // ---------- Café y té ----------
  {
    grupo: "Café y té",
    nombre: "Cappuccino",
    descripcion: "Espresso de grano costarricense con leche texturizada y arte latte.",
    precio: 4200,
  },
  {
    grupo: "Café y té",
    nombre: "Té Frío de Naranja",
    descripcion: "Té negro frío con naranja fresca y hielo.",
    precio: 4500,
  },

  // ---------- Panadería ----------
  {
    grupo: "Panadería",
    nombre: "Croissant de Mantequilla",
    descripcion: "Hojaldre horneado del día, crocante por fuera y suave por dentro.",
    precio: 2800,
  },
  {
    grupo: "Panadería",
    nombre: "Croissant de Jamón y Queso",
    descripcion: "Croissant relleno de jamón, queso, tomate y rúcula fresca.",
    precio: 4900,
  },
  {
    grupo: "Panadería",
    nombre: "Croissant de Fresa, Banano y Chocolate",
    descripcion: "Croissant con chocolate, fresas y banano en rodajas.",
    precio: 5200,
  },
  {
    grupo: "Panadería",
    nombre: "Pain au Chocolat",
    descripcion: "Hojaldre relleno de chocolate semiamargo.",
    precio: 3400,
  },
  {
    grupo: "Panadería",
    nombre: "Cinnamon Roll",
    descripcion: "Rollo de canela tibio con glaseado de queso crema.",
    precio: 3900,
  },
];

async function main() {
  const { data: rancho, error: errorRancho } = await db
    .from("ranchos")
    .select("id, nombre")
    .eq("slug", SLUG)
    .maybeSingle();

  if (errorRancho || !rancho) {
    console.error("No encontré el negocio con slug", SLUG, errorRancho?.message ?? "");
    process.exit(1);
  }

  const { data: existentes } = await db
    .from("rancho_items")
    .select("id, nombre")
    .eq("rancho_id", rancho.id);

  const idPorNombre = new Map((existentes ?? []).map((i) => [i.nombre, i.id]));

  let creados = 0;
  let actualizados = 0;

  for (const [i, item] of MENU.entries()) {
    const fila = {
      rancho_id: rancho.id,
      nombre: item.nombre,
      descripcion: item.descripcion,
      precio: item.precio,
      unidad: "por unidad",
      grupo: item.grupo,
      tipo: "producto",
      activo: true,
      orden: i + 1,
    };

    const idExistente = idPorNombre.get(item.nombre);
    const { error } = idExistente
      ? await db.from("rancho_items").update(fila).eq("id", idExistente)
      : await db.from("rancho_items").insert(fila);

    if (error) {
      console.error("✗", item.nombre, error.message);
      continue;
    }
    if (idExistente) actualizados++;
    else creados++;
  }

  // El combo que ya existía queda al final del menú, en su propio grupo.
  const combo = (existentes ?? []).find((i) => i.nombre === "Combo Matcha #1");
  if (combo) {
    await db
      .from("rancho_items")
      .update({ grupo: "Combos", orden: MENU.length + 1 })
      .eq("id", combo.id);
  }

  console.log(`${rancho.nombre}: ${creados} creados, ${actualizados} actualizados.`);
}

main();
