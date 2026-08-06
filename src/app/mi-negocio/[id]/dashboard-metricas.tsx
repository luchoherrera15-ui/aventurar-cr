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

/** Las dos pieles suaves del tablero, alternadas por posición: azul
 *  suave y celeste. Un mar de tarjetas blancas idénticas cansaba la
 *  vista — el tinte le da aire y la marca de agua toma el tono de su
 *  propia piel en vez de ser siempre navy sobre blanco. */
const PIELES = [
  {
    card: "border-aventurea-navy/10 bg-aventurea-blue-light",
    marca: "text-aventurea-navy/10",
  },
  // sky/20 y no sky-light: los tokens *-light azules son casi el mismo
  // color (#e8f0f9 vs #e8f2fb) y la alternancia no se notaba.
  {
    card: "border-aventurea-sky/30 bg-aventurea-sky/20",
    marca: "text-aventurea-sky-dark/20",
  },
] as const;

/** Un número del tablero, con su ícono de marca de agua sangrando por
 *  la esquina (el overflow-hidden lo recorta). El naranja marca lo que
 *  es plata (ingresos, lo que falta cobrar), el resto queda neutro. */
function Dato({
  titulo,
  valor,
  detalle,
  icono,
  plata = false,
  piel,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  icono: ReactNode;
  plata?: boolean;
  piel: (typeof PIELES)[number];
}) {
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-2xl border px-3.5 py-3 ${piel.card}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-2.5 -top-3 rotate-[14deg] ${piel.marca} [&_svg]:h-16 [&_svg]:w-16`}
      >
        {icono}
      </span>
      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-wide text-aventurea-navy/60">
          {titulo}
        </p>
        <p
          className={`mt-0.5 text-[17px] font-bold leading-tight ${plata ? "text-aventurea-orange" : "text-aventurea-ink"}`}
        >
          {valor}
        </p>
        {detalle && (
          <p className="mt-0.5 truncate text-[11px] leading-snug text-aventurea-ink-soft">
            {detalle}
          </p>
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

  // Se arma la lista primero y la piel se decide por la POSICIÓN que
  // quedó al final — si una card condicional (ocupación) no está, la
  // alternancia no se rompe.
  const cards = [
    {
      titulo: "Reservas este mes",
      valor: String(reservasEsteMes),
      detalle: compararTexto(reservasEsteMes, reservasMesAnterior),
      icono: <IconCalendarLine />,
    },
    {
      titulo: "Ingresos este mes",
      valor: fmtColones(ingresosEsteMes),
      detalle: compararTexto(ingresosEsteMes, ingresosMesAnterior),
      icono: <IconChartBars />,
      plata: true,
    },
    {
      titulo: "Próxima reserva",
      valor: proximaReserva ? fmtFechaCorta(proximaReserva.fecha) : "—",
      detalle: proximaReserva?.nombre ?? (proximaReserva ? undefined : "Nada agendado"),
      icono: <IconClock />,
    },
    ...(esLugar && ocupacionProximos30 !== null
      ? [
          {
            titulo: "Ocupación 30 días",
            valor: `${ocupacionProximos30}%`,
            detalle: "Días ya confirmados",
            icono: <IconCheck />,
          },
        ]
      : []),
    {
      titulo: "Por cobrar 30 días",
      valor: fmtColones(porCobrarProximos30),
      detalle: "Saldos que faltan",
      icono: <IconTagLine />,
      plata: true,
    },
    {
      titulo: "Reservas totales",
      valor: String(totalReservasHistorico),
      detalle: "Desde siempre",
      icono: <IconUsers />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card, i) => (
        <Dato key={card.titulo} {...card} piel={PIELES[i % PIELES.length]} />
      ))}
    </div>
  );
}
