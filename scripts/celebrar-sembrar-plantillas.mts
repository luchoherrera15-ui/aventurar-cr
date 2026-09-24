/**
 * SEMBRAR EL CATÁLOGO DE PLANTILLAS DE CELEBRAR (440: 40 por tipo).
 *
 * Las plantillas las produce `src/lib/celebrar/plantillas/generador.ts`
 * de forma determinista. Este script las escribe en
 * `celebrar_plantillas` con un upsert por `slug`: se puede correr las
 * veces que haga falta (después de ajustar una paleta, un copy, una
 * combinación) y no duplica nada. Las plantillas dibujadas a mano por
 * el equipo (`nivel = 'exclusiva'`) no se tocan porque no salen del
 * generador.
 *
 * Uso:  npx tsx scripts/celebrar-sembrar-plantillas.mts
 *       npx tsx scripts/celebrar-sembrar-plantillas.mts --dry-run
 *
 * Escribe con la service_role (del .env.local): es una tarea de
 * administración, no pasa por el navegador ni por RLS.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generarPlantillas } from "../src/lib/celebrar/plantillas/generador";

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

const seco = process.argv.includes("--dry-run");
const plantillas = generarPlantillas();
console.log(`Generadas ${plantillas.length} plantillas (${new Set(plantillas.map((p) => p.tipos_evento[0])).size} tipos).`);

if (seco) {
  for (const p of plantillas.slice(0, 5)) console.log(` · ${p.slug} — ${p.nombre} [${p.categoria_id}, ${p.nivel}]`);
  console.log("(dry-run: no se escribió nada)");
  process.exit(0);
}

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let escritas = 0;
for (let i = 0; i < plantillas.length; i += 100) {
  const tanda = plantillas.slice(i, i + 100).map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    categoria_id: p.categoria_id,
    nivel: p.nivel,
    costo_creditos: p.costo_creditos,
    tipos_evento: p.tipos_evento,
    descripcion: p.descripcion,
    esquema: p.esquema,
    estilos: p.estilos,
    orden: p.orden,
    activa: true,
  }));
  const { error } = await admin.from("celebrar_plantillas").upsert(tanda, { onConflict: "slug" });
  if (error) {
    console.error(`Falló la tanda ${i / 100 + 1}:`, error.message);
    process.exit(1);
  }
  escritas += tanda.length;
  console.log(`  ${escritas}/${plantillas.length}`);
}

// Las plantillas de catálogos anteriores (otros slugs) se APAGAN, no se
// borran: una celebración puede apuntar a una de ellas (`plantilla_id`) y
// su invitación ya guardada no tiene por qué perder su origen.
const vigentes = new Set(plantillas.map((p) => p.slug));
// Paginado: PostgREST devuelve 1 000 filas por consulta y el catálogo es
// más grande (si no, quedaban viejas encendidas sin que nadie lo viera).
const enBase: { id: string; slug: string; activa: boolean }[] = [];
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await admin.from("celebrar_plantillas").select("id, slug, activa").range(desde, desde + 999);
  if (error) {
    console.error("No se pudo leer el catálogo:", error.message);
    process.exit(1);
  }
  enBase.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const aApagar = enBase.filter((r) => r.activa && !vigentes.has(r.slug)).map((r) => r.id);
for (let i = 0; i < aApagar.length; i += 200) {
  const { error } = await admin.from("celebrar_plantillas").update({ activa: false }).in("id", aApagar.slice(i, i + 200));
  if (error) {
    console.error("No se pudieron apagar las viejas:", error.message);
    process.exit(1);
  }
}
if (aApagar.length) console.log(`Apagadas ${aApagar.length} plantillas de catálogos anteriores.`);

const { count } = await admin.from("celebrar_plantillas").select("id", { count: "exact", head: true }).eq("activa", true);
console.log(`Listo. La tabla tiene ${count} plantillas activas.`);
