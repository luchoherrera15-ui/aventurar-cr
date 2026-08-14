"use client";

import { fmtColones } from "@/lib/finanzas";
import type { ServicioPerfil } from "./perfil-tipos";

/**
 * La barra fija de reserva en mobile (patrón Fresha/Booksy): el
 * precio "desde" a la izquierda y un botón grande de "Reservar" a la
 * derecha, siempre a la vista mientras se scrollea el perfil.
 *
 * Solo visible en mobile (`lg:hidden`) — en desktop ya existe
 * TarjetaReservaSticky para el mismo propósito. No abre su propia
 * reserva: avisa con `onAbrir()` y quien la use decide qué mostrar
 * (acá: BookingBottomSheet con los pasos de reservar adentro).
 *
 * Ocupa espacio fijo abajo de la pantalla — la página que la monte
 * necesita dejarle sitio (ver nota de integración en el reporte).
 */
export default function MobileBookingBar({
  servicios,
  onAbrir,
}: {
  servicios: Pick<ServicioPerfil, "precio">[];
  onAbrir: () => void;
}) {
  const precios = servicios
    .map((s) => s.precio)
    .filter((p): p is number => p != null);
  const desde = precios.length > 0 ? Math.min(...precios) : null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-aventurea-line bg-white/95 shadow-[0_-8px_24px_-16px_rgba(22,41,94,0.25)] backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          {desde != null ? (
            <>
              <p className="text-[11px] font-semibold text-aventurea-ink-soft">Desde</p>
              <p className="truncate text-[17px] font-black leading-none tracking-[-0.2px] text-aventurea-ink">
                {fmtColones(desde)}
              </p>
            </>
          ) : (
            <p className="text-[13px] font-bold text-aventurea-ink">Elegí tu servicio</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAbrir}
          className="flex h-12 items-center justify-center rounded-xl bg-aventurea-sky px-7 text-[14.5px] font-bold text-white transition-colors hover:bg-aventurea-sky-dark active:bg-aventurea-sky-dark"
        >
          Reservar
        </button>
      </div>
    </div>
  );
}
