/**
 * SIEMBRA los restaurantes DEMO de FOOD.BOOKEA para /food/demo.
 *
 *   node scripts/seed-food-demo.mjs           ← siembra o actualiza
 *   node scripts/seed-food-demo.mjs --borrar  ← lo quita todo
 *
 * ------------------------------------------------------------------
 * QUÉ SIEMBRA Y POR QUÉ ASÍ
 * ------------------------------------------------------------------
 * Son negocios PURAMENTE VISUALES/EXPLICATIVOS — el dueño pidió
 * explícitamente que este seed viviera separado de los restaurantes
 * reales de FOOD y de las reservas reales:
 *
 *   · Cuelgan todos de la cuenta food.demo@bookea.lat (se crea sola si
 *     no existe), mismo criterio que las demás cuentas *.demo@bookea.lat
 *     del sitio (ver src/components/acciones-demo.ts).
 *   · Cada fila de food_businesses lleva `es_demo = true` (columna de
 *     la migración 0193) y slug con prefijo `demo-`.
 *   · El directorio real (/food) filtra `es_demo = false` en su propia
 *     consulta — nunca los muestra. Solo /food/demo los lee.
 *   · reservarFood() (src/app/food/restaurante/[slug]/actions.ts)
 *     rechaza reservar sobre una franja de un negocio demo ANTES de
 *     invocar crear_reserva_food(): ninguna reserva de acá es real,
 *     aunque el flujo de reserva se pueda recorrer completo por si
 *     alguien quiere ver cómo se siente.
 *
 * Nombres, menús y sedes son TODOS ficticios — no corresponden a
 * ningún restaurante real. Las fotos (public/food-demo/*.jpg) son
 * fotos de stock con licencia de uso comercial que el dueño ya
 * revisó y aprobó para la identidad visual de FOOD esta noche.
 *
 * Es idempotente: correrlo de nuevo actualiza el negocio y REHACE por
 * completo su menú y sus franjas (se borran y se insertan de cero) —
 * así editar este archivo y volver a correr el script deja la base
 * exactamente como el archivo dice, sin ir acumulando filas viejas.
 * Las franjas siempre se generan desde "mañana" en adelante, así que
 * no hace falta limpiar franjas vencidas a mano.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const BORRAR = process.argv.includes("--borrar");

const CORREO_DEMO = "food.demo@bookea.lat";
// La misma contraseña interna que usan el resto de cuentas *.demo@bookea.lat
// (ver PASSWORD_DEMO en src/components/acciones-demo.ts) — entran con el
// código de prueba 123456, nunca con esta contraseña directamente.
const PASSWORD_DEMO = env.DEMO_ACCOUNTS_PASSWORD || "BookeaDemo2026!";

// ── Fechas sin pasar por el reloj UTC del runtime ───────────────────
function hoyISO_CR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function sumarDiasISO(iso, dias) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

// Franjas siempre desde MAÑANA: así no hay riesgo de sembrar una franja
// de "hoy" cuya hora ya pasó (crear_reserva_food la rechazaría, 0191) ni
// de que aparezca vacía en el listado por la hora del día en que corra
// el script.
const DIAS_ADELANTE = [1, 2, 3, 4];

// Mismo horario para las cuatro sedes: temprano/tarde con más
// descuento que la hora pico — es justo la propuesta que /food/demo
// tiene que mostrar ("según la hora, mejor precio").
const FRANJAS_TIPO = [
  { hora: "11:30:00", descuento_porcentaje: 35 },
  { hora: "12:30:00", descuento_porcentaje: 10 },
  { hora: "13:30:00", descuento_porcentaje: 25 },
  { hora: "18:00:00", descuento_porcentaje: 40 },
  { hora: "19:30:00", descuento_porcentaje: 15 },
  { hora: "21:00:00", descuento_porcentaje: 30 },
];

const NOTA_FICTICIO =
  " (Restaurante de ejemplo para mostrar FOOD.BOOKEA — no es un negocio real.)";

const RESTAURANTES = [
  {
    slug: "la-parrilla-del-barrio",
    nombre: "La Parrilla del Barrio",
    descripcion: "Parrilla de barrio con cortes al carbón y guarniciones caseras." + NOTA_FICTICIO,
    foto: "carne.jpg",
    capacidad: 28,
    sede: { nombre: "Sede única (demo)", direccion: "Dirección de ejemplo — FOOD.BOOKEA Demo" },
    menu: [
      {
        categoria: "Entradas",
        items: [
          { nombre: "Chorizo casero con tortilla", precio: 2600 },
          { nombre: "Chicharrón de costilla", precio: 3400 },
          { nombre: "Ensalada de la casa", precio: 1800 },
        ],
      },
      {
        categoria: "De la parrilla",
        items: [
          { nombre: "Lomo de aguja (250 g)", precio: 6800, foto: "carne.jpg" },
          { nombre: "Costilla en tapa de dulce", precio: 7400 },
          { nombre: "Medio pollo al carbón", precio: 5900 },
          { nombre: "Combo parrillero para dos", precio: 13500 },
        ],
      },
      {
        categoria: "Acompañamientos",
        items: [
          { nombre: "Yuca frita", precio: 1900 },
          { nombre: "Papas al romero", precio: 2100 },
          { nombre: "Ensalada de repollo", precio: 1400 },
        ],
      },
      {
        categoria: "Postres",
        items: [
          { nombre: "Flan de coco", precio: 2200 },
          { nombre: "Tres leches", precio: 2500 },
        ],
      },
    ],
  },
  {
    slug: "sushi-koji",
    nombre: "Sushi Kōji",
    descripcion: "Barra de sushi y rolls generosos, pensados para compartir." + NOTA_FICTICIO,
    foto: "sushi.jpg",
    capacidad: 20,
    sede: { nombre: "Sede única (demo)", direccion: "Dirección de ejemplo — FOOD.BOOKEA Demo" },
    menu: [
      {
        categoria: "Entradas",
        items: [
          { nombre: "Sopa miso", precio: 2200 },
          { nombre: "Edamame con sal", precio: 2000 },
          { nombre: "Gyozas de cerdo", precio: 3400 },
        ],
      },
      {
        categoria: "Rolls",
        items: [
          { nombre: "Roll California", precio: 6200, foto: "sushi.jpg" },
          { nombre: "Roll tempura de camarón", precio: 6800 },
          { nombre: "Roll de salmón flameado", precio: 7200 },
        ],
      },
      {
        categoria: "Nigiri y sashimi",
        items: [
          { nombre: "Nigiri mixto (6 piezas)", precio: 7500 },
          { nombre: "Sashimi de atún (5 cortes)", precio: 7800 },
        ],
      },
      {
        categoria: "Postres",
        items: [{ nombre: "Mochi de té verde", precio: 2600 }],
      },
    ],
  },
  {
    slug: "trattoria-nonna",
    nombre: "Trattoria Nonna",
    descripcion: "Cocina italiana casera: pastas frescas y salsas de olla." + NOTA_FICTICIO,
    foto: "pasta.jpg",
    capacidad: 24,
    sede: { nombre: "Sede única (demo)", direccion: "Dirección de ejemplo — FOOD.BOOKEA Demo" },
    menu: [
      {
        categoria: "Entradas",
        items: [
          { nombre: "Pan de ajo", precio: 1800 },
          { nombre: "Bruschetta de tomate", precio: 2400 },
          { nombre: "Ensalada caprese", precio: 3200 },
        ],
      },
      {
        categoria: "Pastas",
        items: [
          { nombre: "Fettuccine alfredo", precio: 5600, foto: "pasta.jpg" },
          { nombre: "Boloñesa de la casa", precio: 5800 },
          { nombre: "Ravioles de espinaca", precio: 6500 },
          { nombre: "Risotto de hongos", precio: 6800 },
        ],
      },
      {
        categoria: "Postres",
        items: [
          { nombre: "Tiramisú", precio: 2900 },
          { nombre: "Panna cotta", precio: 2700 },
        ],
      },
    ],
  },
  {
    slug: "cuadra-burger",
    nombre: "Cuadra Burger",
    descripcion: "Hamburguesas de plancha con pan artesanal." + NOTA_FICTICIO,
    foto: "hamburguesa.jpg",
    capacidad: 22,
    sede: { nombre: "Sede única (demo)", direccion: "Dirección de ejemplo — FOOD.BOOKEA Demo" },
    menu: [
      {
        categoria: "Para picar",
        items: [
          { nombre: "Aros de cebolla", precio: 2600 },
          { nombre: "Papas con queso", precio: 3400 },
        ],
      },
      {
        categoria: "Hamburguesas",
        items: [
          { nombre: "Sencilla clásica", precio: 3800, foto: "hamburguesa.jpg" },
          { nombre: "Doble con queso", precio: 5200 },
          { nombre: "Criolla con plátano", precio: 5600 },
          { nombre: "Vegetal", precio: 4800 },
        ],
      },
      {
        categoria: "Bebidas",
        items: [
          { nombre: "Batido de fresa", precio: 1800 },
          { nombre: "Limonada", precio: 1500 },
        ],
      },
    ],
  },
  {
    slug: "fogon-del-chef",
    nombre: "Fogón del Chef",
    descripcion: "Menú corto de temporada, con ideas del chef que cambian cada semana." + NOTA_FICTICIO,
    foto: "chef.jpg",
    capacidad: 16,
    sede: { nombre: "Sede única (demo)", direccion: "Dirección de ejemplo — FOOD.BOOKEA Demo" },
    menu: [
      {
        categoria: "Entradas",
        items: [
          { nombre: "Tártara de vegetales asados", precio: 4200 },
          { nombre: "Crema de la semana", precio: 3600 },
        ],
      },
      {
        categoria: "Fuertes",
        items: [
          { nombre: "Plato del chef", precio: 9800, foto: "chef.jpg" },
          { nombre: "Pesca del día", precio: 10500 },
          { nombre: "Risotto de temporada", precio: 8600 },
        ],
      },
      {
        categoria: "Postres",
        items: [{ nombre: "Postre sorpresa", precio: 3200 }],
      },
    ],
  },
];

/** La cuenta dueña de todos los negocios demo de FOOD. */
async function asegurarOwner() {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers: " + error.message);
    const usuario = data.users.find((u) => (u.email || "").toLowerCase() === CORREO_DEMO);
    if (usuario) return usuario.id;
    if (data.users.length < 200) break;
  }
  console.log(`· La cuenta ${CORREO_DEMO} no existe — creándola…`);
  const { data, error } = await db.auth.admin.createUser({
    email: CORREO_DEMO,
    password: PASSWORD_DEMO,
    email_confirm: true,
    user_metadata: { nombre: "FOOD Demo Bookea" },
  });
  if (error) throw new Error("createUser: " + error.message);
  return data.user.id;
}

async function borrarTodo() {
  console.log("Borrando negocios demo de FOOD →", URL_SUPABASE);
  const { data, error } = await db
    .from("food_businesses")
    .delete()
    .eq("es_demo", true)
    .select("slug");
  if (error) throw new Error("borrar: " + error.message);
  console.log(`✓ ${data.length} negocio(s) demo borrados (menú, sedes y franjas cayeron en cascada).`);
}

async function sembrar() {
  console.log("Seed FOOD demo →", URL_SUPABASE);
  console.log(`· ${RESTAURANTES.length} restaurantes por sembrar`);

  const ownerId = await asegurarOwner();
  console.log("· Owner:", CORREO_DEMO, "→", ownerId);

  const hoy = hoyISO_CR();
  let creados = 0;
  let actualizados = 0;

  for (const r of RESTAURANTES) {
    const slug = `demo-${r.slug}`;

    const filaNegocio = {
      owner_id: ownerId,
      nombre: r.nombre,
      slug,
      descripcion: r.descripcion,
      foto_portada_url: `/food-demo/${r.foto}`,
      telefono: null,
      activo: true,
      es_demo: true,
    };

    const { data: existente, error: errSel } = await db
      .from("food_businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (errSel) throw new Error(`select ${slug}: ${errSel.message}`);

    let negocioId;
    if (existente) {
      const { error } = await db.from("food_businesses").update(filaNegocio).eq("id", existente.id);
      if (error) throw new Error(`update ${slug}: ${error.message}`);
      negocioId = existente.id;
      actualizados++;
    } else {
      const { data: creado, error } = await db
        .from("food_businesses")
        .insert(filaNegocio)
        .select("id")
        .single();
      if (error) throw new Error(`insert ${slug}: ${error.message}`);
      negocioId = creado.id;
      creados++;
    }

    // ── Sede (una sola, se upsertea por business_id) ─────────────────
    const { data: sedeExistente, error: errSedeSel } = await db
      .from("food_locations")
      .select("id")
      .eq("business_id", negocioId)
      .limit(1)
      .maybeSingle();
    if (errSedeSel) throw new Error(`select sede ${slug}: ${errSedeSel.message}`);

    let locationId;
    if (sedeExistente) {
      const { error } = await db
        .from("food_locations")
        .update({ nombre: r.sede.nombre, direccion: r.sede.direccion, telefono: null })
        .eq("id", sedeExistente.id);
      if (error) throw new Error(`update sede ${slug}: ${error.message}`);
      locationId = sedeExistente.id;
    } else {
      const { data: sedeCreada, error } = await db
        .from("food_locations")
        .insert({
          business_id: negocioId,
          nombre: r.sede.nombre,
          direccion: r.sede.direccion,
          telefono: null,
        })
        .select("id")
        .single();
      if (error) throw new Error(`insert sede ${slug}: ${error.message}`);
      locationId = sedeCreada.id;
    }

    // ── Menú: se rehace completo, como el seed de restaurantes ──────
    const { error: errDelItems } = await db.from("food_menu_items").delete().eq("business_id", negocioId);
    if (errDelItems) throw new Error(`limpiar items ${slug}: ${errDelItems.message}`);
    const { error: errDelCats } = await db
      .from("food_menu_categories")
      .delete()
      .eq("business_id", negocioId);
    if (errDelCats) throw new Error(`limpiar categorías ${slug}: ${errDelCats.message}`);

    for (let i = 0; i < r.menu.length; i++) {
      const cat = r.menu[i];
      const { data: catCreada, error: errCat } = await db
        .from("food_menu_categories")
        .insert({ business_id: negocioId, nombre: cat.categoria, orden: i })
        .select("id")
        .single();
      if (errCat) throw new Error(`categoría ${slug}/${cat.categoria}: ${errCat.message}`);

      const items = cat.items.map((it, j) => ({
        business_id: negocioId,
        category_id: catCreada.id,
        nombre: it.nombre,
        descripcion: null,
        precio: it.precio,
        foto_url: it.foto ? `/food-demo/${it.foto}` : null,
        activo: true,
        orden: j,
      }));
      const { error: errItems } = await db.from("food_menu_items").insert(items);
      if (errItems) throw new Error(`items ${slug}/${cat.categoria}: ${errItems.message}`);
    }

    // ── Franjas: se rehacen completas, siempre desde mañana ──────────
    const { error: errDelFranjas } = await db.from("food_franjas").delete().eq("business_id", negocioId);
    if (errDelFranjas) throw new Error(`limpiar franjas ${slug}: ${errDelFranjas.message}`);

    const franjas = [];
    for (const dias of DIAS_ADELANTE) {
      const fecha = sumarDiasISO(hoy, dias);
      for (const slot of FRANJAS_TIPO) {
        franjas.push({
          business_id: negocioId,
          location_id: locationId,
          fecha,
          hora: slot.hora,
          capacidad: r.capacidad,
          descuento_porcentaje: slot.descuento_porcentaje,
          activa: true,
        });
      }
    }
    const { error: errFranjas } = await db.from("food_franjas").insert(franjas);
    if (errFranjas) throw new Error(`franjas ${slug}: ${errFranjas.message}`);

    console.log(`  · ${slug}: ${r.menu.length} categorías, ${franjas.length} franjas`);
  }

  console.log(`\n✓ ${creados} creados · ${actualizados} actualizados`);

  const { data: verifDemo } = await db
    .from("food_businesses")
    .select("slug, nombre")
    .eq("es_demo", true)
    .order("nombre");
  console.log(`\nNegocios demo en la base (${(verifDemo ?? []).length}):`);
  for (const v of verifDemo ?? []) console.log(`  · ${v.nombre} (${v.slug})`);

  const { count: countReales } = await db
    .from("food_businesses")
    .select("id", { count: "exact", head: true })
    .eq("es_demo", false);
  console.log(`\nNegocios REALES sin tocar: ${countReales}`);
}

(BORRAR ? borrarTodo() : sembrar()).catch((e) => {
  console.error("\n✗ " + e.message);
  if (/column .*es_demo.* does not exist/i.test(e.message)) {
    console.error("\n→ Falta aplicar la migración 0193_food_negocios_demo.sql en Supabase.");
  }
  process.exit(1);
});
