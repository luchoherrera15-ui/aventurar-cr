// ============================================================
// RECUPERACIÓN DEL LIBRO DE COBROS (migración 0106)
//
// El trigger `reservas_cobro_plataforma` solo dispara de acá en
// adelante: anota el cobro cuando una reserva CAMBIA a 'confirmada'.
// Todas las reservas que ya estaban confirmadas el día que se corrió la
// 0106 nunca pasaron por ese cambio, así que no tienen asiento y su
// plata no aparecería nunca en el libro. Este script las recupera.
//
// LA MISMA CUENTA QUE EL TRIGGER, A PROPÓSITO: tarifa propia del
// negocio (cobro_negocio) o el default global
// (configuracion_plataforma.comision_por_persona); mínimo una persona;
// membresía y gratis no cobran por reserva. Si algún día cambia el
// trigger, tiene que cambiar también acá — las reglas están todas
// juntas arriba, exportadas, y probadas en
// src/lib/cobro-plataforma.test.ts.
//
// EL SUPUESTO GRANDE — LA SEMANA:
//   `reservas` NO guarda cuándo se confirmó una reserva. El trigger usa
//   la semana en que ocurre la confirmación; acá lo más cercano que hay
//   es `created_at` (cuándo se creó la reserva), así que la semana de
//   lo recuperado sale de ahí. Para una reserva creada y confirmada el
//   mismo día da igual; para una que se creó en marzo y se confirmó en
//   mayo, este script la pone en la semana de marzo y el trigger la
//   habría puesto en la de mayo. Es una diferencia real y el script la
//   dice en pantalla. Las filas recuperadas quedan marcadas en `notas`
//   ("recuperado ...") para poder distinguirlas siempre.
//
// LO QUE NO HACE:
//   No inventa cobros de cancelación. El 10 % del depósito solo
//   corresponde a una reserva que ESTUVO confirmada y después se cayó,
//   y en el histórico no hay forma de saber cuáles de las canceladas de
//   hoy llegaron a confirmarse. Cobrarlas todas sería cobrar de más. El
//   script las lista al final, informativas, para que el dueño decida a
//   mano si alguna corresponde.
//
// USO:
//   node scripts/backfill-cobros-plataforma.mjs              (simulación)
//   node scripts/backfill-cobros-plataforma.mjs --aplicar    (escribe)
//
//   --incluir-cumplidas   suma las reservas en estado 'cumplida' (Citas
//                         marca así la cita atendida; las que ya estaban
//                         cumplidas antes de la 0106 tampoco tienen
//                         asiento). Apagado por defecto porque una
//                         'cumplida' pudo no haber pasado nunca por
//                         'confirmada'.
//   --lote=200            cuántas filas por insert.
//
// Sin --aplicar NO escribe nada: solo imprime lo que haría. Es plata;
// nadie debería poder correrlo sin querer. Correrlo dos veces no
// duplica: se saltan las reservas que ya tienen asiento y, por si acaso,
// el índice único (reserva_id, concepto) es la última red.
// ============================================================

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

// ------------------------------------------------------------
// LAS REGLAS DE PLATA (puras, exportadas, probadas)
// ------------------------------------------------------------

/** El 10 % del depósito retenido que cobra la plataforma al cancelarse. */
export const PORCENTAJE_CANCELACION = 10;

/** Modelos que no dejan cobro por reserva (se cobran de otra forma o no se cobran). */
export const MODELOS_SIN_COBRO_POR_RESERVA = ["membresia_mensual", "gratis"];

/**
 * Personas que cuentan para la comisión: mínimo 1 — una cita sin
 * invitados es UNA persona atendida, no cero. Misma convención que
 * personasDeReserva() en src/lib/cobro-plataforma.ts y que el
 * `greatest(1, coalesce(new.invitados, 1))` del trigger.
 */
export function personasCobrables(invitados) {
  const n = Number(invitados ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

/**
 * La tarifa que le aplica a un negocio: la suya (cobro_negocio) o el
 * default global (₡ por persona de configuracion_plataforma).
 */
export function resolverTarifa(ranchoId, tarifasPorRancho, comisionGlobal) {
  const propia = tarifasPorRancho.get(ranchoId);
  if (propia) {
    return {
      modelo: String(propia.modelo),
      valor: Number(propia.valor ?? 0),
      esGlobal: false,
    };
  }
  return {
    modelo: "comision_por_persona",
    valor: Number(comisionGlobal ?? 0),
    esGlobal: true,
  };
}

/**
 * Lo que devenga UNA reserva confirmada con esa tarifa. Espejo exacto
 * del `case v_modelo` del trigger de la 0106.
 */
export function montoDevengado(reserva, tarifa) {
  const valor = Number(tarifa.valor ?? 0);
  if (MODELOS_SIN_COBRO_POR_RESERVA.includes(tarifa.modelo)) return 0;
  switch (tarifa.modelo) {
    case "comision_por_persona":
      return personasCobrables(reserva.invitados) * valor;
    case "comision_fija_reserva":
      return valor;
    case "comision_porcentaje": {
      // Manda lo cobrado de verdad sobre la cotización, igual que
      // totalEvento(): coalesce(monto_cobrado_final, monto_total, 0).
      const total = Number(reserva.monto_cobrado_final ?? reserva.monto_total ?? 0);
      if (!Number.isFinite(total)) return 0;
      return Math.round((total * valor) / 100);
    }
    default:
      return 0;
  }
}

/**
 * Lo que devenga una cancelación: el 10 % del depósito que el negocio
 * retuvo. Sin depósito no hay nada que cobrar.
 */
export function montoCancelacion(deposito) {
  const d = Number(deposito ?? 0);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Math.round((d * PORCENTAJE_CANCELACION) / 100);
}

/**
 * El LUNES de la semana a la que pertenece un instante, en hora de
 * Costa Rica — la unidad de cobro (lunes a domingo). Devuelve
 * 'YYYY-MM-DD'.
 *
 * Costa Rica es UTC-6 todo el año (no hay horario de verano desde
 * 1992), así que restar seis horas es exacto y no depende del reloj de
 * la máquina que corra el script. Equivale al
 * date_trunc('week', now() at time zone 'America/Costa_Rica') del
 * trigger.
 */
export function lunesDeSemana(instante) {
  const t = instante instanceof Date ? instante : new Date(String(instante));
  if (Number.isNaN(t.getTime())) return null;
  const cr = new Date(t.getTime() - 6 * 60 * 60 * 1000);
  const dow = cr.getUTCDay(); // 0 domingo … 6 sábado
  cr.setUTCDate(cr.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return cr.toISOString().slice(0, 10);
}

/** Lo que el libro todavía debe cobrar: solo lo pendiente. */
export function totalPorCobrar(filas) {
  return filas.reduce(
    (acc, f) => acc + (f.estado === "pendiente" ? Number(f.monto ?? 0) : 0),
    0,
  );
}

/**
 * El plan de recuperación: qué filas se insertarían y qué se salta y
 * por qué. Todo el criterio del script vive acá y se prueba sin base.
 *
 * `yaConAsiento` es el set de reserva_id que ya tienen fila de concepto
 * 'reserva' en el libro: es lo que hace idempotente correrlo dos veces.
 */
export function planificar({
  reservas,
  tarifasPorRancho,
  comisionGlobal,
  yaConAsiento = new Set(),
  marca = "recuperado",
}) {
  const filas = [];
  const omitidas = {
    yaTenian: 0,
    sinNegocio: 0,
    sinCobro: 0, // membresía o gratis
    montoCero: 0,
    sinFecha: 0,
  };

  for (const r of reservas) {
    if (yaConAsiento.has(r.id)) {
      omitidas.yaTenian += 1;
      continue;
    }
    if (!r.rancho_id) {
      // El trigger también las deja pasar de largo (return new).
      omitidas.sinNegocio += 1;
      continue;
    }
    const tarifa = resolverTarifa(r.rancho_id, tarifasPorRancho, comisionGlobal);
    if (MODELOS_SIN_COBRO_POR_RESERVA.includes(tarifa.modelo)) {
      omitidas.sinCobro += 1;
      continue;
    }
    const monto = montoDevengado(r, tarifa);
    if (!(monto > 0)) {
      omitidas.montoCero += 1;
      continue;
    }
    const semana = lunesDeSemana(r.created_at);
    if (!semana) {
      // Sin created_at no hay semana posible: mejor dejarla fuera y
      // que se vea en el reporte, que inventarle una.
      omitidas.sinFecha += 1;
      continue;
    }

    filas.push({
      reserva_id: r.id,
      rancho_id: r.rancho_id,
      concepto: "reserva",
      personas: personasCobrables(r.invitados),
      tarifa: Number(tarifa.valor ?? 0),
      modelo: tarifa.modelo,
      monto,
      estado: "pendiente",
      semana,
      cliente: r.nombre ?? null,
      fecha_evento: r.fecha ?? null,
      // Se devenga cuando se confirmó; como eso no se guarda, queda el
      // created_at de la reserva (mismo supuesto que la semana).
      devengado_en: r.created_at,
      notas: `${marca}: la semana sale de created_at de la reserva, no de la confirmación`,
    });
  }

  return { filas, omitidas };
}

// ------------------------------------------------------------
// De acá para abajo: entrada/salida. Nada de reglas de plata.
// ------------------------------------------------------------

const PAGINA = 1000;

function fmtColones(n) {
  return "₡" + Math.round(Number(n) || 0).toLocaleString("es-CR");
}

function cargarEnv() {
  if (!existsSync(".env.local")) return;
  for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

/** ¿El error es "esa tabla no existe todavía"? (0106 sin correr). */
function esTablaInexistente(error) {
  if (!error) return false;
  const codigo = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return (
    codigo === "42P01" ||
    codigo === "PGRST205" ||
    (msg.includes("cobros_plataforma") &&
      (msg.includes("does not exist") || msg.includes("could not find the table")))
  );
}

/** Lee una tabla completa en páginas de 1000 (el tope de PostgREST). */
async function leerTodo(construirConsulta, etiqueta) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await construirConsulta().range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`${etiqueta}: ${error.message}`);
    const lote = data ?? [];
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return filas;
}

function parsearArgumentos(argv) {
  const conocidos = ["--aplicar", "--incluir-cumplidas", "--ayuda", "--help", "-h"];
  const desconocidos = argv.filter(
    (a) => !conocidos.includes(a) && !/^--lote=\d+$/.test(a),
  );
  const lote = argv.find((a) => /^--lote=\d+$/.test(a));
  return {
    aplicar: argv.includes("--aplicar"),
    incluirCumplidas: argv.includes("--incluir-cumplidas"),
    ayuda: argv.some((a) => ["--ayuda", "--help", "-h"].includes(a)),
    lote: lote ? Math.max(1, Number(lote.split("=")[1])) : 200,
    desconocidos,
  };
}

const AYUDA = `
Recuperación del libro de cobros de la plataforma (migración 0106).

  node scripts/backfill-cobros-plataforma.mjs                simula (no escribe)
  node scripts/backfill-cobros-plataforma.mjs --aplicar      escribe los asientos

  --incluir-cumplidas   suma también las reservas en estado 'cumplida'
  --lote=200            filas por insert
  --ayuda               esto
`;

async function main() {
  const opciones = parsearArgumentos(process.argv.slice(2));

  if (opciones.ayuda) {
    console.log(AYUDA);
    return;
  }
  if (opciones.desconocidos.length > 0) {
    console.error(
      `\n  Argumento que no conozco: ${opciones.desconocidos.join(", ")}`,
    );
    console.error("  Por las dudas no hago nada. Mirá --ayuda.\n");
    process.exitCode = 1;
    return;
  }

  cargarEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    console.error(
      "\n  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
    console.error("  Van en .env.local (nunca en el código).\n");
    process.exitCode = 1;
    return;
  }

  const db = createClient(url, service, { auth: { persistSession: false } });

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  LIBRO DE COBROS — recuperación de reservas ya confirmadas");
  console.log("══════════════════════════════════════════════════════════");
  console.log(
    opciones.aplicar
      ? "  MODO: APLICAR — esto SÍ escribe en cobros_plataforma."
      : "  MODO: SIMULACIÓN — no se escribe nada.",
  );

  // ---- 0. ¿Existe la tabla? ----
  const sonda = await db.from("cobros_plataforma").select("id").limit(1);
  if (esTablaInexistente(sonda.error)) {
    console.error("\n  La tabla `cobros_plataforma` todavía no existe.");
    console.error(
      "  Hay que pegar supabase/migrations/0106_libro_cobros_plataforma.sql",
    );
    console.error("  en el SQL Editor de Supabase ANTES de correr esto.\n");
    process.exitCode = 1;
    return;
  }
  if (sonda.error) {
    console.error(`\n  No se pudo leer cobros_plataforma: ${sonda.error.message}\n`);
    process.exitCode = 1;
    return;
  }

  // ---- 1. Lo que ya hay en el libro ----
  // Se ordena por `id` (único) y no por fecha: paginar con range sobre
  // un orden con empates puede repetir o saltarse filas.
  const libro = await leerTodo(
    () =>
      db
        .from("cobros_plataforma")
        .select("id, reserva_id, concepto, estado, monto")
        .order("id"),
    "cobros_plataforma",
  );
  const yaConAsiento = new Set(
    libro.filter((c) => c.concepto === "reserva" && c.reserva_id).map((c) => c.reserva_id),
  );
  const porEstado = { pendiente: 0, pagado: 0, anulado: 0 };
  for (const c of libro) {
    if (porEstado[c.estado] === undefined) porEstado[c.estado] = 0;
    porEstado[c.estado] += Number(c.monto ?? 0);
  }
  console.log("\n── El libro hoy ──");
  console.log(`  Asientos: ${libro.length}`);
  console.log(`  Por cobrar (pendiente): ${fmtColones(totalPorCobrar(libro))}`);
  console.log(`  Ya pagado:              ${fmtColones(porEstado.pagado)}`);
  console.log(`  Anulado:                ${fmtColones(porEstado.anulado)}`);

  // ---- 2. Tarifas ----
  const estados = opciones.incluirCumplidas ? ["confirmada", "cumplida"] : ["confirmada"];

  const [reservas, ranchos, tarifas, config] = await Promise.all([
    leerTodo(
      () =>
        db
          .from("reservas")
          .select(
            "id, fecha, nombre, invitados, rancho_id, estado, monto_total, monto_cobrado_final, created_at",
          )
          .in("estado", estados)
          .order("id"),
      "reservas confirmadas",
    ),
    leerTodo(
      () => db.from("ranchos").select("id, nombre, vertical").order("id"),
      "ranchos",
    ),
    leerTodo(
      () => db.from("cobro_negocio").select("rancho_id, modelo, valor").order("rancho_id"),
      "cobro_negocio",
    ).catch(() => {
      // La 0098 puede no estar corrida: sin tarifas propias, todo cae
      // al default global y el cálculo sigue siendo válido.
      console.log("\n  (aviso) No se pudo leer cobro_negocio; se usa la tarifa global.");
      return [];
    }),
    db.from("configuracion_plataforma").select("comision_por_persona").limit(1).single(),
  ]);

  const comisionGlobal = Number(config.data?.comision_por_persona ?? 0);
  const tarifasPorRancho = new Map(tarifas.map((t) => [t.rancho_id, t]));
  const nombrePorRancho = new Map(
    ranchos.map((r) => [r.id, { nombre: r.nombre, vertical: r.vertical ?? "—" }]),
  );

  console.log("\n── Tarifas ──");
  console.log(`  Default global: ${fmtColones(comisionGlobal)} por persona`);
  console.log(`  Negocios con tarifa propia: ${tarifasPorRancho.size}`);

  // ---- 3. El plan ----
  const { filas, omitidas } = planificar({
    reservas,
    tarifasPorRancho,
    comisionGlobal,
    yaConAsiento,
  });

  console.log("\n── Lo que se miró ──");
  console.log(`  Reservas en estado ${estados.join(" / ")}: ${reservas.length}`);
  console.log(`  Ya tenían asiento (se saltan): ${omitidas.yaTenian}`);
  console.log(`  Sin negocio asignado:          ${omitidas.sinNegocio}`);
  console.log(`  Negocio en membresía o gratis: ${omitidas.sinCobro}`);
  console.log(`  Darían ₡0 (tarifa en cero, % sin monto): ${omitidas.montoCero}`);
  if (omitidas.sinFecha > 0) {
    console.log(`  Sin created_at usable:         ${omitidas.sinFecha}`);
  }

  const totalNuevo = filas.reduce((acc, f) => acc + f.monto, 0);
  console.log("\n── Lo que se recuperaría ──");
  console.log(`  Asientos nuevos: ${filas.length}`);
  console.log(`  Plata:           ${fmtColones(totalNuevo)}`);

  if (filas.length === 0) {
    console.log("\n  No hay nada que recuperar. El libro ya está al día.\n");
    return;
  }

  // Por negocio
  const porNegocio = new Map();
  for (const f of filas) {
    const acc = porNegocio.get(f.rancho_id) ?? { filas: 0, personas: 0, monto: 0 };
    acc.filas += 1;
    acc.personas += f.personas;
    acc.monto += f.monto;
    porNegocio.set(f.rancho_id, acc);
  }
  console.log("\n── Por negocio ──");
  for (const [ranchoId, acc] of [...porNegocio].sort((a, b) => b[1].monto - a[1].monto)) {
    const info = nombrePorRancho.get(ranchoId);
    const nombre = info?.nombre ?? `(negocio ${String(ranchoId).slice(0, 8)}…)`;
    console.log(
      `  ${fmtColones(acc.monto).padStart(12)}  ${String(acc.filas).padStart(4)} res.  ` +
        `${String(acc.personas).padStart(5)} pers.  ${nombre} [${info?.vertical ?? "—"}]`,
    );
  }

  // Por semana
  const porSemana = new Map();
  for (const f of filas) {
    const acc = porSemana.get(f.semana) ?? { filas: 0, monto: 0 };
    acc.filas += 1;
    acc.monto += f.monto;
    porSemana.set(f.semana, acc);
  }
  const semanas = [...porSemana].sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\n── Por semana (lunes de corte) — ${semanas.length} semanas ──`);
  for (const [semana, acc] of semanas.slice(-12)) {
    console.log(
      `  ${semana}  ${String(acc.filas).padStart(4)} res.  ${fmtColones(acc.monto).padStart(12)}`,
    );
  }
  if (semanas.length > 12) {
    console.log(`  (se muestran las últimas 12 de ${semanas.length})`);
  }

  console.log("\n  ⚠ LA SEMANA ES UNA APROXIMACIÓN:");
  console.log("    `reservas` no guarda cuándo se confirmó cada una, así que");
  console.log("    la semana de estas filas sale de su `created_at`. De acá en");
  console.log("    adelante el trigger usa la semana de la confirmación real.");
  console.log("    Las filas recuperadas quedan marcadas en `notas`.");

  // Canceladas con depósito: informativo, NO se cobran.
  const canceladas = await leerTodo(
    () =>
      db
        .from("reservas")
        .select("id, deposito_monto")
        .in("estado", ["cancelada", "rechazada"])
        .gt("deposito_monto", 0)
        .order("id"),
    "reservas canceladas",
  ).catch(() => []);
  const sinAsiento = canceladas.filter((r) => !yaConAsiento.has(r.id));
  if (sinAsiento.length > 0) {
    const potencial = sinAsiento.reduce((acc, r) => acc + montoCancelacion(r.deposito_monto), 0);
    console.log("\n── Canceladas con depósito (NO se cobran acá) ──");
    console.log(`  ${sinAsiento.length} reservas · el 10 % daría ${fmtColones(potencial)}`);
    console.log("  No se anotan: no hay forma de saber cuáles llegaron a estar");
    console.log("  confirmadas, y cobrar las que nunca lo estuvieron sería cobrar");
    console.log("  de más. De acá en adelante el trigger las anota solo.");
  }

  // ---- 4. Escribir (solo con --aplicar) ----
  if (!opciones.aplicar) {
    console.log("\n──────────────────────────────────────────────────────────");
    console.log("  SIMULACIÓN: no se escribió nada.");
    console.log("  Para aplicarlo de verdad:");
    console.log("    node scripts/backfill-cobros-plataforma.mjs --aplicar");
    console.log("──────────────────────────────────────────────────────────\n");
    return;
  }

  console.log(`\n── Escribiendo ${filas.length} asientos ──`);
  let insertadas = 0;
  let duplicadas = 0;
  const fallidas = [];

  for (let i = 0; i < filas.length; i += opciones.lote) {
    const lote = filas.slice(i, i + opciones.lote);
    const { error } = await db.from("cobros_plataforma").insert(lote);
    if (!error) {
      insertadas += lote.length;
    } else if (String(error.code) === "23505") {
      // Alguien insertó en el medio (o el índice único atajó algo).
      // Se reintenta fila por fila para no perder el lote entero.
      for (const fila of lote) {
        const r = await db.from("cobros_plataforma").insert(fila);
        if (!r.error) insertadas += 1;
        else if (String(r.error.code) === "23505") duplicadas += 1;
        else fallidas.push({ reserva: fila.reserva_id, error: r.error.message });
      }
    } else {
      fallidas.push({ reserva: `lote ${i}`, error: error.message });
    }
    console.log(`  ${Math.min(i + opciones.lote, filas.length)} / ${filas.length}`);
  }

  console.log("\n── Resultado ──");
  console.log(`  Insertadas: ${insertadas}`);
  console.log(`  Ya estaban (duplicadas, se ignoran): ${duplicadas}`);
  if (fallidas.length > 0) {
    console.log(`  Con error: ${fallidas.length}`);
    for (const f of fallidas.slice(0, 10)) console.log(`    ${f.reserva}: ${f.error}`);
    process.exitCode = 1;
  }
  console.log(`  Plata recuperada: ${fmtColones(totalNuevo)}\n`);
}

// Solo corre cuando se lo invoca directo. Importado (por los tests) no
// hace nada: las reglas de arriba son puras y se prueban sin base.
const esEntrada =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEntrada) {
  await main().catch((e) => {
    console.error(`\n  Se cayó: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  });
}
