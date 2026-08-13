"use client";

import { useState, type ReactNode } from "react";
import { fmtColones } from "@/lib/finanzas";
import { compararTexto, type Metricas } from "./metricas";
import type { WidgetDashboard, WidgetId } from "@/lib/business/widgets";
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

/**
 * Cómo se pinta cada widget. El TÍTULO no está acá a propósito: lo pone
 * `widgetsDashboard` según el tipo de negocio ("Citas este mes" en una
 * barbería, "Reservas este mes" en un salón de eventos). Acá vive solo
 * el número y su ícono.
 */
function contenidoWidget(id: WidgetId, m: Metricas): Omit<Card, "titulo"> | null {
  switch (id) {
    case "ingresos_mes":
      return {
        valor: fmtColones(m.ingresosEsteMes),
        detalle: compararTexto(m.ingresosEsteMes, m.ingresosMesAnterior),
        icono: <IconChartBars />,
        plata: true,
      };
    case "por_cobrar_30":
      return {
        valor: fmtColones(m.porCobrarProximos30),
        detalle: "Saldos que faltan",
        icono: <IconTagLine />,
        plata: true,
      };
    case "reservas_mes":
      return {
        valor: String(m.reservasEsteMes),
        detalle: compararTexto(m.reservasEsteMes, m.reservasMesAnterior),
        icono: <IconCalendarLine />,
      };
    case "proxima_reserva":
      return {
        valor: m.proximaReserva ? fmtFechaCorta(m.proximaReserva.fecha) : "—",
        detalle: m.proximaReserva?.nombre ?? (m.proximaReserva ? undefined : "Nada agendado"),
        icono: <IconClock />,
      };
    case "ocupacion_30":
      return m.ocupacionProximos30 === null
        ? null
        : {
            valor: `${m.ocupacionProximos30}%`,
            detalle: "Días ya confirmados",
            icono: <IconCheck />,
          };
    case "reservas_historico":
      return {
        valor: String(m.totalReservasHistorico),
        detalle: "Desde siempre",
        icono: <IconUsers />,
      };
    default:
      return null;
  }
}

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
 * El pulso del negocio: los números que de verdad se miran todos los
 * días arriba, y los de análisis detrás de "Ver más" (seis tarjetas en
 * fila saturaban el teléfono).
 *
 * CUÁLES son y cómo se llaman ya no se decide acá: llegan en `widgets`,
 * resueltos por `widgetsDashboard` según el tipo de negocio y sus
 * módulos (src/lib/business/widgets.ts). Así una barbería lee "Citas
 * este mes" y un salón de eventos "Reservas este mes" con el MISMO
 * componente — y cuando lleguen membresías o check-ins, se agregan a
 * esa lista sin volver a tocar esta pantalla.
 */
export default function DashboardMetricas({
  metricas,
  widgets,
}: {
  metricas: Metricas;
  widgets: WidgetDashboard[];
}) {
  const [abierto, setAbierto] = useState(false);
  const { ingresosEsteMes, proximaReserva, totalReservasHistorico } = metricas;

  if (totalReservasHistorico === 0 && ingresosEsteMes === 0 && !proximaReserva) {
    return (
      <p className="text-[12.5px] text-zinc-500">
        Todavía no tenés reservas registradas — en cuanto entre la primera, acá vas a ver cómo
        te está yendo mes a mes.
      </p>
    );
  }

  const armar = (nivel: WidgetDashboard["nivel"]): Card[] =>
    widgets
      .filter((w) => w.nivel === nivel)
      .flatMap((w) => {
        const contenido = contenidoWidget(w.id, metricas);
        return contenido ? [{ titulo: w.titulo, ...contenido }] : [];
      });

  const principales = armar("principal");
  const secundarias = armar("secundario");

  if (principales.length === 0 && secundarias.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Dos columnas en móvil: con tres, cada tarjeta quedaba en 87px
          útiles y «₡12.500.000» se cortaba (un monto no tiene dónde
          partirse). */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
        {principales.map((card, i) => (
          <Dato key={card.titulo} {...card} piel={PIELES[i % PIELES.length]} />
        ))}
      </div>

      {abierto && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
          {secundarias.map((card, i) => (
            <Dato key={card.titulo} {...card} piel={PIELES[(i + 1) % PIELES.length]} />
          ))}
        </div>
      )}

      {secundarias.length > 0 && (
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
      )}
    </div>
  );
}
