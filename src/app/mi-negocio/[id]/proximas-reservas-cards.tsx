import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import type { EventoAgenda } from "@/components/agenda-eventos";
import { IconCalendarLine } from "@/components/icons";

/**
 * Vistazo rápido de lo próximo — solo las 5 reservas más cercanas, en
 * tarjetas chicas. El historial completo (con filtros, mensajes y
 * acciones) vive en "Todas tus reservas" justo debajo; esto es para
 * ver de un vistazo qué viene sin tener que desplegar nada.
 */

const MOSTRAR = 5;

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "En aprobación",
  confirmada: "Confirmada",
};

// Pills sólidos, no los tenues de fondo claro: sobre el azul navy de
// la tarjeta, un bg-orange/10 casi no se ve.
const ESTADO_CLS: Record<string, string> = {
  pendiente: "bg-aventurea-orange text-white",
  confirmada: "bg-aventurea-green text-white",
};

function fmtColones(n: number | null) {
  if (n === null) return null;
  return "₡" + Number(n).toLocaleString("es-CR");
}

function fechaCorta(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short" });
}

export default function ProximasReservasCards({ eventos }: { eventos: EventoAgenda[] }) {
  const hoy = hoyISOCR();
  const manana = sumarDiasISO(hoy, 1);
  const proximas = eventos.slice(0, MOSTRAR);

  if (proximas.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
        No hay reservas próximas en la agenda.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {proximas.map((e) => {
        const esHoy = e.fecha === hoy;
        const esManana = e.fecha === manana;
        return (
          <div
            key={e.id}
            className="relative min-w-0 overflow-hidden rounded-xl bg-aventurea-navy px-3 py-2.5"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-2.5 -top-3 rotate-[14deg] text-white/[0.1]"
            >
              <IconCalendarLine className="h-16 w-16" />
            </span>
            <div className="relative z-10">
              <p className="truncate text-[10px] font-bold uppercase tracking-wide text-aventurea-orange">
                {esHoy ? "Hoy" : esManana ? "Mañana" : fechaCorta(e.fecha)}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] font-bold text-white">
                {e.nombre ?? "Sin nombre"}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-1.5">
                {e.monto_total !== null ? (
                  <span className="truncate text-[11.5px] font-bold text-white">
                    {fmtColones(e.monto_total)}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold ${ESTADO_CLS[e.estado] ?? "bg-aventurea-cream-2 text-aventurea-ink-soft"}`}
                >
                  {ESTADO_LABEL[e.estado] ?? e.estado}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
