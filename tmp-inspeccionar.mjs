/** Solo lectura: lista los negocios de la vertical eventos y marca cuáles lucen demo. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const raiz = "c:/Users/luis h/aventurar-cr";
const env = {};
for (const linea of readFileSync(path.join(raiz, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await db
  .from("ranchos")
  .select("id, slug, nombre, categoria, subcategoria, vertical, estado, owner_id, detalles, creado_en")
  .order("vertical")
  .order("categoria");
if (error) throw new Error(error.message);

// Dueños
const owners = [...new Set(data.map((r) => r.owner_id).filter(Boolean))];
const { data: perfiles } = await db.from("perfiles").select("id, correo, nombre, rol").in("id", owners);
const porId = new Map((perfiles || []).map((p) => [p.id, p]));

const porVertical = {};
for (const r of data) (porVertical[r.vertical || "(null)"] ||= []).push(r);

console.log("=== TODAS LAS VERTICALES ===");
for (const [v, filas] of Object.entries(porVertical)) console.log(`  ${v}: ${filas.length}`);

const eventos = porVertical["eventos"] || [];
console.log(`\n=== VERTICAL EVENTOS (${eventos.length}) ===`);
for (const r of eventos) {
  const demoFlag = r.detalles && r.detalles.demo === true;
  const slugDemo = (r.slug || "").startsWith("demo-");
  const p = porId.get(r.owner_id);
  const correo = p ? p.correo : "(sin perfil)";
  const marca = demoFlag || slugDemo ? "DEMO" : "real";
  console.log(
    `  [${marca}] ${r.slug}\n        nombre="${r.nombre}" cat=${r.categoria}/${r.subcategoria} estado=${r.estado} owner=${correo} demoFlag=${demoFlag} creado=${r.creado_en}`,
  );
}

// Conteos de dependencias para los demo de eventos
const idsDemo = eventos.filter((r) => r.detalles?.demo === true || (r.slug || "").startsWith("demo-")).map((r) => r.id);
console.log(`\n=== Dependencias de los ${idsDemo.length} demo de eventos ===`);
for (const tabla of ["rancho_items", "reservas", "favoritos", "resenas", "conversaciones", "precios", "espacios", "albumes", "bloqueos"]) {
  const { count, error: e } = await db.from(tabla).select("id", { count: "exact", head: true }).in("rancho_id", idsDemo);
  if (e) console.log(`  ${tabla}: (no aplica — ${e.message.slice(0, 60)})`);
  else console.log(`  ${tabla}: ${count}`);
}

// Cuentas demo en perfiles
const { data: cuentasDemo } = await db.from("perfiles").select("id, correo, nombre, rol").like("correo", "%demo@bookea.lat");
console.log("\n=== Cuentas *.demo@bookea.lat ===");
for (const c of cuentasDemo || []) console.log(`  ${c.correo} (${c.rol}) ${c.id}`);
