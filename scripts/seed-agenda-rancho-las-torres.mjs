/**
 * Agenda REAL de Rancho Las Torres — agosto a diciembre 2026.
 *
 * Pasa a la plataforma la agenda que estaba en papel. No es demo: son
 * reservas de verdad, por eso van con origen "manual" (entraron por
 * teléfono o en persona, no por la web) y sin marca detalles.demo.
 *
 * Criterios usados al transcribir:
 *  · El adelanto es ₡20.000 en todas — sale de (monto_total − saldo),
 *    que da 20.000 parejo en cada línea de la agenda. Se carga como
 *    depósito ya recibido (deposito_validado = true).
 *  · TODAS las fechas con cliente quedan "confirmada" — por decisión del
 *    dueño: primero se aparta el día, los montos y los datos que falten
 *    se corrigen después una por una. Incluye las que la agenda dejó
 *    dudosas (lápiz, sin monto, con nota de cancelación); en esas la
 *    nota dice exactamente qué falta cerrar con el cliente.
 *  · "Bebe" (4 y 5 de diciembre) queda "bloqueada": son días apartados
 *    sin cliente ni monto, así no cuentan como evento en los totales.
 *    Bloquean la fecha igual que una confirmada. Son dos filas.
 *  · horario_bloque guarda el rango tal cual lo anotó el dueño, con el
 *    mismo formato que usa la web (ver formatearHora en mi-negocio/types).
 *  · tipo_evento, contacto, correo y whatsapp van en null: la agenda de
 *    papel no los traía y no se inventan.
 *
 * Idempotente: borra las reservas manuales previas de este rancho en el
 * rango sembrado antes de insertar, así se puede correr varias veces.
 *
 * Uso:  node scripts/seed-agenda-rancho-las-torres.mjs
 *       node scripts/seed-agenda-rancho-las-torres.mjs --dry
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
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = leerEnvLocal();
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const SOLO_VISTA = process.argv.includes("--dry");

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SLUG = "rancholastorres";
const ADELANTO = 20000;

// ---------- Formato de horas igual al de la web ----------

/** "19:30" → "7:30 p.m."  (mismo criterio que formatearHora) */
function formatearHora(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const sufijo = h < 12 ? "a.m." : "p.m.";
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** Cuántas horas dura el rango; cruza medianoche si hace falta. */
function duracionHoras(desde, hasta) {
  const [hd, md] = desde.split(":").map(Number);
  const [hh, mh] = hasta.split(":").map(Number);
  let minutos = hh * 60 + mh - (hd * 60 + md);
  if (minutos <= 0) minutos += 24 * 60;
  return Math.round((minutos / 60) * 10) / 10;
}

function horario(desde, hasta) {
  return { texto: `${formatearHora(desde)} – ${formatearHora(hasta)}`, horas: duracionHoras(desde, hasta) };
}

// ---------- La agenda ----------
//
// total  = lo que vale el evento, tal como está anotado
// saldo  = lo que faltaba por cobrar; el adelanto sale de la resta
// desde/hasta en 24h; null cuando la agenda no anotó horario

const AGENDA = [
  // ===================== AGOSTO 2026 =====================
  { fecha: "2026-08-01", nombre: "Katherine Murillo", invitados: 60, desde: "15:00", hasta: "00:00", total: 180000, saldo: 160000, estado: "confirmada" },
  { fecha: "2026-08-02", nombre: "Hilary Mondragón", invitados: 40, desde: "08:00", hasta: "17:00", total: 140000, saldo: 120000, estado: "confirmada" },
  { fecha: "2026-08-08", nombre: "Wendy Ríos Jiménez", invitados: 60, desde: "15:00", hasta: "00:00", total: 180000, saldo: 160000, estado: "confirmada" },
  { fecha: "2026-08-09", nombre: "Alejandro Castro", invitados: 50, desde: "09:00", hasta: "18:00", total: 150000, saldo: 130000, estado: "confirmada" },
  { fecha: "2026-08-16", nombre: "Jennifer Alfaro", invitados: 25, desde: "12:00", hasta: "21:00", total: 80000, saldo: 60000, estado: "confirmada" },
  { fecha: "2026-08-22", nombre: "Karla Salgado", invitados: 20, desde: "08:00", hasta: "13:00", total: 90000, saldo: 70000, estado: "confirmada" },
  { fecha: "2026-08-29", nombre: "Valeria Gómez", invitados: 25, desde: "08:00", hasta: "17:00", total: 80000, saldo: 60000, estado: "confirmada" },

  // ===================== SETIEMBRE 2026 =====================
  { fecha: "2026-09-12", nombre: "Andrés Fernández", invitados: 90, desde: "08:00", hasta: "17:00", total: 270000, saldo: 250000, estado: "confirmada" },
  {
    fecha: "2026-09-13",
    nombre: "Randall",
    invitados: 40,
    total: null,
    saldo: null,
    estado: "confirmada",
    notas:
      "FALTA EL MONTO. Anotado en lápiz en la agenda, parece tentativo. Falta confirmar el apellido, si las 40 personas son firmes y cuánto se cobra.",
  },
  {
    fecha: "2026-09-19",
    nombre: "Gina / Erika",
    invitados: null,
    total: null,
    saldo: null,
    adelanto: 20000,
    estado: "confirmada",
    notas:
      "FALTA EL MONTO Y LAS PERSONAS. En la agenda solo aparece el abono de ₡20.000. Tampoco está claro si la reserva es de Gina o de Erika.",
  },
  { fecha: "2026-09-20", nombre: "Erika Valverde", invitados: 25, total: 100000, saldo: 80000, estado: "confirmada" },

  // ===================== OCTUBRE 2026 =====================
  {
    fecha: "2026-10-23",
    nombre: "Erika",
    invitados: null,
    total: null,
    saldo: null,
    estado: "confirmada",
    notas:
      "FALTA EL MONTO Y LAS PERSONAS. En la agenda solo dice \"Erika\". Falta confirmar si es la misma Erika Valverde del 20 de setiembre.",
  },

  // ===================== NOVIEMBRE 2026 =====================
  {
    fecha: "2026-11-08",
    nombre: "Yerlyn Lara",
    invitados: 55,
    total: 150000,
    saldo: 130000,
    estado: "confirmada",
    notas: "El nombre está poco legible en la agenda — confirmar que sea \"Yerlyn Lara\".",
  },
  {
    fecha: "2026-11-14",
    nombre: "Haydy Calvo",
    invitados: 35,
    desde: "10:00",
    hasta: "19:00",
    total: 120000,
    saldo: 100000,
    estado: "confirmada",
    notas: "La agenda tiene la nota \"seguro\". El nombre está poco legible — confirmar que sea \"Haydy Calvo\".",
  },
  {
    fecha: "2026-11-20",
    nombre: "Cinthia Soto",
    invitados: 50,
    desde: "18:30",
    hasta: "21:00",
    total: 100000,
    saldo: 80000,
    estado: "confirmada",
    notas: "El horario en la agenda se lee \"6:30 a 9 p.m.\" pero no está del todo claro — confirmar con la clienta.",
  },

  // ===================== DICIEMBRE 2026 =====================
  {
    fecha: "2026-12-04",
    nombre: "Bebe",
    invitados: null,
    total: null,
    saldo: null,
    estado: "bloqueada",
    notas: "Día apartado en la agenda como \"Bebe\", sin monto. Bloqueado 4 y 5 de diciembre.",
  },
  {
    fecha: "2026-12-05",
    nombre: "Bebe",
    invitados: null,
    total: null,
    saldo: null,
    estado: "bloqueada",
    notas: "Día apartado en la agenda como \"Bebe\", sin monto. Bloqueado 4 y 5 de diciembre.",
  },
  {
    fecha: "2026-12-18",
    nombre: "Adrián Solano",
    invitados: 85,
    desde: "10:00",
    hasta: "21:00",
    total: 280000,
    saldo: 260000,
    estado: "confirmada",
    notas:
      "OJO: la agenda tiene una flecha hacia una nota que dice \"cancelaron\". Queda confirmada para apartar la fecha, pero HAY QUE VERIFICAR con el cliente si sigue en pie. Además del total de ₡280.000 había anotado un adicional de ₡10.000 (quedaría en ₡290.000).",
  },
];

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// ---------- Siembra ----------

async function sembrar() {
  console.log("Seed agenda REAL · Rancho Las Torres →", env.NEXT_PUBLIC_SUPABASE_URL);
  if (SOLO_VISTA) console.log("(--dry: no se escribe nada)\n");

  const { data: rancho, error: errRancho } = await db
    .from("ranchos")
    .select("id, nombre, categoria, capacidad_min, capacidad_max, eventos_por_dia")
    .eq("slug", SLUG)
    .single();
  if (errRancho) throw new Error("rancho: " + errRancho.message);
  console.log(
    `· ${rancho.nombre} (${rancho.id}) · capacidad ${rancho.capacidad_min}–${rancho.capacidad_max} · ${rancho.eventos_por_dia} evento/día\n`,
  );

  // Avisos de consistencia antes de escribir.
  const avisos = [];
  const porFecha = new Map();
  for (const a of AGENDA) {
    if (a.invitados && rancho.capacidad_max && a.invitados > rancho.capacidad_max)
      avisos.push(`${a.fecha} ${a.nombre}: ${a.invitados} personas supera la capacidad (${rancho.capacidad_max}).`);
    if (a.total != null && a.saldo != null && a.total - a.saldo !== ADELANTO)
      avisos.push(`${a.fecha} ${a.nombre}: total − saldo = ₡${(a.total - a.saldo).toLocaleString("es-CR")}, no ₡20.000.`);
    const yaConfirmada = porFecha.get(a.fecha);
    if (yaConfirmada && a.estado === "confirmada" && yaConfirmada === "confirmada")
      avisos.push(`${a.fecha}: dos reservas confirmadas el mismo día — el cupo es 1.`);
    porFecha.set(a.fecha, a.estado);
  }
  if (avisos.length) {
    console.log("AVISOS:");
    for (const x of avisos) console.log("  ! " + x);
    console.log("");
  }

  const fechas = AGENDA.map((a) => a.fecha).sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];

  const filas = AGENDA.map((a) => {
    const h = a.desde && a.hasta ? horario(a.desde, a.hasta) : null;
    const adelanto = a.adelanto ?? (a.total != null && a.saldo != null ? a.total - a.saldo : null);
    const cobrado = a.estado === "confirmada" || a.estado === "pendiente";
    return {
      rancho_id: rancho.id,
      fecha: a.fecha,
      nombre: a.nombre,
      estado: a.estado,
      origen: "manual",
      invitados: a.invitados ?? null,
      monto_total: a.total ?? null,
      deposito_monto: cobrado ? adelanto : null,
      deposito_validado: cobrado && adelanto != null,
      evento_pagado: false,
      horario_bloque: h ? h.texto : null,
      duracion_horas: h ? h.horas : null,
      notas: a.notas ?? null,
      tipo_evento: null,
      contacto: null,
      terminos_aceptados: true,
      aviso_prohibiciones_aceptado: true,
    };
  });

  if (SOLO_VISTA) {
    for (const f of filas) console.log("  " + JSON.stringify(f));
    return { rancho, filas: [] };
  }

  // Idempotencia: se limpian las manuales previas de este rancho en el rango.
  const { data: previas } = await db
    .from("reservas")
    .select("id")
    .eq("rancho_id", rancho.id)
    .eq("origen", "manual")
    .gte("fecha", desde)
    .lte("fecha", hasta);
  if (previas && previas.length) {
    await db.from("reservas").delete().in("id", previas.map((p) => p.id));
    console.log(`· ${previas.length} reservas manuales previas del rango borradas (idempotencia)\n`);
  }

  // Una por una: el disparador de cupo levanta 23505 y así se ve cuál falló.
  // Las 'confirmada' se insertan pendiente y se confirman con un update,
  // igual que hace crearReservaManual (la política solo deja crear en
  // pendiente/temporal y así el disparador corre en el update).
  const ahora = new Date().toISOString();
  for (const fila of filas) {
    const objetivo = fila.estado;
    const inicial = objetivo === "confirmada" ? "pendiente" : objetivo;
    const { data: creada, error } = await db
      .from("reservas")
      .insert({
        ...fila,
        estado: inicial,
        deposito_pagado_en: fila.deposito_validado ? ahora : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`${fila.fecha} ${fila.nombre}: ${error.message}`);

    if (objetivo !== inicial) {
      const { error: errUpd } = await db.from("reservas").update({ estado: objetivo }).eq("id", creada.id);
      if (errUpd) throw new Error(`${fila.fecha} ${fila.nombre} (confirmar): ${errUpd.message}`);
    }
  }

  return { rancho, filas };
}

// ---------- Verificación y desglose ----------

const col = (s, n) => String(s ?? "").padEnd(n).slice(0, n);
const money = (n) => (n == null ? "—" : "₡" + Number(n).toLocaleString("es-CR"));

async function mostrar(ranchoId) {
  const { data, error } = await db
    .from("reservas")
    .select("fecha, nombre, invitados, estado, monto_total, deposito_monto, deposito_validado, horario_bloque, duracion_horas, origen, notas")
    .eq("rancho_id", ranchoId)
    .order("fecha");
  if (error) throw new Error("verificación: " + error.message);

  console.log("\n=== AGENDA DE RANCHO LAS TORRES EN LA BASE ===\n");
  let mesActual = "";
  for (const r of data) {
    const [y, m, d] = r.fecha.split("-").map(Number);
    const mes = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-CR", { month: "long", year: "numeric", timeZone: "UTC" });
    if (mes !== mesActual) {
      mesActual = mes;
      console.log(`\n── ${mes.toUpperCase()} ──`);
      console.log(
        "  " + col("Fecha", 16) + col("Cliente", 22) + col("Pers.", 6) + col("Horario", 26) + col("Total", 12) + col("Adelanto", 11) + col("Saldo", 12) + "Estado",
      );
    }
    const dia = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    const saldo = r.monto_total != null ? r.monto_total - (r.deposito_monto ?? 0) : null;
    console.log(
      "  " +
        col(`${dia.slice(0, 3)} ${d}`, 16) +
        col(r.nombre, 22) +
        col(r.invitados ?? "—", 6) +
        col(r.horario_bloque ?? "—", 26) +
        col(money(r.monto_total), 12) +
        col(money(r.deposito_monto), 11) +
        col(money(saldo), 12) +
        r.estado,
    );
    if (r.notas) console.log("        ↳ " + r.notas);
  }

  // Totales
  const conf = data.filter((r) => r.estado === "confirmada");
  const pend = data.filter((r) => r.estado === "pendiente");
  const bloq = data.filter((r) => r.estado === "bloqueada");
  const suma = (l, k) => l.reduce((a, r) => a + (r[k] ?? 0), 0);

  console.log("\n=== RESUMEN ===");
  console.log(`  Confirmadas: ${conf.length}   Pendientes: ${pend.length}   Bloqueadas: ${bloq.length}   Total filas: ${data.length}`);
  console.log(`  Facturación confirmada:  ${money(suma(conf, "monto_total"))}`);
  console.log(`  Adelantos ya recibidos:  ${money(suma(data, "deposito_monto"))}`);
  console.log(`  Saldo por cobrar (conf): ${money(suma(conf, "monto_total") - suma(conf, "deposito_monto"))}`);
  console.log(`  Personas confirmadas:    ${suma(conf, "invitados")}`);

  console.log("\n  Por mes (solo confirmadas):");
  const meses = {};
  for (const r of conf) {
    const k = r.fecha.slice(0, 7);
    meses[k] = meses[k] || { n: 0, monto: 0, pers: 0 };
    meses[k].n++;
    meses[k].monto += r.monto_total ?? 0;
    meses[k].pers += r.invitados ?? 0;
  }
  for (const [k, v] of Object.entries(meses).sort())
    console.log(`    ${k}: ${v.n} evento(s) · ${money(v.monto)} · ${v.pers} personas`);
}

const { rancho } = await sembrar();
if (!SOLO_VISTA) await mostrar(rancho.id);
