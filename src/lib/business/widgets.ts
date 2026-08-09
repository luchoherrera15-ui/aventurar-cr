/**
 * BOOKEA BUSINESS — qué números muestra el tablero de cada negocio.
 *
 * El dashboard no puede ser el mismo para todos: una barbería mira
 * "citas de hoy" y un estudio de pilates "clases y membresías por
 * vencer". Pero tampoco queremos tres tableros independientes con el
 * mismo código copiado — por eso el tablero es UN componente que
 * renderiza la lista de widgets que le entreguen, y esa lista se decide
 * acá, en una función pura y probable.
 *
 * En esta fase los widgets son los que YA se calculan
 * (src/app/mi-negocio/[id]/metricas.ts): lo que cambia por tipo de
 * negocio es el orden y CÓMO SE LLAMAN — "Citas este mes" en una
 * barbería, "Reservas este mes" en un salón de eventos. Los números de
 * membresías, check-ins y MRR se suman a esta misma lista cuando lleguen
 * sus fases; el componente no vuelve a tocarse.
 *
 * Módulo NEUTRAL (sin "use client"): lo usan la página del panel en el
 * servidor y el tablero en el navegador.
 */

import type { ModuloId, TipoNegocioId } from "./modulos";

export type WidgetId =
  | "ingresos_mes"
  | "por_cobrar_30"
  | "reservas_mes"
  | "proxima_reserva"
  | "ocupacion_30"
  | "reservas_historico";

export type WidgetDashboard = {
  id: WidgetId;
  titulo: string;
  /** Los principales van siempre visibles; los otros, tras "Ver más". */
  nivel: "principal" | "secundario";
};

/**
 * Cómo le dice cada negocio a lo que entra en su agenda. Un mismo
 * motor, tres palabras distintas — y una sola función que las decide,
 * para no repartir ternarios de copy por las pantallas.
 */
export function palabraReserva(tipo: TipoNegocioId): {
  singular: string;
  plural: string;
  Plural: string;
} {
  switch (tipo) {
    case "barberia":
    case "salon_belleza":
    case "unas":
    case "spa":
    case "masajes":
    case "consultorio":
    case "profesional":
    case "gimnasio":
    case "crossfit":
    case "pilates":
    case "yoga":
    case "academia":
    case "entrenador":
      return { singular: "cita", plural: "citas", Plural: "Citas" };
    case "hospedaje":
      return { singular: "estadía", plural: "estadías", Plural: "Estadías" };
    default:
      return { singular: "reserva", plural: "reservas", Plural: "Reservas" };
  }
}

/**
 * Los widgets del tablero de este negocio, en orden. Un widget sin su
 * módulo no aparece: si el negocio apagó Pagos, no tiene sentido
 * mostrarle "por cobrar".
 *
 * `ocupacionDisponible` llega de afuera porque la ocupación solo se
 * puede calcular donde una fecha se reserva entera (Lugares) — en una
 * barbería el mismo día tiene veinte espacios y el porcentaje no
 * significa nada.
 */
export function widgetsDashboard({
  tipo,
  modulos,
  ocupacionDisponible,
}: {
  tipo: TipoNegocioId;
  modulos: ReadonlySet<ModuloId>;
  ocupacionDisponible: boolean;
}): WidgetDashboard[] {
  const { singular, Plural } = palabraReserva(tipo);
  const widgets: WidgetDashboard[] = [];

  if (modulos.has("pagos")) {
    widgets.push(
      { id: "ingresos_mes", titulo: "Ingresos este mes", nivel: "principal" },
      { id: "por_cobrar_30", titulo: "Por cobrar 30 días", nivel: "principal" },
    );
  }

  if (modulos.has("agenda")) {
    widgets.push(
      { id: "reservas_mes", titulo: `${Plural} este mes`, nivel: "principal" },
      { id: "proxima_reserva", titulo: `Próxima ${singular}`, nivel: "secundario" },
    );
    if (ocupacionDisponible) {
      widgets.push({ id: "ocupacion_30", titulo: "Ocupación 30 días", nivel: "secundario" });
    }
    widgets.push({
      id: "reservas_historico",
      titulo: `${Plural} totales`,
      nivel: "secundario",
    });
  }

  return widgets;
}
