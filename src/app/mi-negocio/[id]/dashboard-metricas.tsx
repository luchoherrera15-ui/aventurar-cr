"use client";

import { useState, type ReactNode } from "react";
import { fmtColones } from "@/lib/finanzas";
import { CardVacia, Metrica } from "@/components/panel/piezas";
import { GAP_METRICAS } from "@/components/panel/sistema";
import { compararTexto, type Metricas } from "./metricas";
import type { WidgetDashboard, WidgetId } from "@/lib/business/widgets";
import {
  IconCalendarLine,
  IconChartBars,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCompass,
  IconTagLine,
  IconUsers,
} from "@/components/icons";

function fmtFechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

type Card = {
  titulo: string;
  valor: string;
  detalle?: string;
  icono: ReactNode;
};

/**
 * LO QUE PASA HOY, ya resuelto por el servidor.
 *
 * Llega masticado (números y textos, nada de fechas ni objetos de
 * dominio) y NO se importa `citas/metricas-dia.ts` acá a propósito: ese
 * módulo arrastra el motor de disponibilidad, y meter un módulo de
 * servidor adentro de un componente `"use client"` es exactamente lo
 * que ya rompió Finanzas y el panel de IA en su momento.
 *
 * `null` significa "este negocio no tiene cómo saberlo", y entonces las
 * tarjetas del día no se pintan — no se pintan en cero.
 */
export type ResumenDelDia = {
  /** Cuántas visitas hay hoy, contadas con los estados reales. */
  total: number;
  /** "14 confirmadas · 2 sin confirmar", o null si no hay nada que decir. */
  desglose: string | null;
  /** 0-100, o null cuando no hay jornada contra la cual medir. */
  ocupacion: number | null;
  /** "5 h 30 min ocupados de 8 h" — el crudo del que sale el %. */
  detalleOcupacion: string | null;
};

/**
 * Cómo se pinta cada widget. El TÍTULO no está acá a propósito: lo pone
 * `widgetsDashboard` según el tipo de negocio ("Citas este mes" en una
 * barbería, "Reservas este mes" en un salón de eventos). Acá vive solo
 * el número y su ícono.
 */
function contenidoWidget(
  id: WidgetId,
  m: Metricas,
  dia: ResumenDelDia | null,
): Omit<Card, "titulo"> | null {
  switch (id) {
    case "reservas_hoy":
      return {
        // Con agenda por horas manda el conteo del día (mismo cálculo
        // que la pantalla de la agenda, para que no se contradigan);
        // sin ella, el conteo por fecha de las reservas.
        valor: String(dia?.total ?? m.reservasHoy),
        detalle: dia?.desglose ?? undefined,
        icono: <IconCalendarLine />,
      };
    case "ocupacion_hoy":
      // Sin jornada real no hay tarjeta. El `null` viaja desde
      // `metricasDelDia`, que devuelve null en vez de 0 justamente para
      // que acá se pueda distinguir "vacío" de "no se sabe".
      return dia?.ocupacion === null || dia?.ocupacion === undefined
        ? null
        : {
            valor: `${dia.ocupacion}%`,
            detalle: dia.detalleOcupacion ?? undefined,
            icono: <IconCompass />,
          };
    case "ingresos_mes":
      return {
        valor: fmtColones(m.ingresosEsteMes),
        detalle: compararTexto(m.ingresosEsteMes, m.ingresosMesAnterior),
        icono: <IconChartBars />,
      };
    case "por_cobrar_30":
      return {
        valor: fmtColones(m.porCobrarProximos30),
        detalle: "Saldos que faltan",
        icono: <IconTagLine />,
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
  dia = null,
}: {
  metricas: Metricas;
  widgets: WidgetDashboard[];
  /** Lo de hoy, cuando el negocio tiene agenda por horas. */
  dia?: ResumenDelDia | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const { ingresosEsteMes, proximaReserva, totalReservasHistorico } = metricas;

  if (totalReservasHistorico === 0 && ingresosEsteMes === 0 && !proximaReserva) {
    return (
      <CardVacia>
        Todavía no tenés reservas registradas — en cuanto entre la primera, acá vas a ver cómo
        te está yendo mes a mes.
      </CardVacia>
    );
  }

  const armar = (nivel: WidgetDashboard["nivel"]): Card[] =>
    widgets
      .filter((w) => w.nivel === nivel)
      .flatMap((w) => {
        const contenido = contenidoWidget(w.id, metricas, dia);
        return contenido ? [{ titulo: w.titulo, ...contenido }] : [];
      });

  const principales = armar("principal");
  const secundarias = armar("secundario");

  if (principales.length === 0 && secundarias.length === 0) return null;

  return (
    <div className={`flex flex-col ${GAP_METRICAS}`}>
      {/* Dos columnas en móvil: con tres, cada tarjeta quedaba en 87px
          útiles y «₡12.500.000» se cortaba (un monto no tiene dónde
          partirse). En pantalla grande la fila se ajusta a cuántas
          tarjetas hay de verdad: con cuatro son cuatro columnas, con
          tres son tres — nunca queda un hueco al final de la fila.

          Las principales nunca pasan de cuatro columnas aunque ahora
          sobre ancho: son cuatro tarjetas como máximo y estirarlas a
          seis huecos dejaría dos vacíos. El ancho de más se lo llevan
          las tarjetas, que es justo lo que hacía falta para que los
          montos largos dejaran de truncarse.

          El hueco entre tarjetas ya no es un número suelto: es
          `GAP_METRICAS`, los 12px de `.metrics` de la maqueta. */}
      <div
        className={`grid grid-cols-2 ${GAP_METRICAS} ${
          principales.length >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        {principales.map((card) => (
          <Metrica
            key={card.titulo}
            rotulo={card.titulo}
            valor={card.valor}
            detalle={card.detalle}
            icono={card.icono}
          />
        ))}
      </div>

      {/* Las secundarias sí son varias (hasta seis), y con el panel a
          pantalla completa entran todas en UNA fila en un monitor
          grande en vez de partirse en dos filas de tres. */}
      {abierto && (
        <div className={`grid grid-cols-2 ${GAP_METRICAS} sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6`}>
          {secundarias.map((card) => (
            <Metrica
              key={card.titulo}
              rotulo={card.titulo}
              valor={card.valor}
              detalle={card.detalle}
              icono={card.icono}
            />
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
