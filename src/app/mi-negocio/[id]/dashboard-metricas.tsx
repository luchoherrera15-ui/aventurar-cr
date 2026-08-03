import { fmtColones } from "@/lib/finanzas";
import { compararTexto, type Metricas } from "./metricas";

function fmtFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

/** Un número chico con su rótulo — nada de tarjetas gigantes. */
function Dato({
  titulo,
  valor,
  detalle,
  acento,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  acento?: boolean;
}) {
  return (
    <div className="min-w-0" title={detalle}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p
        className={`mt-0.5 text-[16px] font-bold leading-tight ${
          acento ? "text-aventurea-navy" : "text-aventurea-ink"
        }`}
      >
        {valor}
      </p>
      {detalle && (
        <p className="mt-0.5 max-w-[150px] truncate text-[10.5px] text-aventurea-ink-soft">
          {detalle}
        </p>
      )}
    </div>
  );
}

/**
 * Resumen de rendimiento en UNA fila compacta: los mismos números de
 * siempre, pero sin comerse media pantalla del panel.
 */
export default function DashboardMetricas({
  metricas,
  esLugar,
}: {
  metricas: Metricas;
  esLugar: boolean;
}) {
  const {
    reservasEsteMes,
    reservasMesAnterior,
    ingresosEsteMes,
    ingresosMesAnterior,
    proximaReserva,
    ocupacionProximos30,
    porCobrarProximos30,
    totalReservasHistorico,
  } = metricas;

  if (totalReservasHistorico === 0 && ingresosEsteMes === 0 && !proximaReserva) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-3.5 text-[12.5px] text-aventurea-ink-soft">
        Todavía no tenés reservas registradas — en cuanto entre la primera, acá vas a ver cómo
        te está yendo mes a mes.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-x-7 gap-y-3 rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-3.5">
      <Dato
        titulo="Reservas este mes"
        valor={String(reservasEsteMes)}
        detalle={compararTexto(reservasEsteMes, reservasMesAnterior)}
        acento
      />
      <Dato
        titulo="Ingresos este mes"
        valor={fmtColones(ingresosEsteMes)}
        detalle={compararTexto(ingresosEsteMes, ingresosMesAnterior)}
      />
      <Dato
        titulo="Próxima reserva"
        valor={proximaReserva ? fmtFechaCorta(proximaReserva.fecha) : "—"}
        detalle={proximaReserva?.nombre ?? (proximaReserva ? undefined : "Nada agendado")}
      />
      {esLugar && ocupacionProximos30 !== null && (
        <Dato
          titulo="Ocupación 30 días"
          valor={`${ocupacionProximos30}%`}
          detalle="Días ya confirmados"
        />
      )}
      <Dato
        titulo="Por cobrar 30 días"
        valor={fmtColones(porCobrarProximos30)}
        detalle="Saldos que faltan"
      />
      <Dato titulo="Reservas totales" valor={String(totalReservasHistorico)} detalle="Desde siempre" />
    </div>
  );
}
