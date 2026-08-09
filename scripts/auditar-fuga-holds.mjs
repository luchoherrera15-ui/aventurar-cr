/**
 * AUDITORÍA DE SEGURIDAD — ¿qué puede leer `anon` de la tabla `reservas`?
 *
 * Contexto: la política "Cualquiera ve los holds temporales" (migración
 * 0006) permite `select` sobre `reservas` a `anon` y `authenticated` con
 * `using (estado = 'temporal')`, y la 0002/0025 le dan `grant select` a
 * la TABLA ENTERA. Las políticas de Postgres son PERMISIVAS y se OR-ean,
 * así que esa política convive con la del dueño (0032). La pregunta es
 * qué columnas quedan alcanzables con la anon key, que está publicada en
 * el bundle del sitio.
 *
 * CÓMO PRUEBA SIN ESCRIBIR NADA
 * -----------------------------
 * No crea holds (un hold real bloquea (negocio, fecha) por el índice
 * `unique_temporal_date` y le quitaría la fecha a un cliente de verdad
 * durante 10 minutos). En vez de eso se apoya en cómo responde PostgREST:
 *
 *   · columna PERMITIDA → HTTP 200, aunque no haya ninguna fila.
 *   · columna DENEGADA  → HTTP 4xx con "permission denied for column".
 *
 * Esa diferencia es la prueba, y no depende de que exista un hold vivo.
 *
 * USO:  node scripts/auditar-fuga-holds.mjs
 * Lee la URL y la anon key de .env.local. NUNCA las imprime.
 */

import { readFileSync } from "node:fs";

function leerEnv() {
  const texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = leerEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_BASE || !ANON) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
  process.exit(1);
}

/** Una consulta REST con la anon key y nada más. */
async function comoAnon(query) {
  const res = await fetch(`${URL_BASE}/rest/v1/reservas?${query}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  let cuerpo;
  try {
    cuerpo = await res.json();
  } catch {
    cuerpo = null;
  }
  return { status: res.status, cuerpo };
}

/** Las columnas que no deberían salir nunca de la tabla. */
const PII = [
  "nombre",
  "contacto",
  "correo",
  "whatsapp",
  "cedula",
  "creado_por_ip",
  "notas",
  "deposito_comprobante_url",
];

/** Lo que el flujo público SÍ necesita leer para funcionar. */
const FLUJO_PUBLICO = ["id", "expira_en", "estado", "fecha", "rancho_id"];

const resultados = [];

console.log("\n══════════════════════════════════════════════════════════");
console.log("  AUDITORÍA — lectura de `reservas` con la anon key");
console.log("══════════════════════════════════════════════════════════\n");

// ---------------------------------------------------------------
// A) ¿Se pueden pedir TODAS las columnas?
// ---------------------------------------------------------------
const todo = await comoAnon("select=*&limit=3");
const fugaTotal = todo.status === 200;
resultados.push({ prueba: "select=* permitido", esperadoTrasParche: false, real: fugaTotal });
console.log(`A) select=*                → HTTP ${todo.status}  ${fugaTotal ? "❌ PERMITIDO" : "✅ denegado"}`);
if (fugaTotal && Array.isArray(todo.cuerpo) && todo.cuerpo.length > 0) {
  console.log(`   ⚠️  Devolvió ${todo.cuerpo.length} fila(s) AHORA MISMO. Columnas expuestas:`);
  console.log(`   ${Object.keys(todo.cuerpo[0]).join(", ")}`);
} else if (fugaTotal) {
  console.log("   (0 filas en este instante — no hay holds vivos. La consulta");
  console.log("    igual está PERMITIDA: con un hold vivo devolvería sus datos.)");
}

// ---------------------------------------------------------------
// B) ¿Columna por columna, qué PII queda alcanzable?
// ---------------------------------------------------------------
console.log("\nB) columnas sensibles, una por una:");
const expuestas = [];
for (const col of PII) {
  const r = await comoAnon(`select=${col}&limit=1`);
  const permitida = r.status === 200;
  if (permitida) expuestas.push(col);
  console.log(`   ${permitida ? "❌" : "✅"} ${col.padEnd(26)} HTTP ${r.status}`);
}
resultados.push({
  prueba: "PII alcanzable",
  esperadoTrasParche: 0,
  real: expuestas.length,
});

// ---------------------------------------------------------------
// C) ¿Sigue funcionando lo que el flujo público necesita?
// ---------------------------------------------------------------
console.log("\nC) columnas que el flujo público necesita:");
const rotas = [];
for (const col of FLUJO_PUBLICO) {
  const r = await comoAnon(`select=${col}&limit=1`);
  const permitida = r.status === 200;
  if (!permitida) rotas.push(col);
  console.log(`   ${permitida ? "✅" : "❌"} ${col.padEnd(26)} HTTP ${r.status}`);
}
resultados.push({ prueba: "flujo público roto", esperadoTrasParche: 0, real: rotas.length });

// ---------------------------------------------------------------
// D) ¿La RLS sigue tapando lo que no es un hold?
// ---------------------------------------------------------------
const confirmadas = await comoAnon("select=id&estado=eq.confirmada&limit=1");
const filtra =
  confirmadas.status !== 200 ||
  (Array.isArray(confirmadas.cuerpo) && confirmadas.cuerpo.length === 0);
console.log(
  `\nD) reservas confirmadas   → HTTP ${confirmadas.status}  ${filtra ? "✅ la RLS las tapa" : "❌ VISIBLES"}`,
);
resultados.push({ prueba: "RLS tapa las confirmadas", esperadoTrasParche: true, real: filtra });

// ---------------------------------------------------------------
console.log("\n──────────────────────────────────────────────────────────");
console.log("  RESUMEN");
console.log("──────────────────────────────────────────────────────────");
console.log(`  select=* permitido a anon .......... ${fugaTotal ? "SÍ  ❌" : "NO  ✅"}`);
console.log(`  columnas PII alcanzables ........... ${expuestas.length} ${expuestas.length ? "❌" : "✅"}`);
if (expuestas.length) console.log(`     → ${expuestas.join(", ")}`);
console.log(`  flujo público roto ................. ${rotas.length} ${rotas.length ? "❌" : "✅"}`);
if (rotas.length) console.log(`     → ${rotas.join(", ")}`);
console.log(`  la RLS tapa las confirmadas ........ ${filtra ? "SÍ  ✅" : "NO  ❌"}`);
console.log("");
console.log("  ANTES del parche se espera: PII alcanzable > 0.");
console.log("  DESPUÉS del parche se espera: PII alcanzable = 0 y flujo roto = 0.");
console.log("");

// ---------------------------------------------------------------
// E) El flujo real de holds, de punta a punta. SOLO con --flujo,
//    porque ESCRIBE en la base.
//
//    Es inofensivo a propósito: usa una fecha del año 2099 (ningún
//    cliente real la va a pedir, así que no le quita el turno a nadie
//    por el índice unique_temporal_date) y nace ya vencido, así que
//    ninguna vista de disponibilidad lo cuenta y la política de borrado
//    —que solo deja borrar holds vencidos— permite limpiarlo enseguida.
// ---------------------------------------------------------------
if (process.argv.includes("--flujo")) {
  console.log("──────────────────────────────────────────────────────────");
  console.log("  E) FLUJO PÚBLICO DE HOLDS (escribe y limpia)");
  console.log("──────────────────────────────────────────────────────────");

  const cab = {
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  // Un negocio aprobado cualquiera, leído como lo lee el público.
  const ranchos = await fetch(
    `${URL_BASE}/rest/v1/ranchos?select=id&estado=eq.aprobado&limit=1`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
  ).then((r) => r.json());

  if (!Array.isArray(ranchos) || ranchos.length === 0) {
    console.log("  ⚠️  No hay negocios aprobados para probar.\n");
  } else {
    const ranchoId = ranchos[0].id;
    const vencido = new Date(Date.now() - 60_000).toISOString();

    const alta = await fetch(`${URL_BASE}/rest/v1/reservas?select=id,expira_en`, {
      method: "POST",
      headers: cab,
      body: JSON.stringify({
        fecha: "2099-12-31",
        estado: "temporal",
        expira_en: vencido,
        origen: "web",
        rancho_id: ranchoId,
      }),
    });
    const creado = await alta.json().catch(() => null);
    const ok = alta.status === 201 && Array.isArray(creado) && creado[0]?.id;

    console.log(`  crear hold + leer id/expira_en → HTTP ${alta.status}  ${ok ? "✅" : "❌"}`);
    if (!ok) console.log(`     ${JSON.stringify(creado)}`);

    if (ok) {
      const borrado = await fetch(
        `${URL_BASE}/rest/v1/reservas?id=eq.${creado[0].id}&estado=eq.temporal&expira_en=lt.${encodeURIComponent(new Date().toISOString())}`,
        { method: "DELETE", headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
      );
      console.log(
        `  borrar el hold vencido         → HTTP ${borrado.status}  ${borrado.status < 300 ? "✅ limpio" : "❌ QUEDÓ LA FILA"}`,
      );
    }
    console.log("");
  }
}

process.exit(expuestas.length > 0 || rotas.length > 0 ? 1 : 0);
