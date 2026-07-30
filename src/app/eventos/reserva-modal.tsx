"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * El calendario de reserva desplegado en grande: ya no ocupa la
 * página — se abre al tocar cualquier enlace a #reservar ("Ver fechas
 * disponibles" en la tarjeta de precio, "Reservar mi fecha" arriba y
 * la barra fija del celular). Escuchar el hash mantiene funcionando
 * todos los botones del servidor sin convertirlos en islas de cliente.
 *
 * Cierra con la ✕, con Escape o tocando el velo; al cerrar limpia el
 * hash para que el mismo botón pueda volver a abrirlo.
 */
export default function ReservaModal({
  nombreRancho,
  children,
}: {
  nombreRancho: string;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    const revisar = () => {
      if (window.location.hash === "#reservar") setAbierta(true);
    };
    revisar();
    window.addEventListener("hashchange", revisar);
    return () => window.removeEventListener("hashchange", revisar);
  }, []);

  const cerrar = useCallback(() => {
    setAbierta(false);
    if (window.location.hash === "#reservar") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // Con el modal abierto, la página de atrás no scrollea.
  useEffect(() => {
    if (!abierta) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", alTeclear);
    };
  }, [abierta, cerrar]);

  if (!abierta) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Reservar en ${nombreRancho}`}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
    >
      {/* El velo casi no oscurece — solo difumina: la página se ve
          detrás, borrosa y con sus colores vivos. */}
      <button
        type="button"
        aria-label="Cerrar el calendario"
        onClick={cerrar}
        className="anim-velo-entrar absolute inset-0 cursor-default bg-[rgba(10,18,42,0.18)] backdrop-blur-[9px]"
      />
      {/* Panel más pequeño (se ve la página alrededor y cabe completo
          sin tanto scroll) y bien translúcido: la clase modal-vidrio
          vuelve vidrio también las tarjetas de ADENTRO (globals.css). */}
      <div className="anim-panel-entrar relative flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white/45 shadow-[0_48px_120px_-40px_rgba(6,12,32,0.5)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-6 py-2.5">
          <div className="min-w-0">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-aventurea-orange">
              Reservá tu fecha
            </p>
            <p className="truncate text-[15px] font-extrabold text-aventurea-ink">
              {nombreRancho}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-aventurea-line bg-white text-aventurea-ink shadow-sm transition-colors hover:border-aventurea-navy"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="modal-vidrio overflow-y-auto px-4 pb-8 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
