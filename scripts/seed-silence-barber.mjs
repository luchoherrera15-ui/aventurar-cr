/**
 * SIEMBRA: SILENCE BARBER SHOP.
 *
 * Una barbería completa y creíble en la cuenta del dueño, para poder
 * ver el CRM de citas con datos que se parecen a los de verdad.
 *
 *   node scripts/seed-silence-barber.mjs           ← siembra
 *   node scripts/seed-silence-barber.mjs --borrar  ← la quita entera
 *
 * ------------------------------------------------------------------
 * POR QUÉ SE SIEMBRAN CITAS Y NO "CLIENTES"
 * ------------------------------------------------------------------
 * El CRM de citas NO lee una tabla de clientes: la ficha de cada
 * persona se DERIVA de sus reservas (`agruparClientes` en
 * src/lib/crm-citas.ts). Sembrar una tabla de clientes dejaría el CRM
 * igual de vacío que antes.
 *
 * Por eso lo que se siembra son CITAS repartidas en el tiempo, con sus
 * estados reales (cumplida, no asistió, cancelada, confirmada). De ahí
 * salen solos los clientes frecuentes, los inactivos, los que faltan
 * seguido y el gasto acumulado.
 *
 * ------------------------------------------------------------------
 * ES DATO SEMBRADO Y SE DECLARA
 * ------------------------------------------------------------------
 * El negocio queda marcado con `detalles.demo = true`, igual que los
 * otros sembrados. Sin esa marca, el día que haya que limpiar la base
 * o cuadrar ingresos, nadie sabría distinguir esta barbería de un
 * cliente que paga.
 *
 * Las fechas se calculan hacia atrás desde HOY, así que el CRM siempre
 * tiene alguien "inactivo hace 70 días" sin importar cuándo se corra.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const CORREO_DUENO = "luchoherrera15@gmail.com";
const NOMBRE = "SILENCE BARBER SHOP";
const SLUG = "silencebarbershop";
const IMAGEN = path.join("boda", "barberia.jpeg");

// ── El entorno ────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BORRAR = process.argv.includes("--borrar");

// ── Fechas relativas a hoy, en hora de Costa Rica ─────────────────
const hoyCR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(
  new Date(),
);
function diaRelativo(dias) {
  const [a, m, d] = hoyCR.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

/**
 * Azar REPRODUCIBLE: correr el seed dos veces tiene que dar los mismos
 * datos. Con Math.random, cada corrida daría otro negocio y sería
 * imposible comparar una pantalla contra la anterior.
 */
let semilla = 20260813;
function rnd() {
  semilla = (semilla * 1103515245 + 12345) % 2147483648;
  return semilla / 2147483648;
}
const elegir = (lista) => lista[Math.floor(rnd() * lista.length)];

/**
 * Elige un servicio con PESO, no al azar parejo.
 *
 * En una barbería de verdad la mayoría de las visitas son corte; las
 * cejas y los contornos son el extra que se agrega de vez en cuando.
 * Con azar uniforme se venden tantas cejas de ₡2.000 como cortes de
 * ₡10.000, el ticket promedio se desploma y las métricas que uno
 * quiere evaluar terminan describiendo un negocio que no existe.
 */
function elegirServicio(items, pesos) {
  const total = items.reduce((t, it) => t + (pesos[it.nombre] ?? 1), 0);
  let r = rnd() * total;
  for (const it of items) {
    r -= pesos[it.nombre] ?? 1;
    if (r <= 0) return it;
  }
  return items[0];
}

/** Cuántas de cada 100 visitas es cada servicio. */
const PESO_SERVICIO = {
  "Corte Premium": 42,
  "Corte + Barba": 28,
  "Corte Niño": 12,
  "Contornos": 9,
  "Cejas": 5,
  "Limpieza Facial": 4,
};

// ── El catálogo, tal como lo dio el dueño ─────────────────────────
const SERVICIOS = [
  { nombre: "Corte Premium", precio: 7000, minutos: 45, descripcion: "Corte a tijera y máquina, lavado y peinado." },
  { nombre: "Corte + Barba", precio: 10000, minutos: 60, descripcion: "Corte completo más perfilado y toalla caliente." },
  { nombre: "Contornos", precio: 3000, minutos: 20, descripcion: "Retoque de contornos y patillas entre cortes." },
  { nombre: "Cejas", precio: 2000, minutos: 15, descripcion: "Perfilado de cejas a navaja." },
  { nombre: "Limpieza Facial", precio: 8000, minutos: 45, descripcion: "Limpieza profunda con vapor y extracción." },
  { nombre: "Corte Niño", precio: 5000, minutos: 30, descripcion: "Corte para menores de 12, con paciencia incluida." },
];

const BARBEROS = [
  { nombre: "Kevin Mora", rol: "Barbero principal · Fades y diseño" },
  { nombre: "Andrés Quesada", rol: "Barbero · Barba y contornos" },
];

/**
 * Los clientes. `cada` es cada cuántos días vuelve y `fallas` cuántas
 * de sus últimas citas no atendió — así el CRM tiene de todo: el
 * frecuente, el que se enfrió, el que falta seguido y el nuevo.
 */
const CLIENTES = [
  { nombre: "Luis Herrera", tel: "83633805", cada: 21, desde: 200, fallas: 0 },
  { nombre: "Diego Ramírez", tel: "87451209", cada: 15, desde: 180, fallas: 0 },
  { nombre: "Josué Campos", tel: "86120934", cada: 28, desde: 170, fallas: 0 },
  { nombre: "Randall Chaves", tel: "88903412", cada: 30, desde: 160, fallas: 2 },
  { nombre: "Steven Vargas", tel: "85512377", cada: 45, desde: 150, fallas: 0 },
  { nombre: "Marco Jiménez", tel: "84409981", cada: 25, desde: 140, fallas: 1 },
  { nombre: "Fabián Rojas", tel: "87001245", cada: 35, desde: 130, fallas: 0 },
  { nombre: "Alonso Picado", tel: "86773310", cada: 60, desde: 120, fallas: 0 },
  { nombre: "Bryan Solís", tel: "88123409", cada: 40, desde: 110, fallas: 0 },
  { nombre: "Carlos Ureña", tel: "83345677", cada: 22, desde: 100, fallas: 0 },
  { nombre: "Gerardo Mena", tel: "89901234", cada: 90, desde: 95, fallas: 0 },
  { nombre: "Óscar Delgado", tel: "84567810", cada: 18, desde: 80, fallas: 0 },
  { nombre: "Emilio Castro", tel: "87788990", cada: 30, desde: 45, fallas: 0 },
  { nombre: "Adrián Núñez", tel: "86554433", cada: 20, desde: 20, fallas: 0 },
];

const HORAS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

// El horario del local: cerrado domingo, sábado corto.
const HORARIO = {
  0: null,
  1: { abre: "09:00", cierra: "19:00" },
  2: { abre: "09:00", cierra: "19:00" },
  3: { abre: "09:00", cierra: "19:00" },
  4: { abre: "09:00", cierra: "19:00" },
  5: { abre: "09:00", cierra: "20:00" },
  6: { abre: "09:00", cierra: "17:00" },
};

async function borrarTodo(ranchoId) {
  // `on delete cascade` se lleva items, equipo y horarios. Las reservas
  // se borran aparte porque no cuelgan del rancho por cascada.
  await db.from("reservas").delete().eq("rancho_id", ranchoId);
  await db.from("ranchos").delete().eq("id", ranchoId);
  console.log("🗑  SILENCE BARBER SHOP eliminada por completo.");
}

async function main() {
  // ── El dueño ────────────────────────────────────────────────────
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const dueno = users.users.find((u) => u.email === CORREO_DUENO);
  if (!dueno) throw new Error(`No existe la cuenta ${CORREO_DUENO}.`);

  // ── ¿Ya estaba? ─────────────────────────────────────────────────
  const { data: previo } = await db.from("ranchos").select("id").eq("slug", SLUG).maybeSingle();
  if (previo) {
    await borrarTodo(previo.id);
    if (BORRAR) return;
    console.log("   (se vuelve a sembrar desde cero)");
  } else if (BORRAR) {
    console.log("No había nada que borrar.");
    return;
  }

  // ── La foto ─────────────────────────────────────────────────────
  let fotoUrl = null;
  if (fs.existsSync(IMAGEN)) {
    const ruta = `negocios/${SLUG}-${Date.now()}.jpeg`;
    const { error } = await db.storage
      .from("ranchos-fotos")
      .upload(ruta, fs.readFileSync(IMAGEN), { contentType: "image/jpeg", upsert: true });
    if (error) console.warn("⚠  No se pudo subir la foto:", error.message);
    else fotoUrl = db.storage.from("ranchos-fotos").getPublicUrl(ruta).data.publicUrl;
  } else {
    console.warn(`⚠  No encontré ${IMAGEN} — el negocio queda sin foto.`);
  }

  // ── El negocio ──────────────────────────────────────────────────
  const { data: rancho, error: errRancho } = await db
    .from("ranchos")
    .insert({
      owner_id: dueno.id,
      vertical: "citas",
      categoria: "barberia",
      nombre: NOMBRE,
      slug: SLUG,
      descripcion: "Barbería de barrio con cita previa: fades, barba y contornos.",
      descripcion_larga:
        "En SILENCE atendemos con cita para que nadie espere de pie. Fades, diseño, " +
        "perfilado de barba y limpieza facial, con productos de barbería y música que " +
        "no se pelea con la conversación.",
      provincia: "San José",
      canton: "Desamparados",
      pais: "CR",
      zona_horaria: "America/Costa_Rica",
      estado: "aprobado",
      precio_desde: 2000,
      contacto_whatsapp: "+506 8363-3805",
      foto_url: fotoUrl,
      fotos: fotoUrl ? [fotoUrl] : [],
      amenidades: ["parqueo", "wifi_clientes", "aire_acondicionado", "pago_tarjeta"],
      // La marca de dato sembrado y el horario del local (que es donde
      // lo guarda la vertical de citas, no en horarios_recurso).
      detalles: { demo: true, sembrado: "silence-barber", horario_citas: HORARIO },
    })
    .select("id")
    .single();
  if (errRancho) throw new Error("No se pudo crear el negocio: " + errRancho.message);
  const ranchoId = rancho.id;

  // ── Los servicios ───────────────────────────────────────────────
  const { data: items, error: errItems } = await db
    .from("rancho_items")
    .insert(
      SERVICIOS.map((s, i) => ({
        rancho_id: ranchoId,
        nombre: s.nombre,
        descripcion: s.descripcion,
        precio: s.precio,
        duracion_minutos: s.minutos,
        //  solo admite paquete|producto (0061): un servicio de
        // citas es un producto del catálogo — lo que lo vuelve
        // agendable es su duración, no una etiqueta aparte.
        tipo: "producto",
        activo: true,
        orden: i,
      })),
    )
    .select("id, nombre, precio, duracion_minutos");
  if (errItems) throw new Error("Servicios: " + errItems.message);

  // ── El equipo ───────────────────────────────────────────────────
  const { data: equipo, error: errEquipo } = await db
    .from("equipo_rancho")
    .insert(
      BARBEROS.map((b, i) => ({
        rancho_id: ranchoId,
        nombre: b.nombre,
        rol: b.rol,
        tipo: "profesional",
        activo: true,
        orden: i,
      })),
    )
    .select("id, nombre");
  if (errEquipo) throw new Error("Equipo: " + errEquipo.message);

  // Los dos barberos hacen de todo — es una barbería de dos sillas.
  await db.from("servicios_recurso").insert(
    equipo.flatMap((m) => items.map((it) => ({ item_id: it.id, miembro_id: m.id }))),
  );

  // El horario de cada barbero, que es el del local.
  await db.from("horarios_recurso").insert(
    equipo.flatMap((m) =>
      Object.entries(HORARIO)
        .filter(([, h]) => h)
        .map(([dow, h]) => ({
          miembro_id: m.id,
          dow: Number(dow),
          abre: h.abre,
          cierra: h.cierra,
        })),
    ),
  );

  // ── Las citas: de acá sale el CRM ───────────────────────────────
  const reservas = [];
  for (const c of CLIENTES) {
    // Cuántas veces vino desde que es cliente.
    const visitas = Math.max(1, Math.floor(c.desde / c.cada));
    let fallasPuestas = 0;

    for (let v = visitas; v >= 1; v--) {
      const diasAtras = v * c.cada - Math.floor(rnd() * 3);
      if (diasAtras <= 0) continue;

      const item = elegirServicio(items, PESO_SERVICIO);
      const barbero = elegir(equipo);

      // Las fallas se ponen en las citas MÁS RECIENTES: «faltó a sus
      // últimas dos» es la señal que el CRM usa para re-enganchar.
      let estado = "cumplida";
      if (fallasPuestas < c.fallas && v <= c.fallas) {
        estado = "no_asistio";
        fallasPuestas++;
      } else if (rnd() < 0.06) {
        estado = "cancelada";
      }

      const fecha = diaRelativo(-diasAtras);
      reservas.push({
        rancho_id: ranchoId,
        fecha,
        hora_inicio: elegir(HORAS),
        duracion_minutos: item.duracion_minutos,
        miembro_id: barbero.id,
        nombre: c.nombre,
        whatsapp: c.tel,
        contacto: c.tel,
        estado,
        monto_total: item.precio,
        tipo_evento: item.nombre,
        origen: "manual",
        detalle_pedido: { item_id: item.id, servicio: item.nombre },
        cumplida_en: estado === "cumplida" ? `${fecha}T18:00:00Z` : null,
        no_asistio_en: estado === "no_asistio" ? `${fecha}T18:00:00Z` : null,
        cancelada_en: estado === "cancelada" ? `${fecha}T08:00:00Z` : null,
      });
    }
  }

  // Citas por venir: la agenda de los próximos días.
  for (let i = 0; i < 9; i++) {
    const c = elegir(CLIENTES);
    const item = elegirServicio(items, PESO_SERVICIO);
    const barbero = elegir(equipo);
    const fecha = diaRelativo(1 + Math.floor(rnd() * 12));
    reservas.push({
      rancho_id: ranchoId,
      fecha,
      hora_inicio: elegir(HORAS),
      duracion_minutos: item.duracion_minutos,
      miembro_id: barbero.id,
      nombre: c.nombre,
      whatsapp: c.tel,
      contacto: c.tel,
      estado: "confirmada",
      monto_total: item.precio,
      tipo_evento: item.nombre,
      origen: "web",
      detalle_pedido: { item_id: item.id, servicio: item.nombre },
    });
  }

  // De a tandas: un insert de 200 filas se cae por tamaño de petición.
  for (let i = 0; i < reservas.length; i += 100) {
    const { error } = await db.from("reservas").insert(reservas.slice(i, i + 100));
    if (error) throw new Error("Reservas: " + error.message);
  }

  // ── Resumen ─────────────────────────────────────────────────────
  const cumplidas = reservas.filter((r) => r.estado === "cumplida");
  const ingreso = cumplidas.reduce((t, r) => t + Number(r.monto_total), 0);

  console.log(`\n✅ ${NOMBRE} sembrada`);
  console.log(`   negocio      ${ranchoId}`);
  console.log(`   servicios    ${items.length}`);
  console.log(`   barberos     ${equipo.length}`);
  console.log(`   clientes     ${CLIENTES.length}`);
  console.log(`   citas        ${reservas.length}`);
  console.log(`     cumplidas  ${cumplidas.length}`);
  console.log(`     no asistió ${reservas.filter((r) => r.estado === "no_asistio").length}`);
  console.log(`     canceladas ${reservas.filter((r) => r.estado === "cancelada").length}`);
  console.log(`     por venir  ${reservas.filter((r) => r.estado === "confirmada").length}`);
  console.log(`   facturado    ₡${ingreso.toLocaleString("es-CR")}`);
  console.log(`\n   panel   /mi-negocio/${ranchoId}/citas`);
  console.log(`   público /${SLUG}`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
