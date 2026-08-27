/**
 * ════════════════════════════════════════════════════════════════════
 *  EL DEMO GRANDE — 99 negocios, su equipo y 2.475 reseñas
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (27 ago 2026): «necesito que sembremos un DEMO
 * completo […] 100 negocios entre peluquerías, estéticas, barberías,
 * uñas, consultorios de psicología etc., y sus debidos trabajadores,
 * qué hacen ellos, reseñas de cada uno, cada local debe tener 25
 * reseñas».
 *
 * El contenido lo generaron 13 agentes en paralelo y vive en
 * `datos-demo-100.json`, al lado de este archivo. Acá solo se siembra:
 * si hay que cambiar un nombre o un precio, se toca el JSON.
 *
 * ── POR QUÉ 99 Y NO 100 ─────────────────────────────────────────────
 *
 * Dos lotes distintos inventaron el mismo nombre («Aguamansa Spa
 * Urbano»). Se descartó el repetido en vez de renombrarlo a mano: el
 * slug se deriva del nombre, y dos slugs iguales habrían hecho que el
 * segundo pisara al primero en silencio.
 *
 * ── LO QUE MANTIENE ESTO FUERA DEL MARKETPLACE REAL ─────────────────
 *
 * ⚠️ `en_marketplace = false` EN CADA FICHA. Es la única cosa que
 * impide que 99 negocios de mentira entierren a los 3 de verdad.
 *
 * Los negocios nacen `estado = 'aprobado'` a propósito —tienen que
 * poder navegarse y reservarse para que la demo sirva de algo—, así que
 * sin esa columna en false saldrían en la portada como cualquier otro.
 * La consulta de la portada la respeta desde hoy (ver `home-datos.ts`).
 *
 * Y además `detalles.demo = true` y slug `demo-*`, que es lo que hace
 * que el sitio les pinte el aviso «Demo» (ver `lib/demo.ts`).
 *
 * ── LAS CUENTAS SE ENTRAN SIN CORREO ────────────────────────────────
 *
 * Todas terminan en `.demo@bookea.lat`, que es el patrón que
 * `acciones-demo.ts` reconoce para dejar entrar con el código fijo
 * 123456 en vez de mandar un correo. Eso ya existía; acá solo se crean
 * las cuentas que lo usan.
 *
 * ── LAS RESEÑAS NECESITAN UNA RESERVA ───────────────────────────────
 *
 * ⚠️ `resenas.reserva_id` es NOT NULL y ÚNICO (migración 0033): no
 * existe una reseña que no cuelgue de una reserva confirmada. Así que
 * cada una de las 2.475 reseñas trae su propia reserva sembrada, con su
 * fecha, su servicio y su profesional. No es adorno: es lo que hace que
 * la ficha pueda decir «con quién» y «de qué» fue cada reseña.
 *
 * ── EL PADRÓN DE RESEÑADORES ────────────────────────────────────────
 *
 * El contenido trae 2.292 nombres distintos. Crear 2.292 cuentas de
 * auth sería inflar `auth.users` con basura para siempre, así que se
 * usa un padrón de 400 y se reparten.
 *
 * La regla que sí se respeta: DENTRO de un mismo negocio nadie se
 * repite. Entre negocios sí, y eso es realista — una persona reseña
 * varios lugares a lo largo de los años. Lo que no se cree es ver dos
 * veces el mismo nombre en la misma ficha.
 *
 * Uso:  node scripts/seed-demo-100.mjs
 *       node scripts/seed-demo-100.mjs --borrar    (limpia y sale)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** La misma con la que `acciones-demo.ts` entra a las cuentas demo. */
const PASSWORD_DEMO = env.DEMO_ACCOUNTS_PASSWORD || "BookeaDemo2026!";
const PREFIJO = "demo100-";
const PADRON = 400;

const NEGOCIOS = JSON.parse(
  readFileSync(path.join(raiz, "scripts", "datos-demo-100.json"), "utf8"),
);

/** Nombre → slug estable. El prefijo `demo-` es lo que marca la ficha. */
function slugDe(nombre, i) {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `demo-${base || "negocio"}-${i}`;
}

function correoDe(nombre, i) {
  const base = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 40);
  return `${PREFIJO}${base}.${i}.demo@bookea.lat`;
}

/**
 * Crea la cuenta o devuelve la que ya existe.
 *
 * `email_confirm: true` porque nadie va a abrir un correo de
 * confirmación de una cuenta de mentira, y sin confirmar no se puede
 * entrar ni con contraseña.
 */
async function cuenta(email, nombre) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD_DEMO,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (!error) return data.user.id;

  // Ya existía: se busca. `createUser` no es idempotente y este script
  // tiene que poder correrse dos veces sin duplicar nada.
  if (/already|registered|exists/i.test(error.message)) {
    for (let page = 1; page <= 40; page++) {
      const { data: lista } = await db.auth.admin.listUsers({ page, perPage: 200 });
      const u = lista?.users.find((x) => (x.email || "").toLowerCase() === email);
      if (u) return u.id;
      if (!lista || lista.users.length < 200) break;
    }
  }
  throw new Error(`cuenta ${email}: ${error.message}`);
}

/** Inserta de a tandas: 2.475 filas en un solo INSERT revienta. */
async function enTandas(tabla, filas, tam = 500, upsert = false) {
  for (let i = 0; i < filas.length; i += tam) {
    const trozo = filas.slice(i, i + tam);
    const { error } = upsert
      ? await db.from(tabla).upsert(trozo)
      : await db.from(tabla).insert(trozo);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    process.stdout.write(`\r    ${tabla}: ${Math.min(i + tam, filas.length)}/${filas.length}   `);
  }
  process.stdout.write("\n");
}

/**
 * Borra TODO lo sembrado por este script y nada más.
 *
 * ⚠️ El filtro es el prefijo del slug, no la marca de demo: hay demos
 * viejas (`seed-demo-citas.mjs`) que también son `demo-*` pero no de
 * acá, y borrarlas sería un daño colateral que nadie pidió.
 */
async function borrar() {
  // ⚠️ El filtro es SOLO `detalles->>lote`, y alcanza.
  //
  // Antes llevaba además un `.like("slug", "demo-%-")` que no casaba con
  // nada: ningún slug termina en guion. Resultado, `borrar()` decía «0
  // negocios» con 99 en la base, y la siembra siguiente moría contra la
  // clave única del slug.
  //
  // La marca del lote es la identificación exacta y es la que hace que
  // esto NO toque las demos viejas (`seed-demo-citas.mjs`) ni un negocio
  // real: ninguno la lleva.
  const { data } = await db
    .from("ranchos")
    .select("id")
    .filter("detalles->>lote", "eq", "demo100");
  const ids = (data ?? []).map((r) => r.id);
  console.log(`  ${ids.length} negocios de este lote`);
  if (ids.length > 0) {
    // Las reservas caen por cascada desde `ranchos`; las reseñas por
    // cascada desde `reservas`. Solo hay que tocar la raíz.
    const { error } = await db.from("ranchos").delete().in("id", ids);
    if (error) throw new Error("borrar ranchos: " + error.message);
  }
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const demos = (users?.users ?? []).filter((u) => (u.email || "").startsWith(PREFIJO));
  for (const u of demos) await db.auth.admin.deleteUser(u.id);
  console.log(`  ${demos.length} cuentas borradas`);
}

async function main() {
  if (process.argv.includes("--borrar")) {
    console.log("Borrando el lote demo100…");
    await borrar();
    console.log("Listo.");
    return;
  }

  /**
   * Se limpia ANTES de sembrar, siempre.
   *
   * Este script se corre varias veces mientras se ajusta el contenido, y
   * el slug lleva el índice del negocio (`demo-nombre-7`): sin limpiar,
   * la segunda corrida choca contra `ranchos_slug_key` a mitad de camino
   * y deja la base con los negocios cargados pero sin reseñas.
   *
   * Es seguro porque `borrar()` filtra por `detalles->>lote = 'demo100'`:
   * no toca las demos viejas ni ningún negocio real.
   */
  console.log("Limpiando lo anterior de este lote…");
  await borrar();
  console.log();

  console.log(`Sembrando ${NEGOCIOS.length} negocios demo…\n`);

  // ── 1. El padrón de reseñadores ──
  const nombresRes = [...new Set(NEGOCIOS.flatMap((n) => n.resenas.map((r) => r.cliente.trim())))];
  const padron = [];
  console.log(`  padrón de reseñadores (${PADRON} de ${nombresRes.length} nombres)…`);
  for (let i = 0; i < Math.min(PADRON, nombresRes.length); i++) {
    const nombre = nombresRes[i];
    const id = await cuenta(correoDe(nombre, `r${i}`), nombre);
    padron.push({ id, nombre });
    if ((i + 1) % 50 === 0) process.stdout.write(`\r    ${i + 1}/${PADRON}   `);
  }
  process.stdout.write("\n");

  // Los perfiles llevan el nombre que la ficha va a mostrar en la
  // reseña (`page.tsx` lo saca de `perfiles.nombre`, no de la reseña).
  // ⚠️ UPSERT y no INSERT: `handle_new_user` (migración 0008) YA le
  // crea el perfil a cada cuenta apenas nace. Un insert choca contra la
  // clave primaria y tumba la siembra entera a los 400 usuarios.
  await enTandas(
    "perfiles",
    padron.map((p) => ({ id: p.id, nombre: p.nombre })),
    200,
    true,
  );

  // ── 2. Las dos cuentas con las que se entra a la demo ──
  const duenoPanel = await cuenta("negocio.demo@bookea.lat", "Negocio Demo");
  const duenoResto = await cuenta("catalogo.demo@bookea.lat", "Catálogo Demo");
  const clienteDemo = await cuenta("cliente.demo@bookea.lat", "Cliente Demo");
  await db.from("perfiles").upsert([
    { id: duenoPanel, nombre: "Negocio Demo" },
    { id: duenoResto, nombre: "Catálogo Demo" },
    { id: clienteDemo, nombre: "Cliente Demo" },
  ]);
  console.log("  cuentas de entrada listas\n");

  // ── 3. Los negocios ──
  const filasNegocio = NEGOCIOS.map((n, i) => ({
    // El PRIMERO es del que entra al panel: así «entrar como negocio»
    // muestra UN panel limpio y no una lista de 99.
    owner_id: i === 0 ? duenoPanel : duenoResto,
    nombre: n.nombre,
    slug: slugDe(n.nombre, i),
    descripcion: n.descripcion,
    vertical: "citas",
    categoria: n.categoria,
    provincia: n.provincia,
    canton: n.canton,
    estado: "aprobado",
    // ⚠️ Lo único que lo mantiene fuera del marketplace real.
    en_marketplace: false,
    verificado: false,
    detalles: { demo: true, lote: "demo100" },
  }));
  console.log("  negocios…");
  await enTandas("ranchos", filasNegocio, 100);

  const { data: creados } = await db
    .from("ranchos")
    .select("id, slug, nombre")
    .filter("detalles->>lote", "eq", "demo100");
  const porSlug = new Map((creados ?? []).map((r) => [r.slug, r.id]));
  console.log(`  ${porSlug.size} negocios en la base\n`);

  // ── 4. Servicios y equipo ──
  const servicios = [];
  const equipo = [];
  NEGOCIOS.forEach((n, i) => {
    const rid = porSlug.get(slugDe(n.nombre, i));
    if (!rid) return;
    n.servicios.forEach((s, k) => {
      servicios.push({
        rancho_id: rid,
        grupo: s.grupo,
        tipo: "producto",
        nombre: s.nombre,
        precio: s.precio,
        descripcion: s.descripcion,
        duracion_minutos: s.duracion,
        buffer_min: 10,
        min_por_reserva: 1,
        activo: true,
        orden: k,
      });
    });
    n.equipo.forEach((m, k) => {
      equipo.push({ rancho_id: rid, nombre: m.nombre, rol: m.rol, activo: true, orden: k });
    });
  });
  console.log("  servicios…");
  await enTandas("rancho_items", servicios);
  console.log("  equipo…");
  await enTandas("equipo_rancho", equipo);

  // Se releen para poder colgarles las reservas.
  const { data: itemsBd } = await db
    .from("rancho_items")
    .select("id, rancho_id, nombre, precio")
    .in("rancho_id", [...porSlug.values()]);
  const { data: equipoBd } = await db
    .from("equipo_rancho")
    .select("id, rancho_id")
    .in("rancho_id", [...porSlug.values()]);
  const itemsPorRancho = new Map();
  for (const it of itemsBd ?? []) {
    const l = itemsPorRancho.get(it.rancho_id) ?? [];
    l.push(it);
    itemsPorRancho.set(it.rancho_id, l);
  }
  const equipoPorRancho = new Map();
  for (const m of equipoBd ?? []) {
    const l = equipoPorRancho.get(m.rancho_id) ?? [];
    l.push(m);
    equipoPorRancho.set(m.rancho_id, l);
  }

  // ── 5. Reservas + reseñas ──
  //
  // Cada reseña arrastra su reserva. Las fechas van repartidas hacia
  // atrás para que la ficha no muestre 25 reseñas del mismo día.
  const reservas = [];
  const pendientes = [];
  const hoy = new Date();

  NEGOCIOS.forEach((n, i) => {
    const rid = porSlug.get(slugDe(n.nombre, i));
    if (!rid) return;
    const items = itemsPorRancho.get(rid) ?? [];
    const staff = equipoPorRancho.get(rid) ?? [];
    // Sin repetir reseñador DENTRO del negocio: se arranca en un punto
    // distinto del padrón por cada negocio y se avanza de uno.
    const arranque = (i * 37) % padron.length;

    n.resenas.forEach((res, k) => {
      const autor = padron[(arranque + k) % padron.length];
      const item = items[k % Math.max(items.length, 1)];
      const miembro = staff.length > 0 ? staff[k % staff.length] : null;
      const dias = 5 + k * 11 + (i % 7);
      const f = new Date(hoy.getTime() - dias * 86_400_000);

      reservas.push({
        rancho_id: rid,
        cliente_id: autor.id,
        miembro_id: miembro ? miembro.id : null,
        fecha: f.toISOString().slice(0, 10),
        hora_inicio: `${String(8 + (k % 9)).padStart(2, "0")}:00`,
        nombre: autor.nombre,
        contacto: "8888-0000",
        tipo_evento: item ? item.nombre : "Servicio",
        estado: "confirmada",
        origen: "web",
      });
      pendientes.push({ autor, res, item });
    });
  });

  console.log("  reservas…");
  await enTandas("reservas", reservas);

  // Se releen en el MISMO orden para poder aparearlas con su reseña.
  // ⚠️ PAGINADO, Y NO ES OPCIONAL: PostgREST corta en 1.000 filas por
  // defecto. Sin esto la lectura devolvía 1.000 de 2.475 y las reseñas
  // se habrían colgado de la reserva equivocada — con los comentarios
  // de un negocio apareciendo en otro. Lo agarró el guard de abajo.
  const reservasBd = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from("reservas")
      .select("id, rancho_id, cliente_id, fecha, hora_inicio")
      .in("rancho_id", [...porSlug.values()])
      .order("created_at", { ascending: true })
      .range(desde, desde + 999);
    if (error) throw new Error("leer reservas: " + error.message);
    reservasBd.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  if (reservasBd.length !== pendientes.length) {
    throw new Error(
      `Se esperaban ${pendientes.length} reservas y hay ${reservasBd.length}. ` +
        `Sin apareo 1:1 las reseñas quedarían colgadas de la reserva equivocada.`,
    );
  }

  const items = [];
  const resenas = [];
  reservasBd.forEach((r, idx) => {
    const p = pendientes[idx];
    if (p.item) {
      items.push({
        reserva_id: r.id,
        item_id: p.item.id,
        nombre: p.item.nombre,
        precio_unitario: p.item.precio,
        cantidad: 1,
      });
    }
    resenas.push({
      rancho_id: r.rancho_id,
      cliente_id: r.cliente_id,
      reserva_id: r.id,
      calificacion: Math.max(1, Math.min(5, Math.round(p.res.calificacion))),
      comentario: p.res.comentario,
    });
  });

  console.log("  items de reserva…");
  await enTandas("reserva_items", items);
  console.log("  reseñas…");
  await enTandas("resenas", resenas);

  console.log("\n═══════════════════════════════════════════");
  console.log(`  ${porSlug.size} negocios`);
  console.log(`  ${servicios.length} servicios`);
  console.log(`  ${equipo.length} personas de equipo`);
  console.log(`  ${resenas.length} reseñas`);
  console.log("═══════════════════════════════════════════");
  console.log("\n  Entrar con el código 123456:");
  console.log("    cliente.demo@bookea.lat   → como cliente");
  console.log("    negocio.demo@bookea.lat   → como negocio (panel)");
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
