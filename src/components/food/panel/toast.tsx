"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheck, IconWarning } from "@/components/icons";

/**
 * EL TOAST DEL PANEL DE FOOD — el aviso flotante de "se guardó" que
 * piden las pantallas operativas (Disponibilidad, Check-in): acciones
 * rápidas y repetidas donde un banner fijo dentro del formulario
 * quedaría lejos de la vista, o directamente el formulario ya se
 * cerró cuando llega la respuesta.
 *
 * Es un HOOK y no un contexto a propósito: cada pantalla monta su
 * propio contenedor con `toast` y dispara con `avisar` — no hay
 * provider global que agregar al layout, y dos pantallas no pueden
 * pisarse los avisos porque cada una tiene el suyo.
 *
 *   const { avisar, toast } = useToastFood();
 *   ...
 *   avisar("exito", "Franja abierta.");
 *   ...
 *   return (<>{contenido}{toast}</>);
 *
 * DECISIONES:
 * — Un solo aviso a la vez (el nuevo reemplaza al anterior, con `key`
 *   por id para que la animación reinicie). En un mostrador con el
 *   servicio encima, una pila de toasts viejos es ruido, no historial.
 * — El contenedor `aria-live` está SIEMPRE montado, aunque no haya
 *   aviso: los lectores de pantalla solo anuncian cambios dentro de
 *   una región viva que ya existía — si apareciera junto con el texto,
 *   el anuncio se pierde.
 * — La entrada se anima mutando el DOM vía ref dentro de un rAF, como
 *   KpiCard y los gráficos: la regla `react-hooks/set-state-in-effect`
 *   del repo prohíbe el setState síncrono en efectos, y además así el
 *   fundido no re-renderiza nada. Con prefers-reduced-motion el aviso
 *   aparece de una, sin viaje.
 * — Verde solo para lo positivo y rojo solo para errores, como manda
 *   el sistema: el éxito va en tarjeta navy con disco verde, el error
 *   en rojo pleno — que un error no se pueda confundir con un logro.
 */

export type TonoToast = "exito" | "error";

type ToastActivo = { id: number; tono: TonoToast; texto: string };

export function useToastFood(): {
  /** Mostrar un aviso (reemplaza al que hubiera). */
  avisar: (tono: TonoToast, texto: string) => void;
  /** El contenedor a montar UNA vez, al final del árbol de la pantalla. */
  toast: ReactNode;
} {
  const [activo, setActivo] = useState<ToastActivo | null>(null);

  const avisar = useCallback((tono: TonoToast, texto: string) => {
    setActivo({ id: Date.now(), tono, texto });
  }, []);

  const cerrar = useCallback(() => setActivo(null), []);

  const toast = (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
    >
      {activo && (
        <Aviso key={activo.id} tono={activo.tono} texto={activo.texto} alTerminar={cerrar} />
      )}
    </div>
  );

  return { avisar, toast };
}

/** Cuánto vive cada aviso: los errores duran más porque hay que leerlos. */
const DURACION_MS: Record<TonoToast, number> = { exito: 4200, error: 7000 };

function Aviso({
  tono,
  texto,
  alTerminar,
}: {
  tono: TonoToast;
  texto: string;
  alTerminar: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    if (el) {
      if (reducido) {
        // Sin viaje: visible de una. La transición CSS no corre porque
        // no hay cambio de cuadro intermedio que animar.
        el.style.opacity = "1";
        el.style.transform = "none";
      } else {
        raf = requestAnimationFrame(() => {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        });
      }
    }

    // El cierre es asíncrono (setTimeout), no un setState síncrono del
    // efecto — es el patrón que la regla del repo sí permite.
    const temporizador = setTimeout(alTerminar, DURACION_MS[tono]);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(temporizador);
    };
  }, [alTerminar, tono]);

  const esExito = tono === "exito";

  return (
    <div
      ref={ref}
      // Clickeable para descartarlo antes de tiempo; role=status ya lo
      // anuncia el aria-live del contenedor.
      onClick={alTerminar}
      style={{ opacity: 0, transform: "translateY(10px)" }}
      className={`pointer-events-auto flex max-w-[440px] cursor-pointer items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-bold text-white shadow-[var(--shadow-flotante)] transition-[opacity,transform] duration-300 ${
        esExito ? "bg-aventurea-navy" : "bg-red-700"
      }`}
    >
      <span
        aria-hidden
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
          esExito ? "bg-aventurea-green text-white" : "bg-white/15 text-white"
        }`}
      >
        {esExito ? <IconCheck className="h-3.5 w-3.5" /> : <IconWarning className="h-3.5 w-3.5" />}
      </span>
      {texto}
    </div>
  );
}
