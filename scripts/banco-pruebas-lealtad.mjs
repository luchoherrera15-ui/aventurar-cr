/**
 * EL BANCO DE PRUEBAS DE LEALTAD — para probar sin tocar un cliente real.
 *
 *   node scripts/banco-pruebas-lealtad.mjs            ← solo mira
 *   node scripts/banco-pruebas-lealtad.mjs --montar   ← lo arma
 *   node scripts/banco-pruebas-lealtad.mjs --desmontar ← lo apaga
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * El refactor que movió la lógica de sellos a `@/lib/lealtad/operar-core`
 * hay que probarlo de punta a punta: dar un sello, canjear un premio,
 * confirmar que el pase se actualiza. Pero los dos negocios que operan
 * hoy —Pura Matcha y Praia— son CLIENTES REALES con clientes reales
 * adentro. Probar ahí significa regalarle sellos a gente de verdad o
 * quemarle una regalía a alguien que la estaba juntando. No se hace.
 *
 * «PruebaCafé Aroma» es la salida: es un negocio del propio dueño, ya
 * aprobado para Lealtad, con su tarjeta de 10 sellos armada y CERO
 * miembros. Lo único que le falta es tener el complemento encendido y
 * un par de clientes de mentira a los que sellarles.
 *
 * ------------------------------------------------------------------
 * LOS CLIENTES DE PRUEBA SE CREAN POR EL CAMINO DE VERDAD
 * ------------------------------------------------------------------
 * Se afilian con el MISMO RPC que usa «afiliar cliente a mano» del
 * mostrador (`alta_persona_por_mostrador`), no insertando filas a mano.
 * Es la diferencia entre probar el producto y probar una maqueta: si
 * ese camino se rompió, este script se entera antes que el dueño.
 *
 * ------------------------------------------------------------------
 * ES REVERSIBLE, Y NO TOCA A NADIE MÁS
 * ------------------------------------------------------------------
 * `--desmontar` apaga el complemento otra vez. Los clientes de prueba se
 * quedan (borrarlos arrastraría su ledger, y no molestan a nadie: viven
 * dentro de un negocio que no está en el directorio).
 *
 * TODO filtra por el rancho de prueba. Pura Matcha y Praia no se tocan
 * ni de casualidad — hay una guarda explícita más abajo.
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

const MONTAR = process.argv.includes("--montar");
const DESMONTAR = process.argv.includes("--desmontar");

/** El único negocio que este script puede tocar. */
const NOMBRE_BANCO = "PruebaCafé Aroma";

/**
 * Los negocios que NO se tocan bajo ninguna circunstancia. La lista está
 * escrita aunque el script ya filtre por nombre: es la segunda barrera,
 * y la que queda si alguien cambia `NOMBRE_BANCO` sin pensar.
 */
const INTOCABLES = ["pura matcha", "praia"];

const normalizar = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Los clientes de mentira. Correos `.demo@bookea.lat`, que es la
 * convención que ya usan los demás sembrados del repo.
 *
 * ⚠️ LOS TELÉFONOS NO SON REDONDOS A PROPÓSITO. La primera versión usó
 * 88880001 y el alta la rebotó como duplicada: ese número ya lo tenía un
 * «Cliente TEST» de una prueba anterior, y `alta_persona_por_mostrador`
 * comprueba el contacto contra TODAS las identidades, no solo contra las
 * de este programa. Un número obvio choca justamente porque es obvio.
 */
const CLIENTES_FALSOS = [
  { nombre: "Ana Prueba", correo: "ana.prueba.demo@bookea.lat", telefono: "70197431" },
  { nombre: "Beto Prueba", correo: "beto.prueba.demo@bookea.lat", telefono: "88880002" },
];

// ── Encontrar el banco ─────────────────────────────────────────────
const { data: ranchos, error: errR } = await db
  .from("ranchos")
  .select("id, nombre, lealtad_aprobado_en")
  .ilike("nombre", "%PruebaCaf%");

if (errR) {
  console.error("No se pudo leer ranchos:", errR.message);
  process.exit(1);
}

const banco = (ranchos ?? []).find((r) => normalizar(r.nombre) === normalizar(NOMBRE_BANCO));
if (!banco) {
  console.error(`No existe el negocio «${NOMBRE_BANCO}». Nada que montar.`);
  process.exit(2);
}
if (INTOCABLES.includes(normalizar(banco.nombre))) {
  console.error("⛔ Ese negocio está en la lista de intocables. No se hace nada.");
  process.exit(3);
}

const { data: programas } = await db
  .from("programa_lealtad")
  .select("id, nombre, modo, activo, beneficio")
  .eq("rancho_id", banco.id);

const programa = (programas ?? [])[0];
if (!programa) {
  console.error("El negocio de prueba no tiene tarjeta. Creala desde el panel y volvé a correr.");
  process.exit(4);
}

const { data: miembros } = await db
  .from("miembros")
  .select("id")
  .eq("programa_id", programa.id);

const { data: addon } = await db
  .from("addons_negocio")
  .select("activo")
  .eq("rancho_id", banco.id)
  .eq("addon", "lealtad")
  .maybeSingle();

// ── El informe ─────────────────────────────────────────────────────
const meta = programa.beneficio?.requeridos ?? "?";
console.log(`\nBanco de pruebas: ${banco.nombre}`);
console.log(`  rancho_id ......... ${banco.id}`);
console.log(`  tarjeta ........... ${programa.nombre} (${programa.modo}, meta ${meta})`);
console.log(`  lealtad activa .... ${addon?.activo ? "SÍ" : "no"}`);
console.log(`  aprobado .......... ${banco.lealtad_aprobado_en ? "sí" : "NO"}`);
console.log(`  miembros .......... ${(miembros ?? []).length}`);
console.log(`\n  Panel: https://bookea.lat/lealtad/panel/${banco.id}`);

if (DESMONTAR) {
  const { error } = await db
    .from("addons_negocio")
    .update({ activo: false })
    .eq("rancho_id", banco.id)
    .eq("addon", "lealtad");
  if (error) {
    console.error("\nNo se pudo apagar:", error.message);
    process.exit(1);
  }
  console.log("\n✅ Banco desmontado: el complemento quedó apagado.");
  process.exit(0);
}

if (!MONTAR) {
  console.log("\n(Solo mirando. Para armarlo: node scripts/banco-pruebas-lealtad.mjs --montar)");
  process.exit(0);
}

// ── Montar ─────────────────────────────────────────────────────────

// 1. El complemento. `upsert` y no `update`: si la fila no existe —el
//    negocio nunca tuvo el add-on— hay que crearla.
const { error: errAddon } = await db
  .from("addons_negocio")
  .upsert(
    { rancho_id: banco.id, addon: "lealtad", activo: true, vence_en: null },
    { onConflict: "rancho_id,addon" },
  );
if (errAddon) {
  console.error("\nNo se pudo encender el complemento:", errAddon.message);
  process.exit(1);
}
console.log("\n✅ Complemento de lealtad encendido.");

// 2. Los clientes de mentira, por el camino de verdad.
for (const c of CLIENTES_FALSOS) {
  const { data, error } = await db.rpc("alta_persona_por_mostrador", {
    p_programa: programa.id,
    p_correo: c.correo,
    p_telefono: c.telefono,
    p_nombre: c.nombre,
    p_acepta: false,
    p_texto_consentimiento: `Alta de prueba en ${banco.nombre}.`,
  });

  if (error) {
    console.error(`  ⚠️ ${c.nombre}: ${error.message}`);
    continue;
  }
  const r = data ?? {};
  if (r.estado === "duplicado") {
    console.log(`  · ${c.nombre}: ya estaba afiliado.`);
  } else {
    console.log(`  ✅ ${c.nombre} afiliado (miembro ${r.miembro_id ?? "?"}).`);
  }
}

console.log(`
──────────────────────────────────────────────────────────────
QUÉ PROBAR, en https://bookea.lat/lealtad/panel/${banco.id}

  1. Clientes → Mostrador: buscá "Prueba". Tienen que salir los dos.
  2. Dale «Sumar sello» a Ana. El saldo pasa a 1 de ${meta}.
  3. Volvé a darle sello DOS veces seguidas, rápido.
     → tiene que sumar de verdad, no rebotar como «ya estaba».
  4. Dale sellos hasta llegar a ${meta} y canjeá el premio.
     → el saldo vuelve a 0 y aparece en Actividad.
  5. Actividad: los movimientos dicen «Sello por visita» y «Compra».
  6. Escanear: si tenés el pase de prueba en el teléfono, escaneá.
     → un escaneo suma UNO solo aunque la cámara lea diez veces.

Cuando termines: node scripts/banco-pruebas-lealtad.mjs --desmontar
──────────────────────────────────────────────────────────────`);
