import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hoyISOCR } from "@/lib/fechas";
import { formatearCRC } from "@/lib/dinero";
import { miNegocioFood } from "@/lib/food/auth";
import { horaCorta } from "@/lib/food/tipos";
import {
  INSIGHTS_DEMO,
  ROTULO_RANGO,
  rangoDe,
  rangoDesdeParam,
} from "@/lib/food/panel-demo";
import {
  EncabezadoPagina,
  GraficoRendimiento,
  KpiCard,
  NotaDemo,
  NotaEstimacion,
  TarjetaPanel,
} from "@/components/food/panel";
import { ENLACE_CARD } from "@/components/panel/sistema";
import { IconCalendarLine, IconChartBars, IconCheck, IconUsers } from "@/components/icons";
import FilaReservaHoy from "./fila-reserva-hoy";

/**
 * EL DASHBOARD DEL RESTAURANTE — la pantalla que responde "¿me está
 * sirviendo Bookea?". La jerarquía es deliberada:
 *
 *   1. HOY (datos REALES de food_reservations): lo operativo primero,
 *      porque el dueño entra con el servicio encima.
 *   2. Los 4 KPIs del período — la foto rápida.
 *   3. El gráfico de rendimiento — la forma de la tendencia.
 *   4. "¿Cuánto negocio está generando Bookea?" — el argumento
 *      comercial, con la cifra estimada en grande y su letra chica.
 *   5. "Resumen de tu mes" — los mismos números contados en palabras.
 *
 * Las secciones 2-5 se alimentan de la utilería de panel-demo.ts (y lo
 * dicen con "Datos de ejemplo") hasta que el negocio junte volumen
 * real; la sección 1 es real SIEMPRE. El rango llega por `?rango=`
 * desde el selector de la topbar — searchParams es Promise en esta
 * versión de Next, por eso el await.
 */
export default async function DashboardFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  const rango = rangoDesdeParam((await searchParams).rango);
  const { serie, kpis } = rangoDe(rango);
  // El resumen narrado es SIEMPRE mensual, aunque el selector esté en
  // 7 o 90: "tu mes" es la unidad en la que un dueño piensa su negocio.
  const { kpis: kpisMes } = rangoDe(30);

  // ── HOY: reservas reales, como siempre ───────────────────────────
  const supabase = await createClient();
  // hoyISOCR(), no `new Date().toISOString()`: el servidor corre en
  // UTC — entre las 6pm y medianoche hora de Costa Rica, justo la
  // franja de la cena, este panel decía "no hay reservas para hoy"
  // aunque sí las hubiera. Ver src/lib/fechas.ts.
  const hoy = hoyISOCR();

  const { data: reservas, error } = await supabase
    .from("food_reservations")
    .select("id, party_size, estado, codigo_confirmacion, food_franjas!inner(fecha, hora)")
    .eq("business_id", negocio.id)
    .eq("food_franjas.fecha", hoy)
    .order("id");

  if (error) console.error("[food/negocio hoy] no se pudo cargar:", error.message);

  const filas = (reservas ?? [])
    .map((r) => {
      const franja = Array.isArray(r.food_franjas) ? r.food_franjas[0] : r.food_franjas;
      return { ...r, hora: franja?.hora ?? "" };
    })
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const confirmadas = filas.filter((f) => f.estado === "confirmada");
  const conCheckIn = filas.filter((f) => f.estado === "check_in");
  const totalPersonasHoy = filas.reduce((acc, f) => acc + f.party_size, 0);

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Dashboard"
        descripcion={`Así le está yendo a ${negocio.nombre} con Bookea · ${ROTULO_RANGO[rango].toLowerCase()}.`}
      />

      {/* ── 1 · HOY (real) ─────────────────────────────────────────── */}
      <TarjetaPanel
        kicker="Hoy"
        titulo="Reservas de hoy"
        accion={
          <Link href="/food/negocio/check-in" className={ENLACE_CARD}>
            Ir al check-in →
          </Link>
        }
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-aventurea-cream-2 p-3 text-center">
            <p className="text-[22px] font-extrabold leading-none text-aventurea-ink">
              {filas.length}
            </p>
            <p className="mt-1 text-[11px] font-bold text-aventurea-ink-soft">Reservas</p>
          </div>
          <div className="rounded-xl bg-aventurea-cream-2 p-3 text-center">
            <p className="text-[22px] font-extrabold leading-none text-aventurea-ink">
              {totalPersonasHoy}
            </p>
            <p className="mt-1 text-[11px] font-bold text-aventurea-ink-soft">Personas</p>
          </div>
          <div className="rounded-xl bg-aventurea-cream-2 p-3 text-center">
            <p className="text-[22px] font-extrabold leading-none text-aventurea-orange-dark">
              {conCheckIn.length}
            </p>
            <p className="mt-1 text-[11px] font-bold text-aventurea-ink-soft">Con check-in</p>
          </div>
        </div>

        {filas.length === 0 ? (
          <p className="mt-3 rounded-xl bg-aventurea-cream-2 px-6 py-8 text-center text-[13px] text-aventurea-ink-soft">
            No hay reservas para hoy. Cuando alguien reserve por Bookea, aparece acá al
            instante.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {filas.map((f) => (
              <FilaReservaHoy
                key={f.id}
                negocioId={negocio.id}
                reservaId={f.id}
                hora={horaCorta(f.hora)}
                partySize={f.party_size}
                codigo={f.codigo_confirmacion}
                estado={f.estado}
              />
            ))}
          </ul>
        )}

        {confirmadas.length > 0 && (
          <p className="mt-2.5 text-[12px] text-aventurea-ink-soft">
            {confirmadas.length} todavía sin check-in.
          </p>
        )}
      </TarjetaPanel>

      {/* ── 2 · KPIs del período (demo) ────────────────────────────── */}
      <section aria-label="Métricas del período">
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
            rotulo="Clientes generados"
            valor={kpis.clientes}
            delta={kpis.deltas.clientes}
            icono={<IconUsers className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Check-ins"
            valor={kpis.checkIns}
            delta={kpis.deltas.checkIns}
            icono={<IconCheck className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Ventas estimadas"
            valor={kpis.ventasEstimadas}
            formato="colones"
            delta={kpis.deltas.ventas}
            icono={<IconChartBars className="h-4 w-4" />}
          />
        </div>
        <NotaEstimacion className="mt-2" />
      </section>

      {/* ── 3 · El gráfico principal (demo) ────────────────────────── */}
      <TarjetaPanel kicker="Rendimiento" titulo="Rendimiento de Bookea" notaDemo>
        <GraficoRendimiento serie={serie} />
      </TarjetaPanel>

      {/* ── 4 · El argumento comercial (demo) ──────────────────────── */}
      <section
        aria-label="Cuánto negocio está generando Bookea"
        className="rounded-3xl bg-aventurea-navy p-5 text-white shadow-[var(--shadow-elevado)] sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[11px] font-light uppercase tracking-[0.16em] text-white/70">
            ¿Cuánto negocio está generando Bookea?
          </p>
          <NotaDemo />
        </div>

        {/* LA cifra del panel — una sola figura héroe por pantalla. */}
        <p className="mt-3 text-[40px] font-extrabold leading-none tracking-tight sm:text-[48px]">
          {formatearCRC(kpis.ventasEstimadas)}
        </p>
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-white/70">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 font-bold text-emerald-300">
            <span aria-hidden>↑</span> +
            {kpis.deltas.ventas.toLocaleString("es-CR", { maximumFractionDigits: 1 })}%
          </span>
          vs período anterior
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-white/15 pt-4 sm:grid-cols-3">
          <div>
            <p className="text-[20px] font-extrabold leading-none">
              {kpis.reservas.toLocaleString("es-CR")}
            </p>
            <p className="mt-1 text-[11.5px] font-bold text-white/70">reservas recibidas</p>
          </div>
          <div>
            <p className="text-[20px] font-extrabold leading-none">
              {kpis.checkIns.toLocaleString("es-CR")}
            </p>
            <p className="mt-1 text-[11.5px] font-bold text-white/70">llegaron a la mesa</p>
          </div>
          <div>
            <p className="text-[20px] font-extrabold leading-none">
              {formatearCRC(kpis.ticketPromedio)}
            </p>
            <p className="mt-1 text-[11.5px] font-bold text-white/70">ticket promedio por mesa</p>
          </div>
        </div>

        <NotaEstimacion enOscuro className="mt-4" />
      </section>

      {/* ── 5 · El resumen narrado (demo, siempre mensual) ─────────── */}
      <TarjetaPanel kicker="Insights" titulo="Resumen de tu mes" notaDemo>
        <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink">
          En los últimos 30 días, Bookea le generó a{" "}
          <span className="font-bold">{negocio.nombre}</span>{" "}
          <span className="font-bold">{kpisMes.reservas.toLocaleString("es-CR")} reservas</span> de{" "}
          <span className="font-bold">{kpisMes.clientes.toLocaleString("es-CR")} clientes</span> (
          {kpisMes.clientesNuevos.toLocaleString("es-CR")} llegaron por primera vez).{" "}
          {kpisMes.checkIns.toLocaleString("es-CR")} reservas se concretaron en la mesa, con un
          consumo estimado de{" "}
          <span className="font-bold">{formatearCRC(kpisMes.ventasEstimadas)}</span>.
        </p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {INSIGHTS_DEMO.map((insight) => (
            <li key={insight.id} className="flex items-start gap-2.5">
              <span
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-aventurea-green-light text-[11px] font-extrabold text-aventurea-green"
                aria-hidden
              >
                ↑
              </span>
              <p className="text-[13px] leading-relaxed text-aventurea-ink">{insight.texto}</p>
            </li>
          ))}
        </ul>
      </TarjetaPanel>
    </div>
  );
}
