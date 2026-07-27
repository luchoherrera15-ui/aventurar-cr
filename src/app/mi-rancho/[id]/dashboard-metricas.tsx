import { fmtColones } from "@/lib/finanzas";
import { compararTexto, type Metricas } from "./metricas";

function fmtFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

function Tarjeta({
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
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {titulo}
      </p>
      <p className={`mt-1.5 text-[22px] font-bold ${acento ? "text-aventurea-navy" : "text-aventurea-ink"}`}>
        {valor}
      </p>
      {detalle && <p className="mt-1 text-[12px] text-aventurea-ink-soft">{detalle}</p>}
    </div>
  );
}

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
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 text-[13.5px] text-aventurea-ink-soft">
        Todavía no tenés reservas registradas — en cuanto entre la primera, acá vas a ver cómo
        te está yendo mes a mes.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Tarjeta
        titulo="Reservas este mes"
        valor={String(reservasEsteMes)}
        detalle={compararTexto(reservasEsteMes, reservasMesAnterior)}
        acento
      />
      <Tarjeta
        titulo="Ingresos este mes"
        valor={fmtColones(ingresosEsteMes)}
        detalle={compararTexto(ingresosEsteMes, ingresosMesAnterior)}
      />
      <Tarjeta
        titulo="Próxima reserva"
        valor={proximaReserva ? fmtFechaCorta(proximaReserva.fecha) : "—"}
        detalle={proximaReserva?.nombre ?? (proximaReserva ? undefined : "Nada agendado")}
      />
      {esLugar && ocupacionProximos30 !== null && (
        <Tarjeta
          titulo="Ocupación (30 días)"
          valor={`${ocupacionProximos30}%`}
          detalle="De los próximos 30 días ya están confirmados"
        />
      )}
      <Tarjeta
        titulo="Por cobrar (30 días)"
        valor={fmtColones(porCobrarProximos30)}
        detalle="Saldo de eventos confirmados que faltan"
      />
      <Tarjeta titulo="Reservas totales" valor={String(totalReservasHistorico)} detalle="Desde siempre" />
    </div>
  );
}
