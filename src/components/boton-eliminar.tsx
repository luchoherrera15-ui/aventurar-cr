"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/**
 * BORRAR CON CONFIRMACIÓN — el botón que no borra al primer clic.
 *
 * Un clic de más en una tabla no puede costar una fila. Acá "Eliminar"
 * no borra: abre una confirmación que dice EXACTAMENTE qué se va a
 * borrar (cliente, monto, fecha) y espera un segundo clic deliberado.
 * Se sale con Escape o tocando afuera, y mientras el servidor trabaja
 * el botón queda deshabilitado — un doble clic no dispara dos veces.
 *
 * Va acá, en components/, y no copiado en cada panel: la pregunta
 * "¿seguro?" tiene que verse y comportarse igual en todo el admin.
 *
 * No se usa `confirm()` del navegador a propósito: no deja mostrar el
 * detalle de la fila (que es lo único que evita borrar la equivocada),
 * no se puede estilar y en móvil aparece pegado al borde de la pantalla.
 */

/** Una línea del "esto es lo que se borra": rótulo + valor. */
export type DetalleEliminar = {
  rotulo: string;
  valor: string | null | undefined;
};

export type ResultadoEliminar = { error: string | null };

export default function BotonEliminar({
  que,
  detalles,
  advertencia,
  onEliminar,
  onEliminado,
  etiqueta = "Eliminar",
  confirmar = "Sí, eliminar",
  variante = "boton",
  className = "",
}: {
  /** Qué es la fila, en minúscula y con artículo: "el cobro", "la reserva". */
  que: string;
  /** Los datos que identifican la fila. Los vacíos se esconden solos. */
  detalles: DetalleEliminar[];
  /**
   * El aviso grande, para cuando la fila es de plata: se dice con todas
   * las letras que se borra para siempre y que los totales cambian.
   */
  advertencia?: string | null;
  /** El borrado real. Devuelve `{ error }` como el resto de las actions. */
  onEliminar: () => Promise<ResultadoEliminar>;
  /** Se llama solo si el servidor confirmó el borrado (para sacar la fila). */
  onEliminado?: () => void;
  etiqueta?: string;
  confirmar?: string;
  /** "boton": botón con borde. "texto": enlace subrayado, para tablas densas. */
  variante?: "boton" | "texto";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  // El foco arranca en "Cancelar": si alguien abre el diálogo sin
  // querer y le da Enter, no borra nada.
  const cancelarRef = useRef<HTMLButtonElement | null>(null);

  const cerrar = useCallback(() => {
    if (pendiente) return;
    setAbierto(false);
    setError(null);
  }, [pendiente]);

  useEffect(() => {
    if (!abierto) return;
    cancelarRef.current?.focus();
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [abierto, cerrar]);

  function eliminar() {
    setError(null);
    startTransition(async () => {
      const res = await onEliminar();
      if (res?.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      onEliminado?.();
    });
  }

  const visibles = detalles.filter(
    (d) => d.valor !== null && d.valor !== undefined && String(d.valor).trim() !== "",
  );

  const estiloDisparador =
    variante === "texto"
      ? "text-[11px] font-bold text-red-700 underline underline-offset-2 hover:text-red-800 disabled:opacity-50"
      : "rounded-[10px] border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-red-700 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAbierto(true);
        }}
        className={`${estiloDisparador} ${className}`}
      >
        {etiqueta}
      </button>

      {abierto && (
        <div
          role="presentation"
          onClick={cerrar}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-aventurea-ink/70 p-4 backdrop-blur-[2px] sm:items-center"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="borrar-titulo"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-2xl"
          >
            <div className="bg-aventurea-navy px-5 py-4">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/60">
                Confirmá antes de borrar
              </p>
              <h2
                id="borrar-titulo"
                className="mt-1 text-[16.5px] font-bold leading-snug text-white"
              >
                ¿Eliminar {que}?
              </h2>
            </div>

            <div className="px-5 py-4">
              {visibles.length > 0 && (
                <dl className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3">
                  {visibles.map((d) => (
                    <div
                      key={d.rotulo}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-aventurea-line py-1.5 last:border-none"
                    >
                      <dt className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                        {d.rotulo}
                      </dt>
                      <dd className="min-w-0 break-words text-right text-[13px] font-semibold text-aventurea-ink">
                        {String(d.valor)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {advertencia && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] leading-relaxed text-red-800">
                  {advertencia}
                </p>
              )}

              <p className="mt-3 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                Esto no se puede deshacer. Si llegaste acá por un clic sin
                querer, dale a Cancelar.
              </p>

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[12.5px] font-semibold text-red-700">
                  {error}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-aventurea-line bg-aventurea-cream-2/50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                ref={cancelarRef}
                type="button"
                onClick={cerrar}
                disabled={pendiente}
                className="h-11 rounded-xl border border-aventurea-line bg-aventurea-surface px-5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy disabled:opacity-50 sm:h-10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={pendiente}
                className="h-11 rounded-xl bg-red-700 px-5 text-[13.5px] font-bold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
              >
                {pendiente ? "Eliminando…" : confirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
