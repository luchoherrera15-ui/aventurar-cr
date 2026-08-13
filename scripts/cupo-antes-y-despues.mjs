/**
 * ¿A QUIÉN LE CAMBIA EL CUPO CUANDO SE PEGUE LA 0142?
 *
 * El tope de clientes se contaba mal de tres formas (ver la cabecera de
 * `supabase/migrations/0142_cupo_por_cuenta.sql`), y al arreglarlo los
 * números SE MUEVEN EN LAS DOS DIRECCIONES:
 *
 *   · BAJAN donde haya miembros pausados o cancelados — antes contaban,
 *     y el tipo promete «pases vigentes»;
 *   · SUBEN donde el negocio tenga VARIAS tarjetas — antes cada tarjeta
 *     tenía su propio cupo, así que un paquete de 200 con dos tarjetas
 *     afiliaba 400.
 *
 * Un negocio con 300 clientes repartidos en dos tarjetas de un paquete
 * de 200 pasa a estar LLENO de golpe, sin haber hecho nada. Esto lo
 * dice antes de pegar la migración, no después.
 *
 * NO ESCRIBE NADA. Solo lee y arma la tabla.
 *
 * Uso:  node scripts/cupo-antes-y-despues.mjs
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

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Los topes salen de planes.ts, no de una copia ──────────────────
// Un segundo catálogo escrito a mano acá se desincronizaría con el
// primer cambio de precio, y este script existe justo para decidir con
// números ciertos. Se lee el archivo y se saca el tope de cada plan.
const FUENTE = fs.readFileSync("src/lib/lealtad/planes.ts", "utf8");

function topeDe(plan) {
  if (!plan) return undefined;
  const bloque = FUENTE.match(new RegExp(`\\n  ${plan}: \\{([\\s\\S]*?)\\n  \\},`));
  if (!bloque) return undefined;
  const m = bloque[1].match(/clientesActivos:\s*([0-9_]+|null)/);
  // Los paquetes RETIRADOS llevan `limites: SIN_TOPES` de una pieza, sin
  // escribir el campo: no se le baja el tope a quien ya pagó.
  if (!m) return /limites:\s*SIN_TOPES/.test(bloque[1]) ? null : undefined;
  return m[1] === "null" ? null : Number(m[1].replace(/_/g, ""));
}

/** Trae una tabla entera, de a 1.000 filas (el corte de PostgREST). */
async function todo(tabla, columnas) {
  const filas = [];
  for (let pagina = 0; pagina < 200; pagina++) {
    const desde = pagina * 1000;
    const { data, error } = await db
      .from(tabla)
      .select(columnas)
      .range(desde, desde + 999);
    if (error) {
      if (pagina === 0) return { filas: [], error };
      break;
    }
    filas.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return { filas, error: null };
}

// ── Lo que hace falta ──────────────────────────────────────────────
const { filas: ranchos, error: eRanchos } = await todo("ranchos", "id, nombre, plan_lealtad");
if (eRanchos) {
  console.error("No se pudieron leer los negocios:", eRanchos.message);
  process.exit(1);
}

// `select *` en programa_lealtad: `cuenta_id` es de la 0134 y pedirla
// por nombre rompería la consulta entera en una base sin migrar.
const { filas: programas, error: eProgramas } = await todo("programa_lealtad", "*");
if (eProgramas) {
  console.error("No se pudo leer programa_lealtad:", eProgramas.message);
  process.exit(1);
}

// Ídem con `persona_id` (0138): si no está, no se puede deduplicar y se
// dice en el informe en vez de mentir con un número.
let hayPersona = true;
let { filas: miembros, error: eMiembros } = await todo("miembros", "id, programa_id, persona_id, estado");
if (eMiembros) {
  hayPersona = false;
  ({ filas: miembros, error: eMiembros } = await todo("miembros", "id, programa_id, estado"));
  if (eMiembros) {
    console.error("No se pudieron leer los miembros:", eMiembros.message);
    process.exit(1);
  }
}

// El plan efectivo sale de `cuentas` desde la 0134, con el del rancho de
// respaldo. Si la tabla no existe, se usa el del rancho y ya.
const { filas: cuentas } = await todo("cuentas", "id, rancho_id, plan");
const planDeCuenta = new Map();
const cuentaDeRancho = new Map();
for (const c of cuentas) {
  planDeCuenta.set(c.id, c.plan ?? null);
  cuentaDeRancho.set(c.rancho_id, c.id);
}

// ── Las cuentas ────────────────────────────────────────────────────
const porPrograma = new Map(); // programa_id → { filas, activasPorPersona:Set }
for (const p of programas) {
  porPrograma.set(p.id, { filas: 0, personas: new Set() });
}
for (const m of miembros) {
  const bolsa = porPrograma.get(m.programa_id);
  if (!bolsa) continue;
  bolsa.filas += 1; // lo que contaba el código viejo: TODOS los estados
  if (m.estado === "activa") bolsa.personas.add(m.persona_id ?? m.id);
}

const programasDelRancho = new Map();
for (const p of programas) {
  if (!programasDelRancho.has(p.rancho_id)) programasDelRancho.set(p.rancho_id, []);
  programasDelRancho.get(p.rancho_id).push(p);
}

const nombreDeRancho = new Map(ranchos.map((r) => [r.id, r.nombre]));
const planDeRancho = new Map(ranchos.map((r) => [r.id, r.plan_lealtad ?? null]));

const filas = [];
for (const [ranchoId, suyos] of programasDelRancho) {
  const cuentaId = cuentaDeRancho.get(ranchoId);
  // Mismo orden que `planEfectivo()`: manda la cuenta, respalda el rancho.
  const plan = (cuentaId ? planDeCuenta.get(cuentaId) : null) ?? planDeRancho.get(ranchoId) ?? null;

  // EL VIEJO: el count por `programa_id` que hacían generar.ts y
  // google.ts. Lo que la puerta comparaba con el tope era el de LA
  // tarjeta que el cliente estaba agregando, así que el número que
  // decidía era el mayor de las tarjetas del negocio.
  const viejo = Math.max(0, ...suyos.map((p) => porPrograma.get(p.id).filas));

  // EL NUEVO: personas distintas con pase vigente, sumando todas las
  // tarjetas del negocio.
  const personas = new Set();
  for (const p of suyos) for (const x of porPrograma.get(p.id).personas) personas.add(x);
  const nuevo = personas.size;

  const tope = topeDe(plan);
  filas.push({
    nombre: nombreDeRancho.get(ranchoId) ?? ranchoId,
    plan: plan ?? "—",
    tarjetas: suyos.length,
    viejo,
    nuevo,
    tope,
  });
}

// ── El informe ─────────────────────────────────────────────────────
function estadoDe(f) {
  if (f.tope === undefined) return "sin plan conocido";
  if (f.tope === null) return "sin tope";
  if (f.nuevo >= f.tope) return f.viejo >= f.tope ? "LLENO (ya lo estaba)" : "LLENO ⛔ (es nuevo)";
  if (f.nuevo >= f.tope * 0.8) return "cerca ⚠️";
  return "ok";
}

// Primero los que quedan por encima del tope: son los que hay que mirar.
const peso = (f) => {
  const e = estadoDe(f);
  if (e.startsWith("LLENO ⛔")) return 0;
  if (e.startsWith("LLENO")) return 1;
  if (e.startsWith("cerca")) return 2;
  return 3;
};
filas.sort((a, b) => peso(a) - peso(b) || b.nuevo - a.nuevo);

const col = (s, n) => String(s).padEnd(n).slice(0, n);
const num = (s, n) => String(s).padStart(n);

console.log("");
console.log("  CUPO DE CLIENTES — antes y después de la 0142");
console.log("  Viejo = filas de miembros de la tarjeta más grande (todos los estados)");
console.log("  Nuevo = personas distintas con pase VIGENTE, sumando todas las tarjetas");
if (!hayPersona) {
  console.log("  ⚠️  Sin miembros.persona_id (falta la 0138): el nuevo NO deduplica personas.");
}
console.log("");
console.log(
  `  ${col("NEGOCIO", 30)} ${col("PLAN", 11)} ${num("TARJ", 4)} ${num("VIEJO", 6)} ${num("NUEVO", 6)} ${num("TOPE", 6)}  ESTADO`,
);
console.log(`  ${"─".repeat(30)} ${"─".repeat(11)} ${"─".repeat(4)} ${"─".repeat(6)} ${"─".repeat(6)} ${"─".repeat(6)}  ${"─".repeat(22)}`);

for (const f of filas) {
  const tope = f.tope === undefined ? "?" : f.tope === null ? "∞" : f.tope;
  console.log(
    `  ${col(f.nombre, 30)} ${col(f.plan, 11)} ${num(f.tarjetas, 4)} ${num(f.viejo, 6)} ${num(f.nuevo, 6)} ${num(tope, 6)}  ${estadoDe(f)}`,
  );
}

const nuevosLlenos = filas.filter((f) => estadoDe(f).startsWith("LLENO ⛔"));
const suben = filas.filter((f) => f.nuevo > f.viejo);
const bajan = filas.filter((f) => f.nuevo < f.viejo);

console.log("");
console.log(`  ${filas.length} negocio(s) con al menos una tarjeta.`);
console.log(`  Suben: ${suben.length}   ·   Bajan: ${bajan.length}`);
if (nuevosLlenos.length === 0) {
  console.log("  Ninguno queda por encima de su tope por este cambio. Se puede pegar la 0142.\n");
} else {
  console.log(`  ⛔ ${nuevosLlenos.length} negocio(s) quedan LLENOS y antes no lo estaban:`);
  for (const f of nuevosLlenos) {
    console.log(`     · ${f.nombre} — ${f.nuevo} de ${f.tope} (plan ${f.plan}, ${f.tarjetas} tarjeta/s)`);
  }
  console.log("  Hablar con ellos ANTES de pegar la migración: un cliente parado en la caja");
  console.log("  no debería enterarse de esto por un «el programa está lleno».\n");
}
