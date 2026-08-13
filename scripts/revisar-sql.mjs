/**
 * REVISOR DE MIGRACIONES — lo que se puede comprobar sin una base.
 *
 * Existe porque una migración de 2.200 líneas se pega a mano en el SQL
 * Editor, y cada error se descubre de a uno: pegar, fallar a la mitad,
 * arreglar, volver a pegar. Cuatro rondas de eso costaron más que
 * escribir esto.
 *
 * NO valida SQL de verdad —para eso hace falta Postgres—. Comprueba
 * las cosas que fallaron DE VERDAD en este repo, cada una agregada
 * después de romper algo:
 *
 *   1. Comillas de dólar desbalanceadas ($$, $tag$). El error que
 *      metió `.replace()` de JavaScript, donde `$$` en el texto de
 *      reemplazo significa un `$` literal.
 *   2. `begin` sin su `end` dentro de cada bloque.
 *   3. Primer carácter: el SQL pegado pierde el primero, así que el
 *      archivo tiene que arrancar con un comentario, nunca con una
 *      sentencia.
 *   4. Funciones `language sql` que consultan tablas: son las únicas
 *      que Postgres valida AL CREARLAS, así que una referencia a algo
 *      declarado más abajo rompe la migración entera.
 *
 * Uso:  node scripts/revisar-sql.mjs supabase/migrations/0138_*.sql
 */

import fs from "node:fs";
import process from "node:process";

const archivos = process.argv.slice(2);
if (archivos.length === 0) {
  console.error("Uso: node scripts/revisar-sql.mjs <archivo.sql> [...]");
  process.exit(2);
}

let fallos = 0;

for (const ruta of archivos) {
  const sql = fs.readFileSync(ruta, "utf8");
  const lineas = sql.split(/\r?\n/);
  const problemas = [];

  // ── 1. Comillas de dólar ──────────────────────────────────────────
  // Se recorre el archivo alternando dentro/fuera. Una apertura sin
  // cierre deja el resto del archivo "dentro" y Postgres se queja en un
  // lugar que no tiene nada que ver con el error.
  const etiquetas = [...sql.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)?\$/g)];
  const pila = [];
  for (const m of etiquetas) {
    const tag = m[0];
    const linea = sql.slice(0, m.index).split(/\r?\n/).length;
    if (pila.length > 0 && pila[pila.length - 1].tag === tag) pila.pop();
    else pila.push({ tag, linea });
  }
  for (const abierta of pila) {
    problemas.push(`línea ${abierta.linea}: \`${abierta.tag}\` abre y nunca cierra`);
  }

  // Un `$` solitario pegado a `do`/`as` es el síntoma exacto del bug de
  // `.replace()`: `$$` se volvió `$`.
  lineas.forEach((l, i) => {
    if (/^\s*(do|as)\s+\$\s*$/.test(l)) {
      problemas.push(`línea ${i + 1}: \`${l.trim()}\` — falta un $ (¿lo comió un .replace() de JS?)`);
    }
  });

  // ── 2. begin/end por bloque ───────────────────────────────────────
  const bloques = [...sql.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)?\$([\s\S]*?)\$\1?\$/g)];
  for (const b of bloques) {
    const cuerpo = b[2];
    const linea = sql.slice(0, b.index).split(/\r?\n/).length;
    // Qué NO cuenta como cierre de bloque:
    //   · `end if`, `end loop`, `end case` — cierran su propia estructura;
    //   · el `end` pelado de una EXPRESIÓN `case … when … then … end`,
    //     que es el que hacía saltar esto en falso siete veces. Se
    //     descuenta contando los `case` que no llevan `end case`.
    const abre = (cuerpo.match(/\bbegin\b/gi) || []).length;
    const endsPelados = (cuerpo.match(/\bend\b(?!\s*(if|loop|case)\b)/gi) || []).length;
    const cases = (cuerpo.match(/\bcase\b/gi) || []).length;
    const endCase = (cuerpo.match(/\bend\s+case\b/gi) || []).length;
    const cierra = endsPelados - (cases - endCase);
    if (abre !== cierra) {
      problemas.push(
        `línea ${linea}: bloque con ${abre} \`begin\` y ${cierra} \`end\` (sin contar case/if/loop)`,
      );
    }
  }

  // ── 3. El primer carácter ─────────────────────────────────────────
  if (!/^\s*--/.test(sql)) {
    problemas.push(
      "el archivo NO arranca con un comentario: al pegarlo se pierde el primer carácter",
    );
  }

  // ── 4. Funciones `language sql` que tocan tablas ──────────────────
  // Solo se avisa: decidir si la tabla existe antes requiere leer todo
  // el orden, y eso es trabajo de una persona. Pero saber CUÁLES son
  // las que se validan al crearse es la mitad del diagnóstico.
  const sqlFns = [
    ...sql.matchAll(
      /create or replace function\s+([\w.]+)\s*\([\s\S]*?\)\s*returns[\s\S]*?language sql([\s\S]*?)\$([A-Za-z_][A-Za-z0-9_]*)?\$([\s\S]*?)\$\3?\$/g,
    ),
  ];
  const avisos = [];
  for (const f of sqlFns) {
    const nombre = f[1];
    const cuerpo = f[4] ?? "";
    const tablas = [...cuerpo.matchAll(/\bfrom\s+([a-z_][a-z0-9_.]*)/gi)]
      .map((m) => m[1])
      .filter((t) => !["unnest", "jsonb_array_elements_text"].includes(t));
    if (tablas.length > 0) {
      const linea = sql.slice(0, f.index).split(/\r?\n/).length;
      avisos.push(`  línea ${linea}: ${nombre}() → ${[...new Set(tablas)].join(", ")}`);
    }
  }

  // ── Informe ───────────────────────────────────────────────────────
  console.log(`\n=== ${ruta} (${lineas.length} líneas) ===`);
  if (problemas.length === 0) {
    console.log("✅ sin problemas de estructura");
  } else {
    fallos += problemas.length;
    for (const p of problemas) console.log(`❌ ${p}`);
  }
  if (avisos.length > 0) {
    console.log(
      `\nℹ️  ${avisos.length} función(es) \`language sql\` que consultan tablas.\n` +
        "   Postgres les valida el cuerpo AL CREARLAS: todo lo que\n" +
        "   nombran tiene que existir ANTES en el archivo.",
    );
    for (const a of avisos) console.log(a);
  }
}

process.exit(fallos > 0 ? 1 : 0);
