import {
  EncabezadoPagina,
  GraficoBarras,
  KpiCard,
  NotaDemo,
  NotaEstimacion,
  TarjetaPanel,
} from "@/components/food/panel";
import { IconChartBars, IconHeart, IconSparkles, IconUsers } from "@/components/icons";
import { ENLACE_CARD } from "@/components/panel/sistema";
import Link from "next/link";
import {
  CLIENTES_DEMO,
  ROTULO_RANGO,
  rangoDe,
  rangoDesdeParam,
} from "@/lib/food/panel-demo";
import ClientesTabla from "./clientes-tabla";

/**
 * CLIENTES — la pantalla que responde "¿quién está viniendo por
 * Bookea?". Todo lo que se pinta acá sale de la utilería de
 * panel-demo.ts (y lo dice con "Datos de ejemplo"): el negocio todavía
 * no acumula volumen real de comensales, y esta pantalla existe para
 * enseñar la foto que va a tener cuando lo haga. El contrato es la
 * forma de los tipos de panel-demo.ts — el día que exista un
 * panel-datos.ts con agregaciones reales de food_reservations, esta
 * pantalla cambia el import y nada más.
 *
 * Números DERIVADOS, no afirmados: recurrentes = clientes − nuevos, y
 * la tasa de recurrencia y el % de nuevos se calculan de esa resta.
 * Así el selector de 7/30/90 días de la topbar nunca muestra un
 * porcentaje que las tarjetas de al lado no respalden — misma regla
 * que el resto del panel de demo.
 *
 * PRIVACIDAD a propósito: de un cliente se muestra el nombre y sus
 * métricas de visita, nada más. El correo y el teléfono son datos de
 * la cuenta de Bookea, no del restaurante, y este panel no los filtra.
 */
export default async function ClientesFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams es Promise en esta versión de Next — por eso el await.
  const rango = rangoDesdeParam((await searchParams).rango);
  const { kpis } = rangoDe(rango);

  // La resta es LA fuente: nada de un "24,3%" escrito a mano que
  // después no cierre contra los números de arriba.
  const recurrentes = kpis.clientes - kpis.clientesNuevos;
  const tasaRecurrencia = kpis.clientes > 0 ? (recurrentes / kpis.clientes) * 100 : 0;
  const pctNuevos =
    kpis.clientes > 0 ? Math.round((kpis.clientesNuevos / kpis.clientes) * 100) : 0;
  const tasaTexto = tasaRecurrencia.toLocaleString("es-CR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={`Los comensales que Bookea le acercó a tu restaurante · ${ROTULO_RANGO[
          rango
        ].toLowerCase()}.`}
      />

      {/* ── 1 · La foto rápida del período ─────────────────────────── */}
      <section aria-label="Métricas de clientes">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft">
            {ROTULO_RANGO[rango]}
          </h2>
          <NotaDemo />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            rotulo="Clientes"
            valor={kpis.clientes}
            delta={kpis.deltas.clientes}
            icono={<IconUsers className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Clientes nuevos"
            valor={kpis.clientesNuevos}
            icono={<IconSparkles className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Clientes recurrentes"
            valor={recurrentes}
            icono={<IconHeart className="h-4 w-4" />}
          />
          <KpiCard
            rotulo="Ticket promedio estimado"
            valor={kpis.ticketPromedio}
            formato="colones"
            icono={<IconChartBars className="h-4 w-4" />}
          />
        </div>
        <NotaEstimacion className="mt-2" />
      </section>

      {/* ── 2 · Composición y retención ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
        <TarjetaPanel kicker="Composición" titulo="Nuevos vs recurrentes" notaDemo>
          {/* Una sola serie categórica: la identidad la dan los rótulos
              del eje, no un color por barra — el mismo azul del sistema
              para las dos, como pide la guía de dataviz del sitio. */}
          <GraficoBarras
            barras={[
              { etiqueta: "Nuevos", valor: kpis.clientesNuevos },
              { etiqueta: "Recurrentes", valor: recurrentes },
            ]}
            serie="Clientes"
            alto={230}
          />
          <p className="mt-3 max-w-[58ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            El {pctNuevos}% de tus clientes del período llegó a tu restaurante por primera vez a
            través de Bookea.
          </p>
        </TarjetaPanel>

        <TarjetaPanel kicker="Retención" titulo="Tasa de recurrencia" notaDemo>
          <p className="text-[38px] font-extrabold leading-none tracking-tight tabular-nums text-aventurea-ink">
            {tasaTexto}%
          </p>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            {recurrentes.toLocaleString("es-CR")} de tus{" "}
            {kpis.clientes.toLocaleString("es-CR")} clientes del período ya habían venido antes.
          </p>
          {/* Verde de estado (retención = positivo), no color de serie:
              el medidor habla de "qué tan bien", no de "cuál grupo". */}
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-aventurea-cream-2"
            role="img"
            aria-label={`El ${tasaTexto}% de los clientes del período es recurrente`}
          >
            <div
              className="h-full rounded-full bg-aventurea-green"
              style={{ width: `${tasaRecurrencia.toFixed(1)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
            Recurrente = ya había reservado por Bookea antes de este período.
          </p>
        </TarjetaPanel>
      </div>

      {/* ── 3 · El directorio ──────────────────────────────────────── */}
      <TarjetaPanel
        kicker="Directorio"
        titulo="Tus clientes"
        notaDemo
        accion={
          <Link href="/food/negocio/reservas" className={ENLACE_CARD}>
            Ver reservas →
          </Link>
        }
      >
        <ClientesTabla clientes={CLIENTES_DEMO} />
      </TarjetaPanel>
    </div>
  );
}
