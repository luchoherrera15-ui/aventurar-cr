import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";
import { miNegocioFood } from "@/lib/food/auth";
import type { FoodReservationEstado } from "@/lib/food/tipos";
import { ROTULO_RANGO, rangoDe, rangoDesdeParam } from "@/lib/food/panel-demo";
import { EncabezadoPagina, KpiCard, NotaDemo } from "@/components/food/panel";
import { IconCalendarLine, IconCheck, IconWarning, IconX } from "@/components/icons";
import CheckInPanel, { type ReservaHoy } from "./check-in-panel";

/**
 * CHECK-IN — la pantalla del servicio: registrar que el cliente llegó.
 * Dos capas bien separadas:
 *
 *   1. Las MÉTRICAS del período (arriba): utilería de panel-demo.ts,
 *      marcada "Datos de ejemplo", hasta que el negocio junte volumen
 *      real. Responden al selector de rango de la topbar (?rango=)
 *      como el dashboard, para que la topbar nunca parezca rota.
 *   2. La OPERACIÓN de hoy (abajo, CheckInPanel): reservas REALES de
 *      food_reservations con el botón grande de check-in y el
 *      mostrador por código — las actions de panel-actions.ts de
 *      siempre, sin tocar.
 *
 * Cancelaciones y no-shows no vienen como ancla del demo: se DERIVAN
 * de las mismas cifras (reservas − check-ins = las que no llegaron a
 * la mesa) con el mismo sesgo 40% no-show / 60% cancelada que usa
 * panel-demo.ts al generar reservas históricas. En 30 días eso da
 * exactamente 7 cancelaciones y 4 no-shows — un solo origen, imposible
 * que el KPI y la lista de Reservas cuenten historias distintas.
 */

function esEstadoReserva(v: string): v is FoodReservationEstado {
  return v === "confirmada" || v === "check_in" || v === "no_show" || v === "cancelada";
}

export default async function CheckInFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const rango = rangoDesdeParam((await searchParams).rango);
  const { kpis } = rangoDe(rango);

  // La derivación explicada arriba: perdidas = no llegaron a la mesa.
  const perdidas = kpis.reservas - kpis.checkIns;
  const noShows = Math.round(perdidas * 0.4);
  const cancelaciones = perdidas - noShows;

  // ── Las reservas reales de HOY (hora de Costa Rica) ──────────────
  // hoyISOCR() y no new Date(): el servidor corre en UTC y desde las
  // 6 p.m. de CR creería que ya es mañana — justo la hora de la cena.
  const supabase = await createClient();
  const hoy = hoyISOCR();
  const { data: reservas, error } = await supabase
    .from("food_reservations")
    .select("id, party_size, estado, codigo_confirmacion, food_franjas!inner(fecha, hora)")
    .eq("business_id", negocio.id)
    .eq("food_franjas.fecha", hoy)
    .order("id");
  if (error) console.error("[food/negocio check-in] no se pudo cargar hoy:", error.message);

  const filas: ReservaHoy[] = (reservas ?? [])
    .map((r) => {
      // El join puede venir como objeto o como array de uno — se
      // normaliza igual que en el dashboard y el layout.
      const franja = Array.isArray(r.food_franjas) ? r.food_franjas[0] : r.food_franjas;
      return {
        id: r.id,
        hora: franja?.hora ?? "",
        partySize: r.party_size,
        codigo: r.codigo_confirmacion,
        estado: esEstadoReserva(r.estado) ? r.estado : ("confirmada" as const),
      };
    })
    .sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Check-in"
        descripcion="Registrá la llegada de tus clientes — por código en el mostrador o directo desde la lista de hoy."
      />

      {/* ── Métricas del período (demo) ────────────────────────────── */}
      <section aria-label="Métricas de check-in del período">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft">
            {ROTULO_RANGO[rango]}
          </h2>
          <NotaDemo />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            rotulo="Reservas"
            valor={kpis.reservas}
            delta={kpis.deltas.reservas}
            icono={<IconCalendarLine className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Check-ins"
            valor={kpis.checkIns}
            delta={kpis.deltas.checkIns}
            icono={<IconCheck className="h-4 w-4" />}
          />
          {/* Sin delta a propósito: el demo no declara la variación de
              cancelaciones/no-shows y acá no se inventan números. */}
          <KpiCard rotulo="Cancelaciones" valor={cancelaciones} icono={<IconX className="h-4 w-4" />} />
          <KpiCard
            rotulo="No se presentaron"
            valor={noShows}
            icono={<IconWarning className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* ── La operación real de hoy ───────────────────────────────── */}
      <CheckInPanel negocioId={negocio.id} reservas={filas} />
    </div>
  );
}
