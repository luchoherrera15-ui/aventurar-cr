"use client";

import { useState, type ReactNode } from "react";
import { fmtColones } from "@/lib/finanzas";
import { compararTexto, type Metricas } from "./metricas";
import {
  IconCalendarLine,
  IconChartBars,
  IconCheck,
  IconChevronDown,
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

type Card = {
  titulo: string;
  valor: string;
  detalle?: string;
  icono: ReactNode;
  plata?: boolean;
};

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
}: Card & { piel: (typeof PIELES)[number] }) {
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-2xl border px-3 py-2.5 sm:px-3.5 sm:py-3 ${piel.card}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-2.5 -top-3 rotate-[14deg] ${piel.marca} [&_svg]:h-16 [&_svg]:w-16`}
      >
        {icono}
      </span>
      <div className="relative z-10">
        <p className="text-[9.5px] font-bold uppercase leading-tight tracking-wide text-aventurea-navy/60 sm:text-[10px]">
          {titulo}
        </p>
        <p
          className={`mt-0.5 text-[13.5px] font-bold leading-tight sm:text-[17px] ${plata ? "text-aventurea-orange" : "text-aventurea-ink"}`}
        >
          {valor}
        </p>
        {detalle && (
          <p className="mt-0.5 truncate text-[10.5px] leading-snug text-aventurea-ink-soft sm:text-[11px]">
            {detalle}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * El pulso del negocio en TRES números — los que de verdad se miran
 * todos los días: cuánta plata entró este mes, cuánta falta cobrar en
 * los próximos 30 y cuántas reservas cerró el mes. El resto (próxima
 * reserva, ocupación, total histórico) queda detrás de "Ver más": son
 * de análisis, no de operación, y seis tarjetas en fila saturaban el
 * teléfono.
 */
export default function DashboardMetricas({
  metricas,
  esLugar,
}: {
  metricas: Metricas;
  esLugar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
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

  // Las tres de siempre: lo que entró, lo que falta entrar, y el
  // volumen del mes. Nada de esto se repite más abajo en la pantalla.
  const principales: Card[] = [
    {
      titulo: "Ingresos este mes",
      valor: fmtColones(ingresosEsteMes),
      detalle: compararTexto(ingresosEsteMes, ingresosMesAnterior),
      icono: <IconChartBars />,
      plata: true,
    },
    {
      titulo: "Por cobrar 30 días",
      valor: fmtColones(porCobrarProximos30),
      detalle: "Saldos que faltan",
      icono: <IconTagLine />,
      plata: true,
    },
    {
      titulo: "Reservas este mes",
      valor: String(reservasEsteMes),
      detalle: compararTexto(reservasEsteMes, reservasMesAnterior),
      icono: <IconCalendarLine />,
    },
  ];

  // De análisis: la próxima reserva ya se ve en la agenda de abajo, y
  // ocupación/histórico se consultan de vez en cuando.
  const secundarias: Card[] = [
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
      titulo: "Reservas totales",
      valor: String(totalReservasHistorico),
      detalle: "Desde siempre",
      icono: <IconUsers />,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {principales.map((card, i) => (
          <Dato key={card.titulo} {...card} piel={PIELES[i % PIELES.length]} />
        ))}
      </div>

      {abierto && (
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
          {secundarias.map((card, i) => (
            <Dato key={card.titulo} {...card} piel={PIELES[(i + 1) % PIELES.length]} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex items-center gap-1 self-start text-[12px] font-bold text-aventurea-navy hover:underline"
      >
        {abierto ? "Ver menos" : "Ver más números"}
        <IconChevronDown
          className={`h-3.5 w-3.5 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
