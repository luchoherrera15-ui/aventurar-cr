/**
 * Seed de negocios DEMO para la vertical de CITAS.
 *
 * Crea 3 negocios completos y REALMENTE reservables (no cosméticos):
 * peluquería (belleza), sala de masajes (spa) y salón de uñas (unas).
 * Cada uno con horario semanal del negocio, equipo (equipo_rancho) con
 * foto, catálogo de servicios (rancho_items) con duración/buffer real
 * en minutos, y — para un miembro de cada equipo — un horario propio
 * en horarios_recurso que demuestra la herencia (un día sin fila hereda
 * el horario del negocio) y el patrón de "día libre" (un día CON fila
 * usando el rango centinela 00:00–00:01, la única forma de decir "no
 * trabaja ese día" en ese esquema — ver src/app/citas/tipos.ts).
 *
 * servicios_recurso se deja vacío a propósito: sin filas, un servicio
 * lo puede dar cualquier miembro del equipo (comportamiento por
 * defecto de la 0061) — así cada negocio queda reservable con
 * "cualquier profesional" desde el primer momento.
 *
 * Todos con slug "demo-…" (el sitio les pinta el badge Demo) y
 * detalles.demo = true, a nombre de la cuenta citas.demo@bookea.lat.
 *
 * Idempotente: si el slug ya existe, actualiza la fila; el equipo y el
 * catálogo se regeneran completos (delete + insert) — sus tablas hijas
 * (horarios_recurso, servicios_recurso) caen solas por el "on delete
 * cascade" hacia equipo_rancho.id / rancho_items.id. Igual que
 * seed-demo-eventos.mjs, si el slug queda en otro estado que no sea
 * 'aprobado' se borra y se reinserta (el trigger trg_rancho_bloquear_
 * estado no deja aprobar por UPDATE sin sesión admin).
 *
 * Uso:  node scripts/seed-demo-citas.mjs
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

// ---------- La cuenta dueña de los demos ----------

const CORREO_DEMO = "citas.demo@bookea.lat";
const PASSWORD_DEMO = "BookeaDemo2026!";

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
    user_metadata: { nombre: "Citas Demo Bookea" },
  });
  if (error) throw new Error("createUser: " + error.message);
  return data.user.id;
}

// ---------- Helpers ----------

const unsplash = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;
const avatar = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=70`;

/** Servicio del catálogo (rancho_items) con defaults sanos para citas. */
function servicio(grupo, nombre, precio, duracionMinutos, bufferMin, descripcion, extra = {}) {
  return {
    grupo,
    tipo: "producto",
    nombre,
    precio,
    unidad: null,
    descripcion,
    duracion_minutos: duracionMinutos,
    buffer_min: bufferMin,
    min_por_reserva: 1,
    max_por_reserva: null,
    capacidad_dia: null,
    duracion_horas: null,
    activo: true,
    ...extra,
  };
}

/** Miembro del equipo (equipo_rancho). `diaLibre` (0-6) es opcional. */
function miembro(nombre, rol, fotoId, diaLibre) {
  return { nombre, rol, foto_url: avatar(fotoId), activo: true, diaLibre };
}

// El rango centinela de "no trabaja ese día" (src/app/citas/tipos.ts).
const RANGO_LIBRE = { abre: "00:00", cierra: "00:01" };

/** Horario semanal cerrado los domingos, con el resto de días dados. */
function horarioSemana({ lunAVie, sabado }) {
  return {
    "0": null,
    "1": lunAVie,
    "2": lunAVie,
    "3": lunAVie,
    "4": lunAVie,
    "5": lunAVie,
    "6": sabado,
  };
}

// ---------- Los 3 negocios ----------

const NEGOCIOS = [
  // ================= PELUQUERÍA (belleza) =================
  {
    slug: "demo-salon-elegance-cr",
    nombre: "Salón Elegance CR",
    categoria: "belleza",
    provincia: "San José",
    canton: "Escazú",
    descripcion: "Peluquería de barrio con estilistas de trayectoria: cortes, color y tratamientos.",
    descripcion_larga:
      "En Salón Elegance combinamos técnica y trato cercano: corte, color, alisados y peinados para el día a día o para una ocasión especial. Trabajamos con productos profesionales y siempre con cita previa para que no esperés ni un minuto de más. Elegí tu estilista de confianza o reservá con cualquiera disponible.",
    contacto_whatsapp: "+506 8712-4501",
    amenidades: ["parqueo", "wifi_clientes", "aire_acondicionado", "pago_tarjeta"],
    foto_url: unsplash("photo-1560066984-138dadb4c035"),
    fotos: [
      unsplash("photo-1560066984-138dadb4c035"),
      unsplash("photo-1522337660859-02fbefca4702"),
      unsplash("photo-1522336572468-97b06e8ef143"),
      unsplash("photo-1503951914875-452162b0f3f1"),
    ],
    horario: horarioSemana({ lunAVie: { abre: "09:00", cierra: "19:00" }, sabado: { abre: "08:00", cierra: "17:00" } }),
    equipo: [
      miembro("Karla Vindas", "Estilista senior · Color y corte", "photo-1544005313-94ddf0286df2"),
      miembro("Josué Araya", "Estilista · Corte y peinado", "photo-1500648767791-00dcc994a43e", 1),
      miembro("Fabiola Solano", "Colorista y tratamientos", "photo-1534528741775-53994a69daeb"),
    ],
    servicios: [
      servicio("Cortes", "Corte dama", 12000, 45, 10, "Incluye lavado y secado con brushing."),
      servicio("Cortes", "Corte caballero", 6000, 30, 10, "Corte a tijera y máquina, incluye barba de cortesía."),
      servicio("Cortes", "Corte y barba (definición)", 8000, 40, 10, "Corte de cabello más perfilado y definición de barba."),
      servicio("Peinados y tratamientos", "Lavado + peinado", 8000, 40, 10, "Lavado con productos profesionales y brushing."),
      servicio("Peinados y tratamientos", "Peinado para evento", 25000, 60, 15, "Recogido u ondas para bodas, graduaciones y fiestas.", { foto_url: unsplash("photo-1503951914875-452162b0f3f1") }),
      servicio("Peinados y tratamientos", "Tratamiento capilar profundo", 15000, 45, 10, "Hidratación o reconstrucción según el diagnóstico capilar."),
      servicio("Color y alisado", "Color completo", 35000, 120, 15, "Aplicación de color de raíz a puntas, un solo tono.", { foto_url: unsplash("photo-1522336572468-97b06e8ef143") }),
      servicio("Color y alisado", "Mechas / balayage", 55000, 150, 20, "Técnica de iluminación en mechón o degradado natural."),
      servicio("Color y alisado", "Alisado / keratina", 45000, 150, 20, "Tratamiento alisador que dura entre 3 y 4 meses."),
    ],
  },

  // ================= SALA DE MASAJES (spa) =================
  {
    slug: "demo-zen-spa-masajes",
    nombre: "Zen Spa & Masajes",
    categoria: "spa",
    provincia: "Heredia",
    canton: "San Rafael",
    descripcion: "Sala de masajes y bienestar: relajante, tejido profundo, piedras calientes y faciales.",
    descripcion_larga:
      "Zen es un espacio pensado para desconectar: salas privadas, aromaterapia y terapeutas certificados. Ofrecemos masajes relajantes y de tejido profundo, piedras calientes, reflexología y faciales hidratantes. Reservá tu hora exacta y llegá 10 minutos antes para disfrutar la sala de espera.",
    contacto_whatsapp: "+506 8712-4502",
    amenidades: ["parqueo", "aire_acondicionado", "espacio_espera", "pago_tarjeta"],
    foto_url: unsplash("photo-1544161515-4ab6ce6db874"),
    fotos: [
      unsplash("photo-1544161515-4ab6ce6db874"),
      unsplash("photo-1540555700478-4be289fbecef"),
      unsplash("photo-1519823551278-64ac92734fb1"),
      unsplash("photo-1600334129128-685c5582fd35"),
    ],
    horario: horarioSemana({ lunAVie: { abre: "09:00", cierra: "18:00" }, sabado: { abre: "09:00", cierra: "15:00" } }),
    equipo: [
      miembro("Andrés Chinchilla", "Masajista terapeuta", "photo-1507003211169-0a1dd7228f2d"),
      miembro("Melissa Rojas", "Masajista y esteticista", "photo-1531123897727-8f129e1688ce", 6),
    ],
    servicios: [
      servicio("Masajes", "Masaje relajante 60 min", 28000, 60, 15, "Masaje sueco con aceites esenciales a elección.", { foto_url: unsplash("photo-1544161515-4ab6ce6db874") }),
      servicio("Masajes", "Masaje relajante 90 min", 38000, 90, 15, "La versión extendida, con más tiempo en espalda y piernas."),
      servicio("Masajes", "Masaje de tejido profundo", 32000, 60, 15, "Presión firme para tensión muscular y contracturas."),
      servicio("Masajes", "Masaje con piedras calientes", 35000, 75, 15, "Piedras volcánicas templadas para soltar la musculatura.", { foto_url: unsplash("photo-1540555700478-4be289fbecef") }),
      servicio("Faciales y corporal", "Facial hidratante", 25000, 50, 10, "Limpieza, exfoliación e hidratación profunda de rostro."),
      servicio("Faciales y corporal", "Exfoliación corporal", 30000, 60, 15, "Exfoliación de cuerpo completo con sales y aceites."),
      servicio("Faciales y corporal", "Reflexología podal", 18000, 45, 10, "Masaje terapéutico en pies por puntos de presión."),
      servicio("Faciales y corporal", "Ritual de spa (facial + masaje)", 55000, 120, 20, "Combo de facial hidratante y masaje relajante de 60 min.", { foto_url: unsplash("photo-1519823551278-64ac92734fb1") }),
    ],
  },

  // ================= SALÓN DE UÑAS (unas) =================
  {
    slug: "demo-nails-studio-cr",
    nombre: "Nails Studio CR",
    categoria: "unas",
    provincia: "Cartago",
    canton: "Cartago",
    descripcion: "Manicure, pedicure y uñas acrílicas con diseño — higiene y materiales esterilizados.",
    descripcion_larga:
      "En Nails Studio cuidamos cada detalle: instrumental esterilizado por clienta, esmaltado en gel de larga duración y nail art a mano alzada. Hacemos manicure y pedicure clásico o en gel, uñas acrílicas esculpidas y retiro seguro de gel o acrílico anterior. Reservá tu hora y elegí el diseño en el salón.",
    contacto_whatsapp: "+506 8712-4503",
    amenidades: ["wifi_clientes", "aire_acondicionado", "pago_tarjeta", "acceso_silla_ruedas"],
    foto_url: unsplash("photo-1604654894610-df63bc536371"),
    fotos: [
      unsplash("photo-1604654894610-df63bc536371"),
      unsplash("photo-1610992015732-2449b76344bc"),
      unsplash("photo-1519014816548-bf5fe059798b"),
      unsplash("photo-1607779097040-26e80aa78e66"),
    ],
    horario: horarioSemana({ lunAVie: { abre: "09:00", cierra: "19:00" }, sabado: { abre: "08:00", cierra: "17:00" } }),
    equipo: [
      miembro("Priscilla Mora", "Manicurista senior", "photo-1573497019940-1c28c88b4f3e"),
      miembro("Génesis Vargas", "Manicurista y nail art", "photo-1544725176-7c40e5a71c5e", 1),
    ],
    servicios: [
      servicio("Manicure", "Manicure clásica", 6000, 45, 10, "Limado, cutícula y esmaltado tradicional.", { foto_url: unsplash("photo-1604654894610-df63bc536371") }),
      servicio("Manicure", "Manicure en gel", 10000, 60, 10, "Esmaltado en gel de larga duración, hasta 3 semanas."),
      servicio("Manicure", "Manicure + pedicure combo", 16000, 90, 15, "Las dos manos y pies en una sola cita."),
      servicio("Pedicure", "Pedicure spa", 12000, 60, 15, "Exfoliación, masaje e hidratación de pies."),
      servicio("Acrílicas y diseño", "Uñas acrílicas esculpidas", 18000, 90, 15, "Extensión completa esculpida a la medida.", { foto_url: unsplash("photo-1610992015732-2449b76344bc") }),
      servicio("Acrílicas y diseño", "Retiro de gel/acrílico", 3000, 20, 5, "Retiro seguro sin dañar la uña natural."),
      servicio("Acrílicas y diseño", "Diseño / nail art (por uña)", 1500, 15, 0, "Decorado a mano alzada, pedrería o francesa.", { foto_url: unsplash("photo-1519014816548-bf5fe059798b") }),
    ],
  },
];

// ---------- Upsert ----------

async function sembrar() {
  console.log("Seed demo CITAS →", URL_SUPABASE);
  const ownerId = await asegurarOwner();
  console.log("· Owner:", CORREO_DEMO, "→", ownerId);

  for (const n of NEGOCIOS) {
    const precioDesde = Math.min(...n.servicios.map((s) => s.precio));
    const fila = {
      owner_id: ownerId,
      vertical: "citas",
      estado: "aprobado",
      slug: n.slug,
      nombre: n.nombre,
      categoria: n.categoria,
      provincia: n.provincia,
      canton: n.canton,
      descripcion: n.descripcion,
      descripcion_larga: n.descripcion_larga,
      contacto_whatsapp: n.contacto_whatsapp,
      amenidades: n.amenidades,
      foto_url: n.foto_url,
      fotos: n.fotos,
      precio_desde: precioDesde,
      detalles: { demo: true, horario_citas: n.horario },
    };

    // ¿Ya existe este slug?
    const { data: existente, error: errSel } = await db
      .from("ranchos")
      .select("id, estado")
      .eq("slug", n.slug)
      .maybeSingle();
    if (errSel) throw new Error(`select ${n.slug}: ${errSel.message}`);

    let ranchoId;
    if (existente && existente.estado !== "aprobado") {
      const { error: errDel } = await db.from("ranchos").delete().eq("id", existente.id);
      if (errDel) throw new Error(`delete ${n.slug}: ${errDel.message}`);
      console.log(`· ${n.slug} estaba '${existente.estado}' — recreado`);
    }

    if (existente && existente.estado === "aprobado") {
      const { estado: _estado, ...sinEstado } = fila; // el trigger lo revertiría igual
      const { error: errUpd } = await db.from("ranchos").update(sinEstado).eq("id", existente.id);
      if (errUpd) throw new Error(`update ${n.slug}: ${errUpd.message}`);
      ranchoId = existente.id;
    } else {
      const { data: creado, error: errIns } = await db
        .from("ranchos")
        .insert(fila)
        .select("id")
        .single();
      if (errIns) throw new Error(`insert ${n.slug}: ${errIns.message}`);
      ranchoId = creado.id;
    }

    // Equipo: se regenera completo. Cascada se lleva sus horarios_recurso
    // y servicios_recurso viejos.
    const { error: errDelEquipo } = await db.from("equipo_rancho").delete().eq("rancho_id", ranchoId);
    if (errDelEquipo) throw new Error(`delete equipo ${n.slug}: ${errDelEquipo.message}`);

    const filasEquipo = n.equipo.map((m, i) => ({
      rancho_id: ranchoId,
      nombre: m.nombre,
      rol: m.rol,
      foto_url: m.foto_url,
      activo: m.activo,
      orden: i + 1,
    }));
    const { data: equipoCreado, error: errEquipo } = await db
      .from("equipo_rancho")
      .insert(filasEquipo)
      .select("id, nombre");
    if (errEquipo) throw new Error(`insert equipo ${n.slug}: ${errEquipo.message}`);

    // Horario propio: solo para quien tiene día libre — el resto hereda
    // el horario del negocio (sin filas = herencia, 0061).
    const filasHorario = [];
    n.equipo.forEach((m, i) => {
      if (m.diaLibre === undefined) return;
      const miembroId = equipoCreado.find((e) => e.nombre === m.nombre)?.id ?? equipoCreado[i]?.id;
      filasHorario.push({
        miembro_id: miembroId,
        dow: m.diaLibre,
        abre: RANGO_LIBRE.abre,
        cierra: RANGO_LIBRE.cierra,
      });
    });
    if (filasHorario.length > 0) {
      const { error: errHorario } = await db.from("horarios_recurso").insert(filasHorario);
      if (errHorario) throw new Error(`insert horarios ${n.slug}: ${errHorario.message}`);
    }

    // Catálogo: se regenera completo (idempotente).
    const { error: errDelItems } = await db.from("rancho_items").delete().eq("rancho_id", ranchoId);
    if (errDelItems) throw new Error(`delete items ${n.slug}: ${errDelItems.message}`);

    const filasItems = n.servicios.map((s, i) => ({ ...s, rancho_id: ranchoId, orden: i + 1 }));
    const { error: errItems } = await db.from("rancho_items").insert(filasItems);
    if (errItems) throw new Error(`insert items ${n.slug}: ${errItems.message}`);

    const accion = existente ? "actualizado" : "creado";
    console.log(
      `· ${accion}  ${n.slug}  (${n.categoria})  — ${n.equipo.length} del equipo, ${n.servicios.length} servicios`,
    );
  }

  // ---------- Verificación ----------
  const slugs = NEGOCIOS.map((n) => n.slug);
  const { data: verif, error: errVerif } = await db
    .from("ranchos")
    .select("id, slug, nombre, categoria, estado, vertical, rancho_items(count), equipo_rancho(count)")
    .in("slug", slugs)
    .order("categoria");
  if (errVerif) throw new Error("verificación: " + errVerif.message);

  console.log("\n=== Verificación en la base ===");
  for (const r of verif) {
    const items = Array.isArray(r.rancho_items) ? (r.rancho_items[0]?.count ?? 0) : 0;
    const equipo = Array.isArray(r.equipo_rancho) ? (r.equipo_rancho[0]?.count ?? 0) : 0;
    console.log(
      `  ${r.estado === "aprobado" ? "✓" : "✗"} [${r.categoria}] ${r.slug} · "${r.nombre}" · ${r.estado} · vertical=${r.vertical} · ${equipo} del equipo · ${items} servicios`,
    );
  }
  const ok = verif.length === NEGOCIOS.length && verif.every((r) => r.estado === "aprobado");
  console.log(
    ok
      ? `\nListo: ${verif.length}/${NEGOCIOS.length} negocios demo de Citas aprobados, con equipo y catálogo.`
      : `\nOJO: quedaron ${verif.length}/${NEGOCIOS.length} y alguno no está aprobado — revisá arriba.`,
  );
  console.log(`\nDueño de los 3: ${CORREO_DEMO} / ${PASSWORD_DEMO}`);
  if (!ok) process.exitCode = 1;
}

sembrar().catch((e) => {
  console.error("\nEl seed falló:", e.message);
  process.exit(1);
});
