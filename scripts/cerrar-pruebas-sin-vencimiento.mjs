/**
 * LAS PRUEBAS QUE HOY NO VENCEN NUNCA — cómo se les pone un final SIN
 * cortarle el servicio a nadie de un día para otro.
 *
 *   node scripts/cerrar-pruebas-sin-vencimiento.mjs           ← solo mira
 *   node scripts/cerrar-pruebas-sin-vencimiento.mjs --aplicar ← escribe
 *   node scripts/cerrar-pruebas-sin-vencimiento.mjs --aplicar --dias 21
 *
 * ------------------------------------------------------------------
 * QUÉ PASÓ
 * ------------------------------------------------------------------
 * El catálogo prometía «14 días» y el alta escribía el complemento con
 * `vence_en: null`, que en `tiene_addon()` significa PARA SIEMPRE. O
 * sea que todo negocio dado de alta con el paquete Prueba antes de este
 * arreglo está operando gratis sin fecha de corte.
 *
 * El código nuevo NO los toca: `estadoDePrueba` trata `vence_en: null`
 * como «sin corte», no como «vencido». Eso es deliberado — apagarle el
 * programa a alguien de un día para otro por un cambio de código es la
 * peor forma posible de estrenar un vencimiento, y además rompe la
 * doctrina del repo (a quien ya tiene algo no se le quita). Así que
 * esas cuentas siguen exactamente como estaban hasta que alguien
 * decida, a mano y a conciencia, correr este script.
 *
 * ------------------------------------------------------------------
 * QUÉ HACE ESTE SCRIPT
 * ------------------------------------------------------------------
 * A cada negocio con plan `prueba` y complemento `lealtad` ACTIVO y SIN
 * `vence_en`, le pone un corte **contado desde hoy**, no desde el día
 * en que se dio de alta.
 *
 * Eso importa: contar desde el alta dejaría vencidos hoy mismo a todos
 * los que se registraron hace más de dos semanas — o sea que correr el
 * script sería, en la práctica, apagarles el programa sin avisar. Con
 * el plazo contado desde hoy, todos arrancan con los días completos por
 * delante, ven la cuenta regresiva en su panel la próxima vez que
 * entren, y reciben el correo de aviso tres días antes del corte por el
 * cron diario que ya existe.
 *
 * Por defecto son 21 días y no 14: quien lleva meses usando el módulo
 * gratis merece un poco más de aire que quien se registra hoy. Se puede
 * cambiar con `--dias`.
 *
 * SIN `--aplicar` no escribe nada: imprime la lista de a quién le
 * tocaría y qué fecha le quedaría. Esa es la corrida que hay que mirar
 * antes de decidir.
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── El entorno ────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const APLICAR = process.argv.includes("--aplicar");
const iDias = process.argv.indexOf("--dias");
const DIAS = iDias > -1 ? Number(process.argv[iDias + 1]) : 21;

if (!Number.isInteger(DIAS) || DIAS < 1 || DIAS > 365) {
  console.error("--dias tiene que ser un entero entre 1 y 365.");
  process.exit(1);
}

const corte = new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000);

console.log(
  APLICAR
    ? `\nESCRIBIENDO: las pruebas sin corte pasan a vencer el ${corte.toISOString().slice(0, 10)} (${DIAS} días desde hoy).\n`
    : `\nSOLO MIRANDO (sin --aplicar no se escribe nada). Corte propuesto: ${corte.toISOString().slice(0, 10)} (${DIAS} días desde hoy).\n`,
);

// Los complementos de lealtad encendidos y sin fecha de corte.
const { data: addons, error } = await db
  .from("addons_negocio")
  .select("rancho_id, activado_en, notas")
  .eq("addon", "lealtad")
  .eq("activo", true)
  .is("vence_en", null);

if (error) {
  console.error("No se pudieron leer los complementos:", error.message);
  process.exit(1);
}

let alcanzados = 0;
let saltados = 0;

for (const a of addons ?? []) {
  // `select *`: `plan_lealtad` es de la 0124 y una lista explícita
  // reventaría entera contra una base sin migrar.
  const { data: rancho } = await db
    .from("ranchos")
    .select("*")
    .eq("id", a.rancho_id)
    .maybeSingle();

  // SOLO los que están en el paquete de prueba. Un negocio de pago con
  // `vence_en: null` está bien así — no vence por tiempo —, y un
  // complemento de cortesía que alguien regaló a mano tampoco se toca.
  if (!rancho || rancho.plan_lealtad !== "prueba") {
    saltados++;
    continue;
  }

  const desde = a.activado_en ? String(a.activado_en).slice(0, 10) : "?";
  console.log(
    `  · ${rancho.nombre} (${a.rancho_id})  — en prueba desde ${desde}, hoy SIN corte`,
  );
  alcanzados++;

  if (APLICAR) {
    const { error: eUpd } = await db
      .from("addons_negocio")
      .update({
        vence_en: corte.toISOString(),
        notas: `${a.notas ?? ""} · corte de prueba fijado a mano (${corte.toISOString().slice(0, 10)})`.trim(),
      })
      .eq("rancho_id", a.rancho_id)
      .eq("addon", "lealtad");
    if (eUpd) console.error(`    ✗ no se pudo escribir: ${eUpd.message}`);
  }
}

console.log(
  `\n${alcanzados} prueba(s) sin corte · ${saltados} complemento(s) que no son prueba (intactos).`,
);
if (!APLICAR && alcanzados > 0) {
  console.log("Volvé a correrlo con --aplicar cuando estés de acuerdo con la lista.\n");
}
if (APLICAR && alcanzados > 0) {
  console.log(
    "Listo. Cada uno ve la cuenta regresiva en su panel y recibe el correo de aviso\n" +
      "tres días antes, por el cron diario que ya corre.\n",
  );
}
