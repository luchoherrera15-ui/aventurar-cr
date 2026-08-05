import type { ReactNode } from "react";
import { fmtColones } from "@/lib/finanzas";
import { compararTexto, type Metricas } from "./metricas";
import {
  IconCalendarLine,
  IconChartBars,
  IconCheck,
  IconClock,
  IconTagLine,
  IconUsers,
} from "@/components/icons";

function fmtFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

/** Un número del tablero, en tarjeta blanca con su ícono de marca de
 *  agua sangrando por la esquina (el overflow-hidden lo recorta). El
 *  naranja marca lo que es plata (ingresos, lo que falta cobrar), el
 *  resto queda neutro. */
function Dato({
  titulo,
  valor,
  detalle,
  icono,
  plata = false,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  icono: ReactNode;
  plata?: boolean;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface px-3.5 py-3 shadow-sm">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-2.5 -top-3 rotate-[14deg] text-aventurea-navy/[0.07] [&_svg]:h-16 [&_svg]:w-16"
      >
        {icono}
      </span>
      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{titulo}</p>
        <p
          className={`mt-0.5 text-[17px] font-bold leading-tight ${plata ? "text-aventurea-orange" : "text-aventurea-ink"}`}
        >
          {valor}
        </p>
        {detalle && (
          <p className="mt-0.5 truncate text-[11px] leading-snug text-zinc-500">{detalle}</p>
        )}
      </div>
    </div>
  );
}

/** Resumen de rendimiento como una grilla de tarjetas chicas. */
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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <Dato
        titulo="Reservas este mes"
        valor={String(reservasEsteMes)}
        detalle={compararTexto(reservasEsteMes, reservasMesAnterior)}
        icono={<IconCalendarLine />}
      />
      <Dato
        titulo="Ingresos este mes"
        valor={fmtColones(ingresosEsteMes)}
        detalle={compararTexto(ingresosEsteMes, ingresosMesAnterior)}
        icono={<IconChartBars />}
        plata
      />
      <Dato
        titulo="Próxima reserva"
        valor={proximaReserva ? fmtFechaCorta(proximaReserva.fecha) : "—"}
        detalle={proximaReserva?.nombre ?? (proximaReserva ? undefined : "Nada agendado")}
        icono={<IconClock />}
      />
      {esLugar && ocupacionProximos30 !== null && (
        <Dato
          titulo="Ocupación 30 días"
          valor={`${ocupacionProximos30}%`}
          detalle="Días ya confirmados"
          icono={<IconCheck />}
        />
      )}
      <Dato
        titulo="Por cobrar 30 días"
        valor={fmtColones(porCobrarProximos30)}
        detalle="Saldos que faltan"
        icono={<IconTagLine />}
        plata
      />
      <Dato
        titulo="Reservas totales"
        valor={String(totalReservasHistorico)}
        detalle="Desde siempre"
        icono={<IconUsers />}
      />
    </div>
  );
}
