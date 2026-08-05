import { fmtColones } from "@/lib/finanzas";
import type { ActividadItem } from "./metricas";

const ESTADO_LABEL: Record<ActividadItem["estado"], string> = {
  pendiente: "En aprobación",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
};

const ESTADO_CLASE: Record<ActividadItem["estado"], string> = {
  pendiente: "text-aventurea-orange",
  confirmada: "text-aventurea-green",
  rechazada: "text-red-600",
};

/** El feed de "qué pasó últimamente" de Inicio: las últimas reservas o
 *  solicitudes creadas, más recientes primero. */
export default function ActividadReciente({ items }: { items: ActividadItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
        Todavía no tenés actividad para mostrar acá.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      {items.map((it, i) => (
        <div
          key={it.id}
          className={`flex items-center justify-between gap-3 px-4 py-3 ${
            i > 0 ? "border-t border-aventurea-line/60" : ""
          }`}
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-aventurea-ink">
              {it.nombre ?? "Sin nombre"}
            </p>
            <p className={`text-[11.5px] font-bold ${ESTADO_CLASE[it.estado]}`}>
              {ESTADO_LABEL[it.estado]}
            </p>
          </div>
          {it.monto !== null && (
            <span className="shrink-0 text-[13px] font-bold text-aventurea-ink">
              {fmtColones(it.monto)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
