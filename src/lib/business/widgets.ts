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
import type { Vocabulario } from "./identidad";

export type WidgetId =
  | "reservas_hoy"
  | "ocupacion_hoy"
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
  ocupacionDeHoyDisponible = false,
  vocabulario,
}: {
  tipo: TipoNegocioId;
  modulos: ReadonlySet<ModuloId>;
  ocupacionDisponible: boolean;
  /**
   * ¿Se puede calcular el % de agenda ocupada DE HOY? Solo es `true`
   * cuando `metricasDelDia` devolvió un número — o sea, cuando hay
   * jornada de verdad contra la cual medir (horario configurado y
   * alguien trabajando). Sin eso la tarjeta no se pinta: un 0% que
   * significa "no sabemos" es peor que una tarjeta menos.
   */
  ocupacionDeHoyDisponible?: boolean;
  /**
   * El vocabulario del tipo (`identidadDe(tipo).vocabulario`). Llega
   * como parámetro y no se importa acá para no cerrar el círculo:
   * `identidad.ts` ya lee `palabraReserva` de este archivo. Sin él se
   * cae a `palabraReserva`, que es de donde ese vocabulario hereda, así
   * que los dos caminos dicen lo mismo.
   */
  vocabulario?: Vocabulario;
}): WidgetDashboard[] {
  const heredada = palabraReserva(tipo);
  const singular = vocabulario?.visita.singular ?? heredada.singular;
  const Plural = vocabulario?.visita.Plural ?? heredada.Plural;
  const widgets: WidgetDashboard[] = [];

  // EL DÍA VA PRIMERO. El panel se abre en la mañana para saber qué hay
  // hoy, no cómo cerró el mes; el mes es análisis y baja un escalón.
  const hayHoy = modulos.has("agenda");
  if (hayHoy) {
    widgets.push({ id: "reservas_hoy", titulo: `${Plural} hoy`, nivel: "principal" });
    if (ocupacionDeHoyDisponible) {
      widgets.push({ id: "ocupacion_hoy", titulo: "Ocupación de hoy", nivel: "principal" });
    }
  }

  if (modulos.has("pagos")) {
    widgets.push(
      { id: "ingresos_mes", titulo: "Ingresos este mes", nivel: "principal" },
      { id: "por_cobrar_30", titulo: "Por cobrar 30 días", nivel: "principal" },
    );
  }

  if (modulos.has("agenda")) {
    widgets.push(
      // Con la tarjeta de hoy arriba, el total del mes pasa a ser el
      // número de análisis que era: cuatro tarjetas principales es lo
      // que entra de un vistazo, y la quinta se lee cuando se busca.
      { id: "reservas_mes", titulo: `${Plural} este mes`, nivel: hayHoy ? "secundario" : "principal" },
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
