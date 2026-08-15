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

const ESTADO_CLS: Record<string, string> = {
  pendiente: "bg-aventurea-sky text-white",
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
        const monto = fmtColones(e.monto_total);
        return (
          <div
            key={e.id}
            className="group relative flex items-start gap-2.5 overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface p-3 shadow-[0_10px_28px_-20px_rgba(22,41,94,0.5)] transition-shadow hover:shadow-[0_14px_32px_-16px_rgba(22,41,94,0.35)] sm:block sm:p-4"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-4 hidden h-20 w-20 rounded-full bg-aventurea-sky/10 sm:block"
            />

            <span className="relative z-10 flex w-full items-center gap-2.5 sm:mb-3 sm:items-start sm:gap-0">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-sky/10 text-aventurea-sky"
              >
                <IconCalendarLine className="h-4 w-4" />
              </span>
              <span
                className={`ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[9.5px] font-extrabold sm:ml-0 sm:absolute sm:right-4 sm:top-4 ${ESTADO_CLS[e.estado] ?? "bg-aventurea-cream-2 text-aventurea-ink-soft"}`}
              >
                {ESTADO_LABEL[e.estado] ?? e.estado}
              </span>
            </span>

            <span className="relative z-10 mt-1.5 block min-w-0 flex-1 sm:mt-0">
              <span className="block truncate text-[12.5px] font-extrabold text-aventurea-ink sm:text-[14px]">
                {e.nombre ?? "Sin nombre"}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-aventurea-ink-soft sm:mt-1">
                <span className="font-bold uppercase tracking-wide text-aventurea-orange">
                  {esHoy ? "Hoy" : esManana ? "Mañana" : fechaCorta(e.fecha)}
                </span>
                {monto ? <span className="text-aventurea-ink"> · {monto}</span> : null}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
