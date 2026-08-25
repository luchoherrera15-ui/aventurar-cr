/**
 * BORRAR NEGOCIOS ENTEROS, CON RED DE SEGURIDAD.
 *
 * ------------------------------------------------------------------
 * SE NIEGA A BORRAR UN NEGOCIO CON RESERVAS
 * ------------------------------------------------------------------
 * Ésa es la razón de existir de este archivo. Un `delete` sobre
 * `ranchos` arrastra 41 tablas en cascada, y entre ellas está el
 * historial de reservas de gente real. Acá eso no puede pasar por
 * descuido: si el negocio tiene aunque sea UNA reserva, el script lo
 * saltea y lo dice, aunque se lo hayan pedido.
 *
 * Para forzarlo hace falta `--con-reservas`, que hay que escribir a
 * mano y a sabiendas. No existe para usarlo: existe para que borrar
 * historial sea una decisión y no un efecto secundario.
 *
 * ------------------------------------------------------------------
 * MIRA ANTES DE BORRAR
 * ------------------------------------------------------------------
 * Sin `--borrar` solo enumera lo que se llevaría. Mismo criterio que
 * `limpiar-lealtad.mjs`: esto corre con la llave de servicio, o sea con
 * la RLS fuera de juego, y un script destructivo que actúa por defecto
 * es un accidente esperando el momento.
 *
 * Uso:
 *   node scripts/borrar-negocios.mjs <id> [<id>…]            ← solo mira
 *   node scripts/borrar-negocios.mjs <id> [<id>…] --borrar   ← borra
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

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

const BORRAR = process.argv.includes("--borrar");
const FORZAR = process.argv.includes("--con-reservas");
const IDS = process.argv.slice(2).filter((a) => /^[0-9a-f-]{36}$/i.test(a));

if (IDS.length === 0) {
  console.error("Uso: node scripts/borrar-negocios.mjs <id> [<id>…] [--borrar]");
  process.exit(2);
}

async function contar(tabla, columna, valor) {
  const { count, error } = await db
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .eq(columna, valor);
  return error ? null : (count ?? 0);
}

console.log("");
const aBorrar = [];

for (const id of IDS) {
  const { data: r } = await db
    .from("ranchos")
    .select("id, nombre, vertical, estado")
    .eq("id", id)
    .maybeSingle();

  if (!r) {
    console.log(`⚠️  ${id} — no existe. Se saltea.`);
    continue;
  }

  const reservas = await contar("reservas", "rancho_id", id);

  console.log(`· ${r.nombre}  [${r.vertical ?? "?"} · ${r.estado ?? "?"}]`);
  console.log(`    ${id}`);
  console.log(`    reservas: ${reservas}`);

  if (reservas > 0 && !FORZAR) {
    console.log(`    ⛔ TIENE RESERVAS — no se borra. (--con-reservas para forzarlo)`);
    continue;
  }
  aBorrar.push(r);
}

console.log(`\n${aBorrar.length} de ${IDS.length} se pueden borrar.`);

if (!BORRAR) {
  console.log(`\n(solo mirando — no se borró nada)\n`);
  process.exit(0);
}

if (aBorrar.length === 0) {
  console.log(`Nada que hacer.\n`);
  process.exit(0);
}

console.log(`\nBORRANDO…`);
for (const r of aBorrar) {
  const { error } = await db.from("ranchos").delete().eq("id", r.id);
  console.log(`  ${r.nombre.padEnd(24)} ${error ? `— ${error.message.slice(0, 70)}` : "✅"}`);
}

// Comprobar de verdad, no confiar en que no hubo error.
const { data: quedan } = await db.from("ranchos").select("id, nombre").in("id", IDS);
console.log(
  `\n${(quedan ?? []).length === 0 ? "✅ No queda ninguno de los pedidos." : `Quedan: ${(quedan ?? []).map((q) => q.nombre).join(", ")}`}\n`,
);
