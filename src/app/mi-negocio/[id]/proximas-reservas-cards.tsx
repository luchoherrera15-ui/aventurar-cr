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

/**
 * Píldoras sólidas. `aventurea-sky` con letra blanca daba 4,42:1 — por
 * debajo de AA para 9,5px, que es el tamaño real de esta píldora; el
 * tono oscuro de la misma familia (`sky-dark`) da 6,45:1 sin cambiar de
 * color. Verde queda como estaba: 5,32:1, ya pasaba.
 */
const ESTADO_CLS: Record<string, string> = {
  pendiente: "bg-aventurea-sky-dark text-white",
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
    // Son CINCO como máximo (`MOSTRAR`), así que la fila completa cabe
    // desde lg y de ahí para arriba solo se ensanchan las tarjetas — no
    // hay una sexta que agregar.
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {proximas.map((e) => {
        const esHoy = e.fecha === hoy;
        const esManana = e.fecha === manana;
        const monto = fmtColones(e.monto_total);
        return (
          /* Estas tarjetas se quedan BLANCAS, y no es un olvido: las de
             "Tu negocio en números" son ahora bloques sólidos y son la
             fila que tiene que llevarse la mirada al entrar. Si todo el
             tablero fuera del mismo azul no habría primera fila, habría
             una pared. Lo que sí se comparte es la regla: el círculo
             decorativo de la esquina —que acá también pasaba por detrás
             del nombre de la reserva— no va en ninguna. */
          <div
            key={e.id}
            className="group relative flex items-start gap-2.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-3 shadow-[0_10px_28px_-20px_rgba(22,41,94,0.5)] transition-shadow hover:shadow-[0_14px_32px_-16px_rgba(22,41,94,0.35)] sm:block sm:p-4"
          >
            {/* `relative` se queda: la píldora de estado se ancla acá
                adentro con `sm:absolute` a partir de sm. */}
            <span className="relative flex w-full items-center gap-2.5 sm:mb-3 sm:items-start sm:gap-0">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aventurea-sky-light text-aventurea-navy"
              >
                <IconCalendarLine className="h-4 w-4" />
              </span>
              <span
                className={`ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[9.5px] font-extrabold sm:ml-0 sm:absolute sm:right-4 sm:top-4 ${ESTADO_CLS[e.estado] ?? "bg-aventurea-cream-2 text-aventurea-ink-soft"}`}
              >
                {ESTADO_LABEL[e.estado] ?? e.estado}
              </span>
            </span>

            <span className="mt-1.5 block min-w-0 flex-1 sm:mt-0">
              <span className="block truncate text-[12.5px] font-extrabold text-aventurea-ink sm:text-[14px]">
                {e.nombre ?? "Sin nombre"}
              </span>
              {/* La jerarquía la hace la TIPOGRAFÍA, no el color: la
                  fecha va en negrita y versalitas sobre la tinta fuerte
                  (18,10:1) y el monto detrás en el gris de texto
                  (7,11:1). Antes la fecha iba en naranja —2,94:1— y
                  como cada tarjeta tiene la suya, la fila entera se leía
                  naranja sin que ninguna fecha fuera más urgente que
                  otra. */}
              <span className="mt-0.5 block truncate text-[11px] font-medium text-aventurea-ink-soft sm:mt-1">
                <span className="font-bold uppercase tracking-wide text-aventurea-ink">
                  {esHoy ? "Hoy" : esManana ? "Mañana" : fechaCorta(e.fecha)}
                </span>
                {monto ? <span> · {monto}</span> : null}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
