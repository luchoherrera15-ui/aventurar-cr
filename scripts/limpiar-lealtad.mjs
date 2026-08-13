/**
 * BORRAR EL PROGRAMA DE LEALTAD DE UN NEGOCIO, para volver a empezar.
 *
 * Existe porque probar el módulo de punta a punta pide arrancar de
 * cero: crear la tarjeta, afiliarse, sellar, canjear. Con un programa
 * a medio configurar de una prueba anterior, la mitad de lo que se ve
 * es basura vieja y no se sabe qué se está probando.
 *
 * ------------------------------------------------------------------
 * MIRA ANTES DE BORRAR, Y NO BORRA SIN QUE SE LO PIDAN
 * ------------------------------------------------------------------
 * Sin `--borrar` solo ENUMERA lo que hay. Es a propósito: esto corre
 * contra producción con la llave de servicio, o sea con la RLS fuera
 * de juego, y un script destructivo que actúa por defecto es un
 * accidente esperando el momento.
 *
 * ------------------------------------------------------------------
 * QUÉ NO TOCA
 * ------------------------------------------------------------------
 *   · el negocio (`ranchos`) — sigue existiendo, con su plan;
 *   · las cuentas de los clientes;
 *   · `solicitudes_lealtad` — es el registro de auditoría de cómo se
 *     dio de alta el negocio, y borrarlo reescribiría la historia;
 *   · nada de otro negocio: TODO filtra por el rancho que se le pasa.
 *
 * Uso:
 *   node scripts/limpiar-lealtad.mjs <rancho_id>            ← solo mira
 *   node scripts/limpiar-lealtad.mjs <rancho_id> --borrar   ← borra
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// ── Credenciales ──────────────────────────────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// ── Argumentos ────────────────────────────────────────────────────
const RANCHO = process.argv[2];
const BORRAR = process.argv.includes("--borrar");

if (!RANCHO || !/^[0-9a-f-]{36}$/i.test(RANCHO)) {
  console.error("Uso: node scripts/limpiar-lealtad.mjs <rancho_id> [--borrar]");
  process.exit(2);
}

/** Cuenta filas tolerando que la tabla no exista (migración sin pegar). */
async function contar(tabla, columna, valores) {
  if (Array.isArray(valores) && valores.length === 0) return 0;
  const q = db.from(tabla).select("*", { count: "exact", head: true });
  const { count, error } = Array.isArray(valores)
    ? await q.in(columna, valores)
    : await q.eq(columna, valores);
  if (error) return `— (${error.code})`;
  return count ?? 0;
}

// ── 1. Qué hay ────────────────────────────────────────────────────
const { data: rancho } = await db
  .from("ranchos")
  .select("id, nombre, slug, plan_lealtad")
  .eq("id", RANCHO)
  .maybeSingle();

if (!rancho) {
  console.error("No existe un negocio con ese id. No se tocó nada.");
  process.exit(1);
}

console.log(`\nNEGOCIO: ${rancho.nombre}`);
console.log(`  slug: ${rancho.slug}   plan de lealtad: ${rancho.plan_lealtad ?? "(ninguno)"}\n`);

const { data: programas } = await db.from("programa_lealtad").select("*").eq("rancho_id", RANCHO);

if (!programas || programas.length === 0) {
  console.log("No tiene ningún programa de lealtad. Ya está limpio.");
  process.exit(0);
}

const idsProgramas = programas.map((p) => p.id);
const { data: miembros } = await db.from("miembros").select("id").in("programa_id", idsProgramas);
const idsMiembros = (miembros ?? []).map((m) => m.id);

console.log(`PROGRAMAS: ${programas.length}`);
for (const p of programas) {
  console.log(`  · ${p.nombre}  [${p.modo ?? "sin modo"}]  estado: ${p.estado ?? "—"}  activo: ${p.activo}`);
  console.log(`    ${p.id}`);
}

console.log(`\nLO QUE CUELGA:`);
console.log(`  recompensas            ${await contar("recompensas", "programa_id", idsProgramas)}`);
console.log(`  oferta_bienvenida      ${await contar("oferta_bienvenida", "programa_id", idsProgramas)}`);
console.log(`  miembros               ${idsMiembros.length}`);
console.log(`  transacciones_puntos   ${await contar("transacciones_puntos", "miembro_id", idsMiembros)}`);
console.log(`  canjes                 ${await contar("canjes", "miembro_id", idsMiembros)}`);
console.log(`  intentos_canje         ${await contar("intentos_canje", "miembro_id", idsMiembros)}`);
console.log(`  pases_wallet           ${await contar("pases_wallet", "miembro_id", idsMiembros)}`);

if (!BORRAR) {
  console.log(`\n(solo mirando — nada se borró)`);
  console.log(`Para borrarlo:  node scripts/limpiar-lealtad.mjs ${RANCHO} --borrar\n`);
  process.exit(0);
}

// ── 2. Borrar, de las hojas a la raíz ─────────────────────────────
// El orden importa aunque haya `on delete cascade`: borrar explícito y
// de abajo hacia arriba deja ver CUÁNTO se borró de cada cosa. Un
// cascade silencioso se lleva filas que nadie contó.
console.log(`\nBORRANDO…`);

async function borrar(tabla, columna, valores) {
  if (Array.isArray(valores) && valores.length === 0) return "0 (nada que borrar)";
  const q = db.from(tabla).delete({ count: "exact" });
  const { count, error } = Array.isArray(valores)
    ? await q.in(columna, valores)
    : await q.eq(columna, valores);
  if (error) return `— no se pudo (${error.code}: ${error.message.slice(0, 60)})`;
  return `${count ?? 0}`;
}

// Los pases primero: son lo único que vive fuera (en el teléfono del
// cliente). Borrarlos NO borra la tarjeta del teléfono — esa queda
// huérfana y deja de actualizarse. Para una prueba está bien; con
// clientes reales habría que avisarles.
console.log(`  pases_wallet           ${await borrar("pases_wallet", "miembro_id", idsMiembros)}`);
console.log(`  intentos_canje         ${await borrar("intentos_canje", "miembro_id", idsMiembros)}`);
console.log(`  canjes                 ${await borrar("canjes", "miembro_id", idsMiembros)}`);
console.log(`  transacciones_puntos   ${await borrar("transacciones_puntos", "miembro_id", idsMiembros)}`);
console.log(`  miembros               ${await borrar("miembros", "programa_id", idsProgramas)}`);
console.log(`  oferta_bienvenida      ${await borrar("oferta_bienvenida", "programa_id", idsProgramas)}`);
console.log(`  recompensas            ${await borrar("recompensas", "programa_id", idsProgramas)}`);
console.log(`  programa_lealtad       ${await borrar("programa_lealtad", "rancho_id", RANCHO)}`);

// ── 3. Comprobar que de verdad quedó limpio ───────────────────────
const { data: quedan } = await db
  .from("programa_lealtad")
  .select("id")
  .eq("rancho_id", RANCHO);

console.log(
  `\n${quedan && quedan.length > 0 ? `⚠️  QUEDAN ${quedan.length} programas` : "✅ Limpio: 0 programas"}`,
);
console.log(`El negocio, su plan y sus solicitudes NO se tocaron.\n`);
