"use client";

import { useEffect, useRef, useState } from "react";
import { IconX } from "@/components/icons";

/** Debe coincidir con la duración de `duration-*` usada abajo: el
 *  timeout que desmonta el panel espera a que la transición de salida
 *  termine de jugar antes de sacarlo del DOM. */
const DURACION_MS = 260;

/**
 * Primitivo genérico de hoja inferior estilo app nativa (bottom
 * sheet): entra deslizando desde abajo, tiene manija arriba, cierra
 * con el fondo, con Escape o con la ✕, y bloquea el scroll de la
 * página mientras está abierta.
 *
 * No sabe nada del contenido que muestra — quien lo usa le pasa sus
 * propios pasos por `children` (acá: el flujo de reserva, sin que
 * este componente conozca servicios ni citas).
 */
export default function BookingBottomSheet({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo?: string;
  children: React.ReactNode;
}) {
  // Sigue montada un instante más allá de `abierto = false`: si se
  // desmontara de una vez no habría transición de salida, el panel
  // simplemente desaparecería de golpe.
  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(false);
  const [abiertoPrevio, setAbiertoPrevio] = useState(abierto);
  const cierreTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entradaFrame = useRef<number | null>(null);

  // Ajuste EN EL RENDER, no en un efecto (patrón oficial de React para
  // sincronizar estado con un cambio de prop): "montado"/"visible"
  // tienen que reflejar el nuevo `abierto` en el MISMO render, antes
  // del primer pintado — un efecto llegaría un frame tarde y el panel
  // arrancaría con un estado viejo.
  if (abierto !== abiertoPrevio) {
    setAbiertoPrevio(abierto);
    if (abierto) setMontado(true);
    else setVisible(false);
  }

  useEffect(() => {
    if (abierto) {
      if (cierreTimeout.current) {
        clearTimeout(cierreTimeout.current);
        cierreTimeout.current = null;
      }
      // Doble rAF: el primer frame pinta el estado "cerrado" (recién
      // montado), el segundo dispara la transición hacia "abierto".
      // Con un solo rAF, algunos navegadores lo coalescen con el
      // pintado inicial y el panel aparece sin deslizar.
      entradaFrame.current = requestAnimationFrame(() => {
        entradaFrame.current = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      cierreTimeout.current = setTimeout(() => setMontado(false), DURACION_MS);
    }
    return () => {
      if (entradaFrame.current) cancelAnimationFrame(entradaFrame.current);
    };
  }, [abierto]);

  useEffect(() => {
    if (!montado) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.body.style.overflow = previo;
      document.removeEventListener("keydown", alTeclado);
    };
  }, [montado, onCerrar]);

  if (!montado) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo ?? "Hoja inferior"}
      className="fixed inset-0 z-[100] flex items-end justify-center"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className={`absolute inset-0 cursor-default bg-[rgba(10,18,42,0.55)] backdrop-blur-[2px] transition-opacity duration-[260ms] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-24px_60px_-24px_rgba(6,12,32,0.45)] transition-all duration-[260ms] ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        style={{ maxHeight: "88vh" }}
      >
        {/* La manija visual — puramente decorativa, el cierre real es
            por el fondo, Escape o la ✕. */}
        <div className="flex shrink-0 justify-center pb-1 pt-2.5" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-aventurea-line" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-1">
          {titulo ? (
            <h2 className="text-[16px] font-extrabold tracking-[-0.2px] text-aventurea-ink">
              {titulo}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink transition-colors hover:border-aventurea-navy"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div
          className="overflow-y-auto overscroll-contain px-5"
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
