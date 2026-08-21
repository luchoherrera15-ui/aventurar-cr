import Link from "next/link";
import { redirect } from "next/navigation";
import { miNegocioFood } from "@/lib/food/auth";
import { formatearCRC } from "@/lib/dinero";
import { ROTULO_RANGO, rangoDesdeParam } from "@/lib/food/panel-demo";
import { datosRendimiento } from "@/lib/food/rendimiento-demo";
import {
  EncabezadoPagina,
  GraficoBarras,
  KpiCard,
  MapaCalor,
  NotaDemo,
  NotaEstimacion,
  TarjetaPanel,
} from "@/components/food/panel";
import { ENLACE_CARD } from "@/components/panel/sistema";
import {
  IconCalendarLine,
  IconChartBars,
  IconCheck,
  IconStore,
  IconTagLine,
  IconUsers,
  IconUtensils,
} from "@/components/icons";
import GraficoVentas from "./grafico-ventas";

/**
 * RENDIMIENTO — el diferencial del producto: la pantalla que le
 * demuestra al restaurante, con números, cuánto negocio le está
 * generando Bookea. El orden cuenta un argumento, no un inventario:
 *
 *   1. Los 7 KPIs del período — la foto completa de un vistazo.
 *   2. "¿Bookea te está ayudando?" — este mes contra el anterior, con
 *      las DOS cifras a la vista y el % derivado de ellas.
 *   3. La evolución por semana — la forma del crecimiento.
 *   4. La demanda (mapa de calor por hora + días fuertes) — lo
 *      accionable: dónde abrir franjas.
 *   5. El rendimiento por promoción — el puente a la pantalla de
 *      Promociones.
 *
 * Todo sale de la utilería central (panel-demo + rendimiento-demo) y
 * se marca "Datos de ejemplo"; cuando exista volumen real, el módulo
 * de derivaciones se reescribe sobre food_reservations y esta pantalla
 * no cambia. Toda cifra en colones lleva su <NotaEstimacion />: Bookea
 * NO conoce la facturación real — estima de reservas × ticket.
 */
export default async function RendimientoFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  // El rango llega del selector de la topbar (?rango=7|30|90).
  // searchParams es Promise en esta versión de Next — por eso el await.
  const rango = rangoDesdeParam((await searchParams).rango);
  const datos = datosRendimiento(rango);
  const { kpis, comparacion } = datos;

  // Los "cuánto más que el mes pasado" del cierre de la comparación:
  // diferencias de las mismas dos cifras que la tarjeta muestra.
  const reservasDeMas = comparacion.reservas.actual - comparacion.reservas.anterior;
  const ventasDeMas = comparacion.ventas.actual - comparacion.ventas.anterior;

  // La barra de conversión de cada promo se dibuja relativa a la mejor
  // (la mejor llena el carril): compara promos entre sí, que es lo que
  // esta lista quiere responder.
  const mejorConversion = Math.max(...datos.promos.map((p) => p.conversion), 0.1);

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Rendimiento"
        descripcion={`Cuánto negocio le está generando Bookea a ${negocio.nombre} · ${ROTULO_RANGO[rango].toLowerCase()}.`}
      />

      {/* ── 1 · Los KPIs del período ───────────────────────────────── */}
      <section aria-label="Indicadores del período">
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
            rotulo="Clientes nuevos"
            valor={kpis.clientesNuevos}
            detalle={`de ${kpis.clientes.toLocaleString("es-CR")} clientes en el período`}
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
          <KpiCard
            rotulo="Ticket promedio"
            valor={kpis.ticketPromedio}
            formato="colones"
            detalle="consumo estimado por mesa con check-in"
            icono={<IconUtensils className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Conversión"
            valor={datos.conversion}
            formato="porcentaje"
            detalle={`de ${datos.visitasPerfil.toLocaleString("es-CR")} visitas a tu perfil, cuántas reservaron`}
            icono={<IconStore className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Repetición"
            valor={datos.repeticion}
            formato="porcentaje"
            detalle="clientes del período que ya habían venido"
            icono={<IconTagLine className="h-4 w-4" />}
          />
        </div>
        <NotaEstimacion className="mt-2" />
      </section>

      {/* ── 2 · La comparación mensual — EL argumento ──────────────── */}
      <TarjetaPanel kicker="Comparación" titulo="¿Bookea te está ayudando?" notaDemo>
        <p className="text-[12.5px] text-aventurea-ink-soft">
          Tus últimos 30 días contra los 30 anteriores.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Reservas: las dos cifras a la vista y el % que sale de ellas. */}
          <div className="rounded-2xl bg-aventurea-cream-2 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
              Reservas del mes
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-[30px] font-extrabold leading-none tracking-tight text-aventurea-ink">
                {comparacion.reservas.actual.toLocaleString("es-CR")}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-aventurea-green-light px-1.5 py-0.5 text-[11.5px] font-bold text-aventurea-green">
                <span aria-hidden>↑</span> +
                {comparacion.reservas.variacion.toLocaleString("es-CR", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </p>
            <p className="mt-2 text-[12px] text-aventurea-ink-soft">
              Mes anterior:{" "}
              <span className="font-bold text-aventurea-ink">
                {comparacion.reservas.anterior.toLocaleString("es-CR")} reservas
              </span>
            </p>
          </div>

          <div className="rounded-2xl bg-aventurea-cream-2 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
              Ventas estimadas del mes
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-[30px] font-extrabold leading-none tracking-tight text-aventurea-ink">
                {formatearCRC(comparacion.ventas.actual)}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-aventurea-green-light px-1.5 py-0.5 text-[11.5px] font-bold text-aventurea-green">
                <span aria-hidden>↑</span> +
                {comparacion.ventas.variacion.toLocaleString("es-CR", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </p>
            <p className="mt-2 text-[12px] text-aventurea-ink-soft">
              Mes anterior:{" "}
              <span className="font-bold text-aventurea-ink">
                {formatearCRC(comparacion.ventas.anterior)}
              </span>
            </p>
          </div>
        </div>

        <p className="mt-3.5 max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink">
          Es decir:{" "}
          <span className="font-bold">
            {reservasDeMas.toLocaleString("es-CR")} reservas y {formatearCRC(ventasDeMas)} más
          </span>{" "}
          que el mes pasado. Sí, Bookea te está ayudando — y este es el número.
        </p>
        <NotaEstimacion className="mt-2" />
      </TarjetaPanel>

      {/* ── 3 · La evolución del período ───────────────────────────── */}
      <section aria-label="Evolución del período" className="grid grid-cols-1 gap-3.5 xl:grid-cols-2">
        <TarjetaPanel
          kicker="Evolución"
          titulo={`Reservas por ${datos.unidadBuckets}`}
          notaDemo
          accion={
            <span className="text-[12px] text-aventurea-ink-soft">
              <span className="font-extrabold text-aventurea-ink">
                {kpis.reservas.toLocaleString("es-CR")}
              </span>{" "}
              en el período
            </span>
          }
        >
          <GraficoBarras
            barras={datos.buckets.map((b) => ({ etiqueta: b.etiqueta, valor: b.reservas }))}
            serie="Reservas"
          />
        </TarjetaPanel>

        <TarjetaPanel
          kicker="Evolución"
          titulo={`Clientes nuevos por ${datos.unidadBuckets}`}
          notaDemo
          accion={
            <span className="text-[12px] text-aventurea-ink-soft">
              <span className="font-extrabold text-aventurea-ink">
                {kpis.clientesNuevos.toLocaleString("es-CR")}
              </span>{" "}
              en el período
            </span>
          }
        >
          <GraficoBarras
            barras={datos.buckets.map((b) => ({ etiqueta: b.etiqueta, valor: b.clientesNuevos }))}
            serie="Clientes nuevos"
            color="var(--color-aventurea-navy-3)"
          />
        </TarjetaPanel>

        <TarjetaPanel
          kicker="Evolución"
          titulo={`Check-ins por ${datos.unidadBuckets}`}
          notaDemo
          accion={
            <span className="text-[12px] text-aventurea-ink-soft">
              <span className="font-extrabold text-aventurea-ink">
                {kpis.checkIns.toLocaleString("es-CR")}
              </span>{" "}
              en el período
            </span>
          }
        >
          <GraficoBarras
            barras={datos.buckets.map((b) => ({ etiqueta: b.etiqueta, valor: b.checkIns }))}
            serie="Check-ins"
            color="var(--color-aventurea-green)"
          />
        </TarjetaPanel>

        <TarjetaPanel kicker="Evolución" titulo={`Ventas estimadas por ${datos.unidadBuckets}`} notaDemo>
          <GraficoVentas
            puntos={datos.buckets.map((b) => ({ etiqueta: b.etiqueta, valor: b.ventasEstimadas }))}
          />
          <NotaEstimacion className="mt-2" />
        </TarjetaPanel>
      </section>

      {/* ── 4 · La demanda: cuándo te buscan ───────────────────────── */}
      <section aria-label="Demanda por horario y día" className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <TarjetaPanel kicker="Demanda" titulo="Horarios más demandados" notaDemo>
          <MapaCalor
            filas={datos.mapaCalor.filas}
            columnas={datos.mapaCalor.columnas}
            valores={datos.mapaCalor.valores}
            serie="Demanda estimada"
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-aventurea-ink">
            {datos.notaHorario}
          </p>
        </TarjetaPanel>

        <TarjetaPanel kicker="Demanda" titulo="Días más demandados" notaDemo>
          <GraficoBarras barras={datos.diasSemana} serie="Reservas por día" />
          <p className="mt-3 text-[12.5px] leading-relaxed text-aventurea-ink">{datos.notaDia}</p>
        </TarjetaPanel>
      </section>

      {/* ── 5 · Rendimiento por promoción ──────────────────────────── */}
      <TarjetaPanel
        kicker="Promociones"
        titulo="Rendimiento por promoción"
        notaDemo
        accion={
          <Link href="/food/negocio/promociones" className={ENLACE_CARD}>
            Administrar promociones →
          </Link>
        }
      >
        <ul className="flex flex-col gap-2.5">
          {datos.promos.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-1 items-center gap-x-4 gap-y-2 rounded-2xl border border-aventurea-line bg-white p-3.5 md:grid-cols-[minmax(0,1.2fr)_auto_minmax(150px,0.8fr)]"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-aventurea-ink">
                  {p.nombre}
                  {p.mejor && (
                    <span className="rounded-md bg-aventurea-green-light px-1.5 py-0.5 text-[10.5px] font-bold text-aventurea-green">
                      La que mejor convierte
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">{p.detalle}</p>
              </div>

              {/* El embudo completo, en el orden en que pasa: vieron →
                  reservaron → llegaron. */}
              <p className="whitespace-nowrap text-[12.5px] tabular-nums text-aventurea-ink-soft">
                <span className="font-bold text-aventurea-ink">
                  {p.visualizaciones.toLocaleString("es-CR")}
                </span>{" "}
                vistas · <span className="font-bold text-aventurea-ink">{p.reservas}</span>{" "}
                reservas · <span className="font-bold text-aventurea-ink">{p.checkIns}</span>{" "}
                check-ins
              </p>

              <div className="flex items-center gap-2.5">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-aventurea-cream-2"
                  role="img"
                  aria-label={`Conversión de ${p.nombre}: ${p.conversion.toLocaleString("es-CR")}% de las vistas terminaron en reserva`}
                >
                  <div
                    className="h-full rounded-full bg-aventurea-sky"
                    style={{ width: `${Math.round((p.conversion / mejorConversion) * 100)}%` }}
                  />
                </div>
                <p className="w-12 shrink-0 text-right text-[12.5px] font-extrabold tabular-nums text-aventurea-ink">
                  {p.conversion.toLocaleString("es-CR", { maximumFractionDigits: 1 })}%
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11.5px] text-aventurea-ink-soft">
          Conversión = reservas ÷ visualizaciones de la promoción.
        </p>
      </TarjetaPanel>
    </div>
  );
}
