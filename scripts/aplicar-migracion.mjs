/**
 * PEGAR UNA MIGRACIÓN EN LA BASE DE VERDAD, SIN PASAR POR EL SQL EDITOR.
 *
 * Antes esto lo hacía el dueño a mano, copiando el archivo al SQL Editor
 * de Supabase — y ahí se perdió más de una vez el primer carácter del
 * pegado (ver docs de la 0138). Este script manda el archivo TAL CUAL
 * por la Management API de Supabase (`/database/query`), que no
 * necesita la contraseña de la base — solo el token de cuenta
 * (`SUPABASE_ACCESS_TOKEN`) que ya vive en `.env.local`.
 *
 * Uso:
 *   node scripts/aplicar-migracion.mjs 0153
 *   node scripts/aplicar-migracion.mjs supabase/migrations/0153_completar_clientes_negocio_persona.sql
 *
 * No hace nada "mágico": manda el archivo completo como una sola
 * consulta. Las migraciones de este repo ya están escritas para correr
 * así (con `do $$ ... $$` e `if not exists` donde hace falta), igual que
 * cuando se pegaban a mano.
 */

import fs from "node:fs";
import path from "node:path";

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

if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
  console.error(
    "Faltan SUPABASE_ACCESS_TOKEN y/o SUPABASE_PROJECT_REF en .env.local — sin eso no hay forma de pegar nada.",
  );
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error("Uso: node scripts/aplicar-migracion.mjs <número o ruta de la migración>");
  process.exit(1);
}

const DIR = "supabase/migrations";
let archivo = arg;
if (!fs.existsSync(archivo)) {
  const candidato = fs.readdirSync(DIR).find((f) => f.startsWith(arg));
  if (!candidato) {
    console.error(`No encontré ninguna migración que empiece con "${arg}" en ${DIR}/`);
    process.exit(1);
  }
  archivo = path.join(DIR, candidato);
}

const sql = fs.readFileSync(archivo, "utf8");
console.log(`Pegando ${archivo} (${sql.length} caracteres)...`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const body = await res.text();
console.log("status:", res.status);
console.log(body);

if (!res.ok) {
  console.error("\nLa migración NO quedó aplicada — revisá el error de arriba.");
  process.exit(1);
}
console.log("\nListo. Corré `node scripts/estado-migraciones.mjs` para confirmar.");
