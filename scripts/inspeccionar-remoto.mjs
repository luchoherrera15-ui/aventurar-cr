/**
 * CONSULTAS DE SOLO LECTURA CONTRA EL SUPABASE REMOTO — Fase 2C.
 *
 * A diferencia de `aplicar-migracion.mjs` (que existe para ESCRIBIR
 * migraciones reales), este script existe exclusivamente para LEER
 * metadata: historial de migraciones, columnas, constraints, índices,
 * RLS, policies, triggers, funciones, grants y conteos. Se usa desde
 * `scripts/drift-remoto.mjs` y `scripts/preflight-remoto.mjs` — no se
 * pensó para uso interactivo directo.
 *
 * Protección en dos capas (ninguna es "confiar en que uno mismo no se
 * equivoque"):
 *   1. Guard de texto: rechaza cualquier consulta que contenga una
 *      palabra clave de escritura, antes de mandar nada por red.
 *   2. Guard real de Postgres: cada consulta viaja ENVUELTA en
 *      `BEGIN TRANSACTION READ ONLY; ...; COMMIT;` — si el guard de
 *      texto tuviera un hueco, Postgres igual rechaza la escritura con
 *      su propio error ("cannot execute ... in a read-only transaction").
 *
 *      OJO, esto se probó de verdad contra el Postgres LOCAL antes de
 *      confiar en el guard: `SET default_transaction_read_only = on;`
 *      suelto (sin BEGIN explícito) NO protege nada, porque un lote de
 *      sentencias mandado junto forma una sola transacción implícita
 *      que ya empezó antes de que el SET surta efecto — un CREATE TABLE
 *      en el mismo lote se ejecutó igual. El `BEGIN TRANSACTION READ
 *      ONLY` explícito sí lo bloquea, porque marca la transacción actual
 *      (no la próxima) como de solo lectura.
 *
 * Nunca imprime valores de PII ni secretos — eso es responsabilidad de
 * quien arma cada consulta (drift-remoto.mjs / preflight-remoto.mjs),
 * pero este módulo no ofrece ningún atajo que lea columnas de datos
 * reales sin pasar por el criterio de quien lo llama.
 */

import fs from "node:fs";

function cargarEnv() {
  const contenido = fs.readFileSync(".env.local", "utf8");
  return Object.fromEntries(
    contenido
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

export const env = cargarEnv();

if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
  console.error(
    "Faltan SUPABASE_ACCESS_TOKEN y/o SUPABASE_PROJECT_REF en .env.local — sin eso no hay forma de consultar nada remoto.",
  );
  process.exit(1);
}

const PALABRAS_PROHIBIDAS =
  /\b(insert|update|delete|drop|alter|truncate|create|grant\s|revoke|copy|vacuum|refresh|merge|call|do\s*\$|do\s*\()/i;

/**
 * Ejecuta una consulta de SOLO LECTURA contra el proyecto remoto vía la
 * Management API de Supabase. Lanza si la consulta parece una escritura
 * (guard de texto) o si Postgres la rechaza por estar en una sesión
 * `READ ONLY` (guard real).
 */
export async function consultaSoloLectura(sql, { silencioso = false } = {}) {
  if (PALABRAS_PROHIBIDAS.test(sql)) {
    throw new Error(
      `Consulta rechazada por el guard de texto (contiene una palabra clave de escritura). SQL:\n${sql}`,
    );
  }

  const query = `BEGIN TRANSACTION READ ONLY;\n${sql}\nCOMMIT;`;

  const res = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const texto = await res.text();
  if (!res.ok) {
    if (!silencioso) console.error("status:", res.status, texto);
    throw new Error(`La Management API devolvió ${res.status}: ${texto.slice(0, 500)}`);
  }

  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error(`Respuesta no era JSON: ${texto.slice(0, 300)}`);
  }
  return json;
}
