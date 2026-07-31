import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";

/**
 * La agenda de eventos próximos: la misma pieza sirve al panel del
 * proveedor (sus reservas) y al admin (todas). Ordena por fecha y
 * resalta lo inmediato — HOY en naranja, MAÑANA en navy — para que el
 * control del día a día sea de un vistazo.
 */

export type EventoAgenda = {
  id: string;
  fecha: string;
  nombre: string | null;
  tipo_evento: string | null;
  invitados: number | null;
  estado: string;
  monto_total: number | null;
  horario_bloque?: string | null;
  /** Solo en la vista del admin, que mezcla todos los negocios. */
  ranchoNombre?: string | null;
};

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

function fechaLarga(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "En aprobación", cls: "bg-aventurea-orange/10 text-aventurea-orange-dark" },
  confirmada: { label: "Confirmada", cls: "bg-aventurea-green/10 text-aventurea-green" },
};

export default function AgendaEventos({ eventos }: { eventos: EventoAgenda[] }) {
  const hoy = hoyISOCR();
  const manana = sumarDiasISO(hoy, 1);

  if (eventos.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-5 text-[13.5px] text-aventurea-ink-soft">
        No hay eventos próximos en la agenda.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      {eventos.map((e) => {
        const esHoy = e.fecha === hoy;
        const esManana = e.fecha === manana;
        const badge = ESTADO_BADGE[e.estado];
        return (
          <div
            key={e.id}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-aventurea-line px-5 py-4 last:border-none ${
              esHoy ? "bg-aventurea-orange/5" : esManana ? "bg-aventurea-navy/5" : ""
            }`}
          >
            <div className="min-w-[150px]">
              <p className="text-[13.5px] font-bold capitalize text-aventurea-ink">
                {fechaLarga(e.fecha)}
              </p>
              {(esHoy || esManana) && (
                <span
                  className={`mt-1 inline-flex rounded-lg px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white ${
                    esHoy ? "bg-aventurea-orange" : "bg-aventurea-navy"
                  }`}
                >
                  {esHoy ? "¡Hoy!" : "Mañana"}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold text-aventurea-ink">
                {e.nombre ?? "Sin nombre"}
                {e.ranchoNombre && (
                  <span className="font-normal text-aventurea-ink-soft">
                    {" "}
                    · {e.ranchoNombre}
                  </span>
                )}
              </p>
              <p className="truncate text-[12.5px] text-aventurea-ink-soft">
                {[
                  e.tipo_evento,
                  e.invitados ? `${e.invitados} invitados` : null,
                  e.horario_bloque,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sin detalles"}
              </p>
            </div>

            {e.monto_total !== null && (
              <p className="shrink-0 text-[13.5px] font-bold text-aventurea-ink">
                {fmtColones(e.monto_total)}
              </p>
            )}

            {badge && (
              <span
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}
              >
                {badge.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
