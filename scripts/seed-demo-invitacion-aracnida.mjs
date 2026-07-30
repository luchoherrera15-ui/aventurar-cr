/**
 * Seed de la invitación DEMO "Aracnida" (cumpleaños infantil de
 * superhéroe arácnido genérico).
 *
 * Toma la plantilla docs/plantillas-invitaciones/aracnida.html,
 * sustituye los placeholders con los datos de Mateo (6 años) y hace
 * upsert de la invitación con slug `demo-aracnida` (estado activa,
 * sin cliente asignado: es material de muestra).
 *
 * Si la tabla `invitaciones` no existe (migración 0066 sin correr),
 * lo dice claro y sale sin romper.
 *
 * Uso:  node scripts/seed-demo-invitacion-aracnida.mjs
 * Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------- .env.local (sin dependencias extra) ----------

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function leerEnvLocal() {
  const contenido = readFileSync(path.join(raiz, ".env.local"), "utf8");
  const env = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = leerEnvLocal();
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}

const db = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- La plantilla con los datos de Mateo ----------

const DATOS = {
  "{{NOMBRE}}": "Mateo",
  "{{EDAD}}": "6",
  "{{FECHA}}": "sábado 19 de setiembre",
  "{{HORA}}": "2:00 p. m.",
  "{{LUGAR}}": "Salón de Eventos Villa Aventura",
  "{{DIRECCION}}": "Curridabat, San José — 200 m este del parque central",
};

const rutaPlantilla = path.join(raiz, "docs", "plantillas-invitaciones", "aracnida.html");
let html = readFileSync(rutaPlantilla, "utf8");
for (const [marca, valor] of Object.entries(DATOS)) {
  html = html.replaceAll(marca, valor);
}
const sinSustituir = html.match(/\{\{[A-Z_]+\}\}/g);
if (sinSustituir) {
  console.error("Quedaron placeholders sin sustituir:", [...new Set(sinSustituir)].join(", "));
  process.exit(1);
}

const INVITACION = {
  slug: "demo-aracnida",
  cliente_id: null,
  titulo: "El cumple de Mateo",
  anfitriones: "Familia Vargas Solís",
  mensaje: "Una misión arácnida de cumpleaños — ¡te esperamos!",
  fecha_evento: "2026-09-19",
  hora: "2:00 p. m.",
  lugar_nombre: DATOS["{{LUGAR}}"],
  direccion: DATOS["{{DIRECCION}}"],
  maps_url: null,
  portada_url: null,
  html_personalizado: html,
  tema: "aracnida",
  estado: "activa",
};

// ---------- Upsert ----------

/** ¿El error es "la tabla invitaciones no existe" (0066 sin correr)? */
function tablaNoExiste(error) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = (error.message || "").toLowerCase();
  return msg.includes("invitaciones") && (msg.includes("does not exist") || msg.includes("schema cache"));
}

async function sembrar() {
  console.log("Seed demo invitación ARACNIDA →", URL_SUPABASE);
  console.log(`· Plantilla: ${path.relative(raiz, rutaPlantilla)} (${html.length.toLocaleString()} caracteres ya sustituidos)`);

  const { error } = await db
    .from("invitaciones")
    .upsert(INVITACION, { onConflict: "slug" });

  if (tablaNoExiste(error)) {
    console.log(
      "\nLa tabla `invitaciones` no existe todavía: falta correr la migración" +
        "\nsupabase/migrations/0066_invitaciones_digitales.sql." +
        "\nCorrela y volvé a ejecutar este seed — no se sembró nada.",
    );
    return; // salir sin romper
  }
  if (error) throw new Error("upsert demo-aracnida: " + error.message);

  // ---------- Verificación ----------
  const { data: fila, error: errVerif } = await db
    .from("invitaciones")
    .select("id, slug, titulo, fecha_evento, hora, estado, tema, html_personalizado")
    .eq("slug", INVITACION.slug)
    .single();
  if (errVerif) throw new Error("verificación: " + errVerif.message);

  const conHtml = (fila.html_personalizado || "").length;
  console.log(
    `· ${fila.estado === "activa" ? "✓" : "✗"} ${fila.slug} · "${fila.titulo}" · ${fila.fecha_evento} ${fila.hora} · tema=${fila.tema} · estado=${fila.estado} · html=${conHtml.toLocaleString()} caracteres`,
  );
  console.log(`\nListo: la invitación demo quedó en /i/${fila.slug}`);
}

sembrar().catch((e) => {
  console.error("\nEl seed falló:", e.message);
  process.exit(1);
});
