/**
 * QUÉ HAY EN LA CUENTA, ANTES DE BORRAR NADA.
 *
 * ------------------------------------------------------------------
 * ESTE SCRIPT NO BORRA. SOLO MIRA.
 * ------------------------------------------------------------------
 * Es el paso previo obligatorio a `borrar-negocios-lealtad.mjs`: corre
 * con la llave de servicio (o sea con la RLS fuera de juego) y lo único
 * que hace es enumerar. Sirve para contestar la única pregunta que
 * importa antes de un borrado en producción: ¿qué se va a llevar por
 * delante?
 *
 * Por cada negocio de la cuenta imprime lo que se perdería si se
 * borrara: miembros afiliados, movimientos del ledger, pases emitidos,
 * transacciones con plata, y reservas. Un negocio con miembros y
 * transacciones NO es una prueba: es un cliente con historia.
 *
 * Uso:
 *   node scripts/inventario-lealtad-cuenta.mjs <correo>
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

const CORREO = process.argv[2];
if (!CORREO) {
  console.error("Uso: node scripts/inventario-lealtad-cuenta.mjs <correo>");
  process.exit(2);
}

/** Cuenta filas sin traérselas: `head: true` no transfiere datos. */
async function contar(tabla, columna, valor) {
  const { count, error } = await db
    .from(tabla)
    .select("*", { count: "exact", head: true })
    .eq(columna, valor);
  if (error) return `error: ${error.message}`;
  return count ?? 0;
}

const { data: usuarios, error: errUsuarios } = await db.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (errUsuarios) {
  console.error("No se pudo listar usuarios:", errUsuarios.message);
  process.exit(1);
}

const usuario = usuarios.users.find(
  (u) => (u.email ?? "").toLowerCase() === CORREO.toLowerCase(),
);
if (!usuario) {
  console.error(`No hay ninguna cuenta con el correo ${CORREO}`);
  process.exit(1);
}

console.log(`\nCUENTA: ${usuario.email}`);
console.log(`user_id: ${usuario.id}\n`);

// Los negocios propios y aquellos donde la cuenta colabora — las dos
// vías por las que un negocio aparece en /lealtad/panel.
const { data: propios } = await db
  .from("ranchos")
  .select("id, nombre, vertical, estado, owner_id, created_at")
  .eq("owner_id", usuario.id);

const { data: colabs } = await db
  .from("rancho_colaboradores")
  .select("rancho_id")
  .eq("usuario_id", usuario.id);

const idsColab = (colabs ?? []).map((c) => c.rancho_id);
const { data: comoColab } = idsColab.length
  ? await db
      .from("ranchos")
      .select("id, nombre, vertical, estado, owner_id, created_at")
      .in("id", idsColab)
  : { data: [] };

const todos = [...(propios ?? [])];
for (const r of comoColab ?? []) if (!todos.some((t) => t.id === r.id)) todos.push(r);

if (todos.length === 0) {
  console.log("La cuenta no tiene ningún negocio.\n");
  process.exit(0);
}

console.log(`${todos.length} negocio(s):\n`);

for (const r of todos) {
  const esPropio = r.owner_id === usuario.id;
  const [programa, miembros, pases, transacciones, reservas, solicitudes] =
    await Promise.all([
      db.from("programa_lealtad").select("id").eq("rancho_id", r.id).maybeSingle(),
      contar("miembros", "rancho_id", r.id),
      contar("pases_lealtad", "rancho_id", r.id),
      contar("lealtad_transacciones", "rancho_id", r.id),
      contar("reservas", "rancho_id", r.id),
      contar("solicitudes_lealtad", "rancho_id", r.id),
    ]);

  const ledger = programa.data?.id
    ? await contar("lealtad_ledger", "programa_id", programa.data.id)
    : 0;

  console.log(`──────────────────────────────────────────────────────`);
  console.log(`  ${r.nombre}`);
  console.log(`  id:        ${r.id}`);
  console.log(`  vertical:  ${r.vertical ?? "(sin vertical)"}   estado: ${r.estado ?? "?"}`);
  console.log(`  relación:  ${esPropio ? "DUEÑO" : "colaborador"}`);
  console.log(`  creado:    ${r.created_at}`);
  console.log(`  ── lo que se perdería ──`);
  console.log(`  programa de lealtad:  ${programa.data?.id ? "sí" : "no"}`);
  console.log(`  miembros afiliados:   ${miembros}`);
  console.log(`  movimientos ledger:   ${ledger}`);
  console.log(`  pases emitidos:       ${pases}`);
  console.log(`  transacciones (₡):    ${transacciones}`);
  console.log(`  reservas:             ${reservas}`);
  console.log(`  solicitudes:          ${solicitudes}`);
}
console.log(`──────────────────────────────────────────────────────\n`);
