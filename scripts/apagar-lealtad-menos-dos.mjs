/**
 * APAGAR EL COMPLEMENTO DE LEALTAD en todos los negocios menos dos.
 *
 * Pedido del dueño (ago 2026): en /admin/complementos dejar operando
 * solo PURA MATCHA y PRAIA. Los demás eran pruebas y demos que se
 * fueron acumulando.
 *
 * ------------------------------------------------------------------
 * APAGA, NO BORRA — y la diferencia es todo
 * ------------------------------------------------------------------
 * Escribe `activo = false` en `addons_negocio`, que es exactamente lo
 * que hace el botón «Desactivar» del panel de admin
 * (`desactivarAddon` en src/app/admin/(dashboard)/complementos/actions.ts).
 * O sea:
 *
 *   · el negocio sigue existiendo, con su plan y su historia;
 *   · sus clientes afiliados, sus pases y su ledger NO se tocan;
 *   · la fila del complemento queda como registro de que alguna vez lo
 *     tuvo, con su fecha y su nota;
 *   · `es_cortesia` NO se limpia: si fue un regalo, lo fue. Quitarle la
 *     marca al apagarlo haría que una auditoría del pasado viera una
 *     venta donde hubo una cortesía.
 *
 * Es REVERSIBLE: volver a poner `activo = true` lo devuelve tal cual.
 *
 * Borrar los negocios habría sido otra cosa —41 tablas en cascada, y
 * Rancho Las Torres y SILENCE BARBER SHOP además están PUBLICADOS en
 * el directorio, o sea que desaparecerían del sitio entero—. No es lo
 * que se pidió.
 *
 * ------------------------------------------------------------------
 * MIRA ANTES DE ACTUAR
 * ------------------------------------------------------------------
 * Sin `--aplicar` solo ENUMERA. Mismo criterio que
 * `scripts/limpiar-lealtad.mjs`: esto corre contra producción con la
 * llave de servicio, con la RLS fuera de juego, y un script que actúa
 * por defecto es un accidente esperando el momento.
 *
 * Uso:
 *   node scripts/apagar-lealtad-menos-dos.mjs             ← solo mira
 *   node scripts/apagar-lealtad-menos-dos.mjs --aplicar   ← apaga
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

const APLICAR = process.argv.includes("--aplicar");

/**
 * Los que SE QUEDAN, por nombre.
 *
 * Se comparan normalizados (sin tildes, sin mayúsculas, sin espacios
 * de más) porque el nombre lo escribió una persona en un formulario:
 * «Pura Matcha», «PURA MATCHA» y «Pura  Matcha» son el mismo negocio.
 */
const SE_QUEDAN = ["pura matcha", "praia"];

const normalizar = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// ── Lo que hay hoy ────────────────────────────────────────────────
const { data: filas, error } = await db
  .from("addons_negocio")
  .select("rancho_id, addon, activo")
  .eq("addon", "lealtad")
  .eq("activo", true);

if (error) {
  console.error("No se pudo leer addons_negocio:", error.message);
  process.exit(1);
}

if (!filas?.length) {
  console.log("No hay ningún negocio con el complemento de lealtad activo. Nada que hacer.");
  process.exit(0);
}

const ids = filas.map((f) => f.rancho_id);
const { data: ranchos, error: errR } = await db
  .from("ranchos")
  .select("id, nombre")
  .in("id", ids);

if (errR) {
  console.error("No se pudo leer ranchos:", errR.message);
  process.exit(1);
}

const nombreDe = new Map((ranchos ?? []).map((r) => [r.id, r.nombre]));

const quedan = [];
const apagar = [];
for (const f of filas) {
  const nombre = nombreDe.get(f.rancho_id) ?? "(negocio sin nombre)";
  (SE_QUEDAN.includes(normalizar(nombre)) ? quedan : apagar).push({
    id: f.rancho_id,
    nombre,
  });
}

// ── El informe ────────────────────────────────────────────────────
console.log(`\nCon lealtad ACTIVA hoy: ${filas.length}\n`);

console.log("SE QUEDAN:");
for (const n of quedan) console.log(`  ✅ ${n.nombre}`);
if (!quedan.length) console.log("  (ninguno — revisá los nombres antes de seguir)");

console.log("\nSE APAGAN:");
for (const n of apagar) console.log(`  ⭕ ${n.nombre}`);
if (!apagar.length) console.log("  (ninguno)");

/**
 * LA GUARDA QUE IMPORTA: si los dos que se quedan no aparecieron, algo
 * está mal —un nombre distinto en la base, un negocio que ya estaba
 * apagado— y seguir apagaría el módulo entero. Se frena.
 */
if (quedan.length !== SE_QUEDAN.length) {
  console.error(
    `\n⛔ Se esperaban ${SE_QUEDAN.length} negocios en la lista de los que se quedan y aparecieron ${quedan.length}.` +
      `\n   No se apaga nada. Revisá los nombres contra la base antes de volver a correrlo.`,
  );
  process.exit(3);
}

if (!APLICAR) {
  console.log("\n(Solo mirando. Para aplicarlo: node scripts/apagar-lealtad-menos-dos.mjs --aplicar)");
  process.exit(0);
}

// ── Aplicar ───────────────────────────────────────────────────────
if (!apagar.length) {
  console.log("\nNada que apagar.");
  process.exit(0);
}

const { error: errU } = await db
  .from("addons_negocio")
  .update({ activo: false })
  .eq("addon", "lealtad")
  .in(
    "rancho_id",
    apagar.map((n) => n.id),
  );

if (errU) {
  console.error("\nNo se pudo apagar:", errU.message);
  process.exit(1);
}

console.log(`\n✅ Apagados ${apagar.length}. Quedan operando: ${quedan.map((n) => n.nombre).join(", ")}.`);
console.log("   Es reversible: `activo = true` en addons_negocio lo devuelve.");
