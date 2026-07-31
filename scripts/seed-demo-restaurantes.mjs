/**
 * Siembra los restaurantes DEMO de la vertical nueva.
 *
 * Son negocios ficticios para que el directorio no se vea vacío: dos
 * por cada categoría de comida, con su menú. Todos cuelgan de la
 * cuenta negocios.demo@bookea.lat y llevan slug con prefijo `demo-`,
 * que es lo que pinta la insignia "Demo" en las cards.
 *
 * Correr:  node scripts/seed-demo-restaurantes.mjs
 * Requiere la migración 0076 aplicada (la vertical y sus categorías).
 * Es idempotente: volver a correrlo actualiza, no duplica.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RESTAURANTES } from "./datos-restaurantes-demo.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = {};
for (const linea of readFileSync(path.join(raiz, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SUPABASE || !SERVICE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const db = createClient(URL_SUPABASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORREO_DEMO = "negocios.demo@bookea.lat";
const PASSWORD_DEMO = "BookeaDemo2026!";

/** La cuenta dueña de todos los demos (la misma de eventos). */
async function asegurarOwner() {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers: " + error.message);
    const usuario = data.users.find(
      (u) => (u.email || "").toLowerCase() === CORREO_DEMO,
    );
    if (usuario) return usuario.id;
    if (data.users.length < 200) break;
  }
  console.log(`· La cuenta ${CORREO_DEMO} no existe — creándola…`);
  const { data, error } = await db.auth.admin.createUser({
    email: CORREO_DEMO,
    password: PASSWORD_DEMO,
    email_confirm: true,
    user_metadata: { nombre: "Negocios Demo Bookea" },
  });
  if (error) throw new Error("createUser: " + error.message);
  return data.user.id;
}

async function sembrar() {
  console.log("Seed demo RESTAURANTES →", URL_SUPABASE);
  console.log(`· ${RESTAURANTES.length} locales por sembrar`);

  const ownerId = await asegurarOwner();
  console.log("· Owner:", CORREO_DEMO, "→", ownerId);

  let creados = 0;
  let actualizados = 0;

  for (const r of RESTAURANTES) {
    const slug = `demo-${r.slug}`;
    const { menu, rango_precio, acepta_reserva_mesa, acepta_pickup, ...campos } = r;

    const fila = {
      ...campos,
      slug,
      owner_id: ownerId,
      vertical: "restaurantes",
      estado: "aprobado",
      pais: "CR",
      // Lo que el local ofrece vive en el jsonb, como lo lee la ficha.
      detalles: {
        rango_precio,
        acepta_reserva_mesa,
        acepta_pickup,
      },
    };

    const { data: existente, error: errSel } = await db
      .from("ranchos")
      .select("id, estado")
      .eq("slug", slug)
      .maybeSingle();
    if (errSel) throw new Error(`select ${slug}: ${errSel.message}`);

    let ranchoId;
    if (existente && existente.estado !== "aprobado") {
      // El trigger no deja aprobar por UPDATE sin sesión admin.
      const { error } = await db.from("ranchos").delete().eq("id", existente.id);
      if (error) throw new Error(`delete ${slug}: ${error.message}`);
      console.log(`· ${slug} estaba '${existente.estado}' — recreado`);
    }

    if (existente && existente.estado === "aprobado") {
      const { estado: _e, ...sinEstado } = fila;
      const { error } = await db.from("ranchos").update(sinEstado).eq("id", existente.id);
      if (error) throw new Error(`update ${slug}: ${error.message}`);
      ranchoId = existente.id;
      actualizados++;
    } else {
      const { data: creado, error } = await db
        .from("ranchos")
        .insert(fila)
        .select("id")
        .single();
      if (error) throw new Error(`insert ${slug}: ${error.message}`);
      ranchoId = creado.id;
      creados++;
    }

    // El menú se rehace completo: es la forma simple de que quitar un
    // plato del archivo lo quite de verdad de la base.
    const { error: errDel } = await db
      .from("rancho_items")
      .delete()
      .eq("rancho_id", ranchoId);
    if (errDel) throw new Error(`limpiar menú ${slug}: ${errDel.message}`);

    const platos = menu.map((p, i) => ({
      rancho_id: ranchoId,
      grupo: p.grupo,
      tipo: "producto",
      nombre: p.nombre,
      descripcion: p.descripcion ?? null,
      precio: p.precio,
      unidad: null,
      orden: i,
      activo: true,
      min_por_reserva: 1,
    }));
    const { error: errItems } = await db.from("rancho_items").insert(platos);
    if (errItems) throw new Error(`menú ${slug}: ${errItems.message}`);
  }

  console.log(`\n✓ ${creados} creados · ${actualizados} actualizados`);

  // Verificación: qué quedó en la base, por categoría.
  const { data: verif } = await db
    .from("ranchos")
    .select("slug, nombre, categoria, estado, rancho_items(count)")
    .eq("vertical", "restaurantes")
    .order("categoria");

  const porCategoria = {};
  for (const v of verif ?? []) {
    porCategoria[v.categoria] = (porCategoria[v.categoria] ?? 0) + 1;
  }
  console.log("\nPor categoría:");
  for (const [cat, n] of Object.entries(porCategoria)) {
    console.log(`  ${cat}: ${n}`);
  }
  const sinMenu = (verif ?? []).filter((v) => (v.rancho_items?.[0]?.count ?? 0) === 0);
  if (sinMenu.length) {
    console.log(`\n⚠ ${sinMenu.length} sin menú: ${sinMenu.map((v) => v.slug).join(", ")}`);
  }
  console.log(`\nTotal en la vertical: ${(verif ?? []).length}`);
}

sembrar().catch((e) => {
  console.error("\n✗ " + e.message);
  if (/violates check constraint|categoria_check|vertical_check/i.test(e.message)) {
    console.error(
      "\n→ Falta correr la migración 0076_vertical_restaurantes.sql en Supabase.",
    );
  }
  process.exit(1);
});
