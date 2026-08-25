/**
 * DEJAR EL PANEL DE /lealtad DE UNA CUENTA COMPLETAMENTE VACÍO —
 * SIN BORRAR NI UN SOLO NEGOCIO.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE, Y POR QUÉ NO BORRA NEGOCIOS
 * ------------------------------------------------------------------
 * El pedido fue «eliminame todos los negocios de /lealtad, no me dejes
 * ninguno». El inventario mostró que dos de esos negocios NO son
 * pruebas: Rancho Las Torres tiene 40 reservas (y ni siquiera tiene
 * programa de lealtad — aparece en el panel porque el panel lista todos
 * tus negocios para que les puedas agregar uno) y SILENCE BARBER SHOP
 * tiene 73. Borrarlos habría destruido 113 reservas reales en cascada
 * por 41 tablas, sin vuelta atrás.
 *
 * Así que esto borra LO DE LEALTAD, que es lo que llena el panel, y no
 * toca los negocios. Confirmado con el dueño antes de correrlo.
 *
 * ------------------------------------------------------------------
 * QUÉ BORRA (todo lo que hace aparecer una tarjeta en el panel)
 * ------------------------------------------------------------------
 *   · programa_lealtad y todo lo que le cuelga: recompensas,
 *     oferta_bienvenida, miembros, transacciones_puntos, canjes,
 *     intentos_canje y pases_wallet;
 *   · lealtad_transacciones (el impacto comercial en colones);
 *   · solicitudes_lealtad — incluidas las PENDIENTES, que son las que
 *     pintan la tarjeta «TRÁMITE EN CURSO» aunque todavía no exista el
 *     negocio;
 *   · addons_negocio del addon `lealtad`;
 *   · ranchos.plan_lealtad → null.
 *
 * ⚠️ LO DE `solicitudes_lealtad` ES UNA CONCESIÓN, NO UN DESCUIDO.
 * `limpiar-lealtad.mjs` a propósito NO las toca: son el registro de
 * auditoría de cómo se dio de alta cada negocio, y borrarlas reescribe
 * esa historia. Acá SÍ se borran porque son justamente lo que deja
 * tarjetas en el panel, y el pedido era dejarlo vacío. Para una cuenta
 * de pruebas del dueño es correcto; NO corras esto contra la cuenta de
 * un cliente real sin entender que se pierde ese rastro.
 *
 * ------------------------------------------------------------------
 * QUÉ NO TOCA
 * ------------------------------------------------------------------
 *   · los negocios (`ranchos`) — siguen enteros, con sus fotos, su
 *     agenda y su ficha pública;
 *   · las RESERVAS — ni una;
 *   · los otros addons (agenda_ia, asistente_ia): son otro producto;
 *   · nada de ninguna otra cuenta: todo filtra por los negocios de esta.
 *
 * Uso:
 *   node scripts/vaciar-panel-lealtad.mjs <correo>            ← solo mira
 *   node scripts/vaciar-panel-lealtad.mjs <correo> --borrar   ← borra
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
const BORRAR = process.argv.includes("--borrar");
if (!CORREO) {
  console.error("Uso: node scripts/vaciar-panel-lealtad.mjs <correo> [--borrar]");
  process.exit(2);
}

/** Borra tolerando que la tabla no exista, y dice cuántas filas se fue. */
async function borrar(tabla, columna, valores) {
  if (Array.isArray(valores) && valores.length === 0) return "0 (nada que borrar)";
  const q = db.from(tabla).delete({ count: "exact" });
  const { count, error } = Array.isArray(valores)
    ? await q.in(columna, valores)
    : await q.eq(columna, valores);
  if (error) return `— no se pudo (${error.code}: ${error.message.slice(0, 70)})`;
  return `${count ?? 0}`;
}

// ── Quién es ──────────────────────────────────────────────────────
const { data: usuarios, error: errU } = await db.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (errU) {
  console.error("No se pudo listar usuarios:", errU.message);
  process.exit(1);
}
const usuario = usuarios.users.find(
  (u) => (u.email ?? "").toLowerCase() === CORREO.toLowerCase(),
);
if (!usuario) {
  console.error(`No hay ninguna cuenta con el correo ${CORREO}`);
  process.exit(1);
}

// ── Sus negocios ──────────────────────────────────────────────────
const { data: propios } = await db
  .from("ranchos")
  .select("id, nombre, plan_lealtad")
  .eq("owner_id", usuario.id);
const { data: colabs } = await db
  .from("rancho_colaboradores")
  .select("rancho_id")
  .eq("usuario_id", usuario.id);
const idsColab = (colabs ?? []).map((c) => c.rancho_id);
const { data: comoColab } = idsColab.length
  ? await db.from("ranchos").select("id, nombre, plan_lealtad").in("id", idsColab)
  : { data: [] };

const negocios = [...(propios ?? [])];
for (const r of comoColab ?? []) if (!negocios.some((t) => t.id === r.id)) negocios.push(r);
const idsRanchos = negocios.map((r) => r.id);

console.log(`\nCUENTA: ${usuario.email}`);
console.log(`Negocios: ${negocios.length} — NINGUNO se va a borrar.\n`);
for (const r of negocios) console.log(`  · ${r.nombre}`);

// ── Lo que cuelga de lealtad ──────────────────────────────────────
const { data: programas } = await db
  .from("programa_lealtad")
  .select("id, nombre, rancho_id")
  .in("rancho_id", idsRanchos);
const idsProgramas = (programas ?? []).map((p) => p.id);

const { data: miembros } = idsProgramas.length
  ? await db.from("miembros").select("id").in("programa_id", idsProgramas)
  : { data: [] };
const idsMiembros = (miembros ?? []).map((m) => m.id);

// Las solicitudes van por SOLICITANTE y no por rancho: la tarjeta
// «trámite en curso» del panel es una solicitud que todavía NO tiene
// negocio creado, así que filtrar por rancho_id se la dejaría puesta.
const { data: solicitudes } = await db
  .from("solicitudes_lealtad")
  .select("id, negocio_nombre, estado")
  .eq("solicitante_id", usuario.id);

console.log(`\nLO QUE SE VA A BORRAR:`);
console.log(`  programas de lealtad   ${idsProgramas.length}`);
console.log(`  miembros afiliados     ${idsMiembros.length}`);
console.log(`  solicitudes            ${(solicitudes ?? []).length}`);
for (const s of solicitudes ?? []) {
  console.log(`     · ${s.negocio_nombre ?? "(sin nombre)"} — ${s.estado}`);
}

if (!BORRAR) {
  console.log(`\n(solo mirando — no se borró nada)`);
  console.log(`Para borrar:  node scripts/vaciar-panel-lealtad.mjs ${CORREO} --borrar\n`);
  process.exit(0);
}

// ── Borrar, de las hojas a la raíz ────────────────────────────────
// Explícito y de abajo hacia arriba aunque haya `on delete cascade`:
// así se ve CUÁNTO se fue de cada cosa. Un cascade silencioso se lleva
// filas que nadie contó.
console.log(`\nBORRANDO…`);
console.log(`  pases_wallet           ${await borrar("pases_wallet", "miembro_id", idsMiembros)}`);
console.log(`  intentos_canje         ${await borrar("intentos_canje", "miembro_id", idsMiembros)}`);
console.log(`  canjes                 ${await borrar("canjes", "miembro_id", idsMiembros)}`);
console.log(`  transacciones_puntos   ${await borrar("transacciones_puntos", "miembro_id", idsMiembros)}`);
console.log(`  miembros               ${await borrar("miembros", "programa_id", idsProgramas)}`);
console.log(`  oferta_bienvenida      ${await borrar("oferta_bienvenida", "programa_id", idsProgramas)}`);
console.log(`  recompensas            ${await borrar("recompensas", "programa_id", idsProgramas)}`);
console.log(`  lealtad_transacciones  ${await borrar("lealtad_transacciones", "rancho_id", idsRanchos)}`);
console.log(`  programa_lealtad       ${await borrar("programa_lealtad", "rancho_id", idsRanchos)}`);
console.log(`  solicitudes_lealtad    ${await borrar("solicitudes_lealtad", "solicitante_id", usuario.id)}`);

// El addon de lealtad, y SOLO el de lealtad: `agenda_ia` y
// `asistente_ia` son otro producto y no tienen nada que ver acá.
const { count: addonsFuera, error: errAddon } = await db
  .from("addons_negocio")
  .delete({ count: "exact" })
  .in("rancho_id", idsRanchos)
  .eq("addon", "lealtad");
console.log(
  `  addons_negocio(lealtad) ${errAddon ? `— ${errAddon.message.slice(0, 60)}` : (addonsFuera ?? 0)}`,
);

// El plan queda en null: mientras diga «prueba», el panel sigue
// mostrando el negocio como si tuviera lealtad contratada.
const { count: planesFuera, error: errPlan } = await db
  .from("ranchos")
  .update({ plan_lealtad: null }, { count: "exact" })
  .in("id", idsRanchos)
  .not("plan_lealtad", "is", null);
console.log(
  `  plan_lealtad → null    ${errPlan ? `— ${errPlan.message.slice(0, 60)}` : (planesFuera ?? 0)}`,
);

// ── Comprobar ─────────────────────────────────────────────────────
const [{ data: quedanProg }, { data: quedanSol }, { data: quedanNeg }] = await Promise.all([
  db.from("programa_lealtad").select("id").in("rancho_id", idsRanchos),
  db.from("solicitudes_lealtad").select("id").eq("solicitante_id", usuario.id),
  db.from("ranchos").select("id").in("id", idsRanchos),
]);

const limpio = (quedanProg ?? []).length === 0 && (quedanSol ?? []).length === 0;
console.log(
  `\n${limpio ? "✅ El panel de /lealtad quedó vacío." : `⚠️ Quedan ${(quedanProg ?? []).length} programas y ${(quedanSol ?? []).length} solicitudes`}`,
);
console.log(`✅ Negocios intactos: ${(quedanNeg ?? []).length} de ${negocios.length}`);

// La comprobación que de verdad importa: que las reservas sigan ahí.
const { count: reservas } = await db
  .from("reservas")
  .select("*", { count: "exact", head: true })
  .in("rancho_id", idsRanchos);
console.log(`✅ Reservas intactas: ${reservas ?? 0}\n`);
