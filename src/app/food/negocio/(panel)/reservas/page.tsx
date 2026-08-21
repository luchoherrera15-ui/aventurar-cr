import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { RESERVAS_DEMO } from "@/lib/food/panel-demo";
import ReservasCliente from "./reservas-cliente";
import {
  leerFiltros,
  interpretarNotas,
  primerParam,
  type FranjaDisponible,
  type ReservaPanelFila,
} from "./tipos";

export const metadata: Metadata = { title: "Reservas · FOOD.BOOKEA", robots: { index: false } };

/**
 * RESERVAS — la agenda completa del restaurante.
 *
 * Este Server Component hace TODO el trabajo de datos y le pasa filas
 * planas al cliente:
 *
 *   1. Lee las reservas REALES de food_reservations (últimos 90 días
 *      hacia adelante, que es el mismo horizonte de la serie del
 *      dashboard) y las normaliza a ReservaPanelFila.
 *   2. Les concatena la utilería de RESERVAS_DEMO (panel-demo.ts) para
 *      que la pantalla cuente la historia completa mientras el negocio
 *      junta volumen — cada fila demo va marcada y el cliente la
 *      señala. panel-demo se importa SOLO acá (se ancla al reloj del
 *      servidor); el cliente recibe datos ya resueltos por props.
 *   3. Lee las franjas futuras activas: son las horas elegibles del
 *      formulario "+ Nueva reserva" y el cupo del calendario.
 *
 * Los filtros y la vista viajan en el querystring (?fecha=&estado=&
 * personas=&franja=&vista=&cal=&dia=) — el estado de la pantalla es la
 * URL, igual que el ?rango= de la topbar: se comparte, sobrevive a la
 * navegación y el servidor lo lee sin estado compartido. searchParams
 * es Promise en esta versión de Next, por eso el await.
 */
export default async function ReservasFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const sp = await searchParams;
  const filtros = leerFiltros(sp);
  const vista = primerParam(sp.vista) === "calendario" ? ("calendario" as const) : ("lista" as const);
  const calParam = primerParam(sp.cal);
  const cal = calParam === "semana" || calParam === "mes" ? calParam : "dia";

  // hoyISOCR() y no new Date(): el servidor corre en UTC y desde las
  // 6 p.m. de Costa Rica creería que ya es mañana (ver src/lib/fechas.ts).
  const hoy = hoyISOCR();
  const diaParam = primerParam(sp.dia);
  const ancla = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) ? diaParam : hoy;

  const supabase = await createClient();
  const [{ data: reservas, error: errReservas }, { data: franjas, error: errFranjas }] =
    await Promise.all([
      // El join con food_franjas trae fecha y hora; el !inner permite
      // filtrar por la fecha de la franja desde la tabla de reservas.
      supabase
        .from("food_reservations")
        .select("id, party_size, estado, codigo_confirmacion, notas, food_franjas!inner(fecha, hora)")
        .eq("business_id", negocio.id)
        .gte("food_franjas.fecha", sumarDiasISO(hoy, -90))
        .limit(400),
      supabase
        .from("food_franjas")
        .select("id, fecha, hora, capacidad, reservado, descuento_porcentaje, activa, food_locations(nombre)")
        .eq("business_id", negocio.id)
        .eq("activa", true)
        .gte("fecha", hoy)
        .order("fecha")
        .order("hora")
        .limit(200),
    ]);
  if (errReservas) console.error("[food/reservas] reservas:", errReservas.message);
  if (errFranjas) console.error("[food/reservas] franjas:", errFranjas.message);

  // ── Reales → fila unificada ───────────────────────────────────────
  const reales: ReservaPanelFila[] = (reservas ?? []).map((r) => {
    // El join puede venir como objeto o como array de uno — mismo
    // normalizado que el dashboard y el layout.
    const franja = Array.isArray(r.food_franjas) ? r.food_franjas[0] : r.food_franjas;
    const { cliente, telefono, nota } = interpretarNotas(r.notas);
    return {
      id: r.id,
      origen: "real",
      cliente: cliente ?? "Cliente de Bookea",
      codigo: r.codigo_confirmacion,
      fecha: franja?.fecha ?? "",
      hora: (franja?.hora ?? "").slice(0, 5),
      personas: r.party_size,
      // La tabla real solo conoce confirmada/check_in/no_show/cancelada,
      // todas dentro del universo unificado — se pasa tal cual.
      estado: r.estado as ReservaPanelFila["estado"],
      nota,
      telefono,
      // Nunca se estima consumo sobre reservas reales: Bookea no
      // conoce la facturación y esta pantalla no la inventa.
      totalEstimado: null,
    };
  });

  // ── Demo → fila unificada, marcada como utilería ──────────────────
  const demo: ReservaPanelFila[] = RESERVAS_DEMO.map((r) => ({
    id: r.id,
    origen: "demo",
    cliente: r.cliente,
    codigo: null,
    fecha: r.fecha,
    hora: r.hora,
    personas: r.personas,
    estado: r.estado,
    nota: null,
    telefono: null,
    totalEstimado: r.totalEstimado,
  }));

  const filas = [...reales, ...demo];

  const disponibles: FranjaDisponible[] = (franjas ?? []).map((f) => {
    const sede = Array.isArray(f.food_locations) ? f.food_locations[0] : f.food_locations;
    return {
      id: f.id,
      fecha: f.fecha,
      hora: String(f.hora).slice(0, 5),
      capacidad: f.capacidad,
      reservado: f.reservado,
      descuento: f.descuento_porcentaje,
      sede: sede?.nombre ?? "",
    };
  });

  return (
    <ReservasCliente
      negocioId={negocio.id}
      hoy={hoy}
      filas={filas}
      filtros={filtros}
      vista={vista}
      cal={cal}
      ancla={ancla}
      franjas={disponibles}
    />
  );
}
