import { fmtColones } from "@/lib/finanzas";
import { compararTexto, type Metricas } from "./metricas";

function fmtFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

/** Un número del tablero — sin caja ni fondo, solo tipografía. El
 *  naranja marca lo que es plata (ingresos, lo que falta cobrar), el
 *  resto queda neutro. */
function Dato({
  titulo,
  valor,
  detalle,
  plata = false,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  plata?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p
        className={`mt-0.5 text-[17px] font-bold leading-tight ${plata ? "text-aventurea-orange" : "text-aventurea-ink"}`}
      >
        {valor}
      </p>
      {detalle && <p className="mt-0.5 truncate text-[11px] leading-snug text-zinc-500">{detalle}</p>}
    </div>
  );
}

/**
 * Resumen de rendimiento como una barra de números, sin tarjetas ni
 * fondos — minimalista, separado solo por el aire entre columnas.
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
      <p className="text-[12.5px] text-zinc-500">
        Todavía no tenés reservas registradas — en cuanto entre la primera, acá vas a ver cómo
        te está yendo mes a mes.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3 lg:grid-cols-6">
      <Dato
        titulo="Reservas este mes"
        valor={String(reservasEsteMes)}
        detalle={compararTexto(reservasEsteMes, reservasMesAnterior)}
      />
      <Dato
        titulo="Ingresos este mes"
        valor={fmtColones(ingresosEsteMes)}
        detalle={compararTexto(ingresosEsteMes, ingresosMesAnterior)}
        plata
      />
      <Dato
        titulo="Próxima reserva"
        valor={proximaReserva ? fmtFechaCorta(proximaReserva.fecha) : "—"}
        detalle={proximaReserva?.nombre ?? (proximaReserva ? undefined : "Nada agendado")}
      />
      {esLugar && ocupacionProximos30 !== null && (
        <Dato titulo="Ocupación 30 días" valor={`${ocupacionProximos30}%`} detalle="Días ya confirmados" />
      )}
      <Dato
        titulo="Por cobrar 30 días"
        valor={fmtColones(porCobrarProximos30)}
        detalle="Saldos que faltan"
        plata
      />
      <Dato titulo="Reservas totales" valor={String(totalReservasHistorico)} detalle="Desde siempre" />
    </div>
  );
}
