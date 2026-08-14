import { IconClock } from "@/components/icons";
import { fmtColones } from "@/lib/finanzas";
import { etiquetaMinutos } from "../tipos";
import type { ServicioPerfil } from "./perfil-tipos";

/**
 * Una fila de servicio: nombre, descripción corta, duración y precio,
 * con su botón "Reservar". No abre nada por su cuenta — avisa con
 * `onReservar(servicio.id, null)` y quien lo compone (ServicesSection,
 * hoy) decide qué hacer (el motor de reservas real vive en
 * reservar-cita.tsx, que este componente ni importa).
 *
 * Sin borde propio a la izquierda/derecha: es una tarjeta completa
 * (rounded-2xl, borde de 1px) pensada para apilarse con `gap-3` dentro
 * de `ServicesSection`, no una fila plana con separadores como la
 * versión vieja de agenda-negocio.tsx.
 */
export default function ServiceCard({
  servicio,
  onReservar,
}: {
  servicio: ServicioPerfil;
  onReservar: (servicioId: string | null, miembroId: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-aventurea-line bg-white p-4 transition-colors hover:border-aventurea-navy sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-bold text-aventurea-ink">{servicio.nombre}</p>
        {servicio.descripcion && (
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            {servicio.descripcion}
          </p>
        )}
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-aventurea-navy">
          <IconClock className="h-3.5 w-3.5" />
          {etiquetaMinutos(servicio.duracion_minutos ?? 30)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="text-[14.5px] font-extrabold text-aventurea-ink">
          {servicio.precio !== null ? fmtColones(servicio.precio) : "Consultar"}
        </p>
        <button
          type="button"
          onClick={() => onReservar(servicio.id, null)}
          className="flex h-10 shrink-0 items-center rounded-xl border border-aventurea-navy px-4 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
        >
          Reservar
        </button>
      </div>
    </div>
  );
}
