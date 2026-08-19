/**
 * SIEMBRA: el PROGRAMA DE LEALTAD de Silence Barber Shop.
 *
 *   node scripts/seed-lealtad-silence-barber.mjs           ← siembra o actualiza
 *   node scripts/seed-lealtad-silence-barber.mjs --borrar  ← lo quita
 *
 * ------------------------------------------------------------------
 * QUÉ SIEMBRA Y POR QUÉ ASÍ
 * ------------------------------------------------------------------
 * Una tarjeta de SELLOS con la promo que pidió el dueño, textual:
 * «Acumulá 10 sellos y llevate un corte gratis». Eso son DOS filas,
 * no una:
 *
 *   · `programa_lealtad` — el programa en sí (nombre, modo, colores).
 *   · `recompensas`      — la regalía, con `costo_puntos = 10`.
 *
 * La META de la tarjeta sale de la recompensa activa MÁS BARATA, no
 * del programa: es de donde la saca el pase real del teléfono
 * (`metaDeSellos`) y es de donde la lee la pestaña Promos del app. Si
 * se sembrara solo el programa, la promo aparecería sin número.
 *
 * ------------------------------------------------------------------
 * NO ES DATO DE MENTIRA, PERO SÍ ES SEMBRADO
 * ------------------------------------------------------------------
 * Silence Barber Shop es un negocio real del directorio, así que el
 * programa NO se marca como demo — un `detalles.demo` acá haría que la
 * limpieza de datos de prueba se llevara la tarjeta de un cliente. Lo
 * que sí queda es este archivo: si mañana hay que saber de dónde salió
 * esta promo, está escrito acá.
 *
 * Es idempotente: se puede correr dos veces. Si el programa ya existe
 * se actualiza en su sitio (nunca se recrea — su `id` es la llave de
 * los pases que ya estén en teléfonos de clientes).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// ── Las llaves, del .env.local ──────────────────────────────────────
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const BORRAR = process.argv.includes("--borrar");

/** Cómo se llama el negocio en la base — se busca por nombre porque el
 *  slug puede haber cambiado. */
const NOMBRE_NEGOCIO = "SILENCE BARBER SHOP";

const PROGRAMA = {
  nombre: "Programa de lealtad",
  puntos_por_visita: 1,
  puntos_por_colon: 0,
  activo: true,
};

const RECOMPENSA = {
  nombre: "Un corte gratis",
  descripcion: "Acumulá 10 sellos —uno por visita— y el corte va por la casa.",
  costo_puntos: 10,
  orden: 0,
  activo: true,
};

// ── 1. El negocio ───────────────────────────────────────────────────
const { data: negocio, error: eNegocio } = await db
  .from("ranchos")
  .select("id, nombre, estado")
  .ilike("nombre", NOMBRE_NEGOCIO)
  .maybeSingle();

if (eNegocio) {
  console.error("No se pudo buscar el negocio:", eNegocio.message);
  process.exit(1);
}
if (!negocio) {
  console.error(`No existe ningún negocio llamado "${NOMBRE_NEGOCIO}".`);
  process.exit(1);
}
console.log(`Negocio: ${negocio.nombre} (${negocio.id}) — estado ${negocio.estado}`);

// ── 2. ¿Ya tiene programa? ──────────────────────────────────────────
const { data: existente } = await db
  .from("programa_lealtad")
  .select("id")
  .eq("rancho_id", negocio.id)
  .maybeSingle();

if (BORRAR) {
  if (!existente) {
    console.log("No tenía programa. Nada que borrar.");
    process.exit(0);
  }
  // `recompensas` cae sola por el `on delete cascade` de la 0060.
  const { error } = await db.from("programa_lealtad").delete().eq("id", existente.id);
  if (error) {
    console.error("No se pudo borrar:", error.message);
    process.exit(1);
  }
  console.log("Programa borrado (y sus recompensas con él).");
  process.exit(0);
}

// ── 3. Crear o actualizar el programa ───────────────────────────────
let programaId;
if (existente) {
  const { error } = await db
    .from("programa_lealtad")
    .update(PROGRAMA)
    .eq("id", existente.id);
  if (error) {
    console.error("No se pudo actualizar el programa:", error.message);
    process.exit(1);
  }
  programaId = existente.id;
  console.log("Programa actualizado (se conservó su id: los pases ya emitidos siguen valiendo).");
} else {
  const { data, error } = await db
    .from("programa_lealtad")
    .insert({ rancho_id: negocio.id, ...PROGRAMA })
    .select("id")
    .single();
  if (error) {
    console.error("No se pudo crear el programa:", error.message);
    process.exit(1);
  }
  programaId = data.id;
  console.log("Programa creado.");
}

// ── 4. La regalía ───────────────────────────────────────────────────
// Se busca por nombre para no duplicarla en cada corrida.
const { data: premioExistente } = await db
  .from("recompensas")
  .select("id")
  .eq("programa_id", programaId)
  .eq("nombre", RECOMPENSA.nombre)
  .maybeSingle();

if (premioExistente) {
  const { error } = await db
    .from("recompensas")
    .update(RECOMPENSA)
    .eq("id", premioExistente.id);
  if (error) {
    console.error("No se pudo actualizar la regalía:", error.message);
    process.exit(1);
  }
  console.log("Regalía actualizada.");
} else {
  const { error } = await db
    .from("recompensas")
    .insert({ programa_id: programaId, ...RECOMPENSA });
  if (error) {
    console.error("No se pudo crear la regalía:", error.message);
    process.exit(1);
  }
  console.log("Regalía creada.");
}

console.log(
  `\nListo. En la pestaña Promos del app va a salir:\n` +
    `  ${negocio.nombre} — «Acumulá ${RECOMPENSA.costo_puntos} sellos y llevate ${RECOMPENSA.nombre.toLowerCase()}»\n` +
    `  y al tocarla abre /rancho/${negocio.id}.`,
);
