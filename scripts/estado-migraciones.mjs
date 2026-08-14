/**
 * ¿QUÉ MIGRACIONES ESTÁN DE VERDAD EN LA BASE?
 *
 * El repo tiene 139 migraciones y la base tiene las que alguien pegó a
 * mano. Sin esto, saber cuáles faltan cuesta pegar una y ver dónde
 * revienta — que es exactamente lo que costó cinco vueltas con la 0138.
 *
 * No escribe nada. Pregunta por un objeto testigo de cada migración
 * que importa y arma la tabla.
 *
 * Uso:  node scripts/estado-migraciones.mjs
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

/**
 * Cada fila es: migración, qué se busca, y cómo se busca.
 *
 * `tabla` → se pide una fila con head; PGRST205 significa que no
 * existe. `columna` → se pide ESA columna; 42703 significa que no
 * está. Es la forma barata de preguntar sin function RPC de por medio.
 */
const TESTIGOS = [
  ["0060", "tabla", "programa_lealtad", null, "el motor de lealtad"],
  ["0060", "tabla", "miembros", null, "membresías"],
  ["0060", "tabla", "pases_wallet", null, "pases emitidos"],
  ["0082", "tabla", "consentimientos", null, "consentimiento de correo"],
  ["0109", "tabla", "clientes_negocio", null, "fichas de CRM"],
  ["0125", "tabla", "canjes", null, "lealtad operable"],
  ["0125", "columna", "programa_lealtad", "estado", "estados del programa"],
  ["0127", "tabla", "rancho_colaboradores", null, "roles de colaborador"],
  ["0132", "tabla", "oferta_bienvenida", null, "regalo de bienvenida"],
  ["0132", "columna", "programa_lealtad", "pase_banner_url", "LA BANDA DEL PASE"],
  ["0132", "columna", "programa_lealtad", "poster_config", "póster personalizable"],
  ["0134", "tabla", "cuentas", null, "cuentas raíz"],
  ["0135", "columna", "programa_lealtad", "beneficio", "los 8 tipos de tarjeta"],
  ["0136", "columna", "programa_lealtad", "dias_permitidos", "reglas de la tarjeta"],
  ["0137", "tabla", "intentos_canje", null, "canje seguro"],
  ["0138", "tabla", "personas", null, "identidad raíz"],
  ["0138", "columna", "miembros", "persona_id", "miembro sin cuenta"],
  ["0143", "tabla", "suscripciones", null, "suscripciones Stripe"],
  ["0143", "tabla", "eventos_stripe", null, "webhooks de Stripe procesados"],
  ["0145", "columna", "programa_lealtad", "pase_sello_icono", "icono del sello"],
  ["0146", "columna", "programa_lealtad", "pausado_por_cobro", "corte al terminar el mes"],
  ["0146", "columna", "suscripciones", "cortada_en", "corte al terminar el mes"],
  ["0147", "columna", "pases_wallet", "pase_en_pausa", "aviso de pausa en el pase"],
  ["0149", "tabla", "ayuda_diseno", null, "ayuda con el diseño"],
  ["0150", "columna", "pases_wallet", "diseno_pendiente", "aviso de cambio de diseño"],
];

console.log("\n  MIG   OBJETO                                 ESTADO");
console.log("  ────  ─────────────────────────────────────  ──────────");

const faltan = new Set();
const rotos = new Set();

for (const [mig, clase, tabla, columna, glosa] of TESTIGOS) {
  // SIN `head: true`: una respuesta HEAD no lleva cuerpo (así lo manda
  // PostgREST), así que un error ahí llega con `message: ""` y sin
  // `code` — un "roto" fantasma que en realidad era una columna
  // ausente de toda la vida. `.limit(1)` sin head cuesta lo mismo que
  // importa acá (una fila) y siempre trae el error completo.
  const { error } = await db.from(tabla).select(columna ?? "*").limit(1);

  // PGRST205 = no existe la tabla. 42703 / PGRST204 = no existe la columna.
  const ausente =
    error && ["PGRST205", "42703", "PGRST204"].includes(error.code ?? "");
  const roto = error && !ausente;

  const nombre = columna ? `${tabla}.${columna}` : tabla;
  const etiqueta = `${nombre}  (${glosa})`.padEnd(38);

  if (roto) {
    console.log(`  ${mig}  ${etiqueta}  ⚠️  ${error.code ?? "error sin código"}: ${error.message}`);
    rotos.add(mig);
  } else if (ausente) {
    console.log(`  ${mig}  ${etiqueta}  ❌ FALTA`);
    faltan.add(mig);
  } else {
    console.log(`  ${mig}  ${etiqueta}  ✅`);
  }
}

console.log("");
if (faltan.size === 0 && rotos.size === 0) {
  console.log("  Todo lo que el código espera está en la base.\n");
} else {
  if (faltan.size > 0) {
    console.log(`  FALTAN: ${[...faltan].sort().join(", ")}`);
    console.log("  Pegalas en ese orden. Y antes de la 0138, corré supabase/PRE-VUELO-0138.sql");
  }
  if (rotos.size > 0) {
    console.log(`  ROTAS (error que no es "no existe" — mirá el mensaje arriba): ${[...rotos].sort().join(", ")}`);
  }
  console.log("");
}
