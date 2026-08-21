/**
 * La píldora de estado del panel de FOOD. Un solo diccionario para
 * TODOS los estados que se pintan en tablas y listas — reservas del
 * demo (completada/pendiente/…), reservas reales (check_in) y promos
 * (activa/pausada) — así "cancelada" es del mismo rojo en Reservas,
 * en Clientes y en cualquier pantalla de la fase 2.
 *
 * Colores según la regla del producto: verde solo positivo, rojo solo
 * negativo, y lo neutro/informativo en la gama fría del sistema. Cada
 * par fondo-tinta es sólido y con contraste AA (mismos pares que usa
 * ESTADO_PILDORA del sistema de paneles). Server-safe.
 */

export type EstadoInsignia =
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show"
  | "check_in"
  | "activa"
  | "pausada";

const ESTILO: Record<EstadoInsignia, { etiqueta: string; clases: string; punto: string }> = {
  confirmada: {
    etiqueta: "Confirmada",
    clases: "bg-aventurea-sky-light text-aventurea-sky-dark",
    punto: "bg-aventurea-sky",
  },
  pendiente: {
    etiqueta: "Pendiente",
    clases: "bg-amber-50 text-amber-800",
    punto: "bg-amber-500",
  },
  completada: {
    etiqueta: "Completada",
    clases: "bg-aventurea-green-light text-aventurea-green",
    punto: "bg-aventurea-green",
  },
  check_in: {
    etiqueta: "Check-in hecho",
    clases: "bg-aventurea-green-light text-aventurea-green",
    punto: "bg-aventurea-green",
  },
  cancelada: {
    etiqueta: "Cancelada",
    clases: "bg-red-50 text-red-700",
    punto: "bg-red-500",
  },
  no_show: {
    etiqueta: "No se presentó",
    clases: "bg-aventurea-cream-2 text-aventurea-ink-soft",
    punto: "bg-aventurea-line-fuerte",
  },
  activa: {
    etiqueta: "Activa",
    clases: "bg-aventurea-green-light text-aventurea-green",
    punto: "bg-aventurea-green",
  },
  pausada: {
    etiqueta: "Pausada",
    clases: "bg-aventurea-cream-2 text-aventurea-ink-soft",
    punto: "bg-aventurea-line-fuerte",
  },
};

export function InsigniaEstado({
  estado,
  className = "",
}: {
  estado: EstadoInsignia;
  className?: string;
}) {
  const e = ESTILO[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${e.clases} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${e.punto}`} aria-hidden />
      {e.etiqueta}
    </span>
  );
}
