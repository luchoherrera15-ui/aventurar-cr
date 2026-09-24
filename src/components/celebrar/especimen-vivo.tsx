"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Telefono from "@/components/solutions/telefono";
import { DEMOS_DESTACADAS as DEMOS } from "@/lib/celebrar/demos";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";
import RenderInvitacion from "./invitacion/render-invitacion";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LA INVITACIÓN VIVA — el producto de verdad, dentro de un teléfono
 * ══════════════════════════════════════════════════════════════════
 *
 * El héroe muestra lo que la persona va a mandar: una invitación
 * COMPLETA (la misma que renderiza el editor y la página pública) con
 * fotos, programa, vestimenta, galería y el formulario de confirmación
 * al final. El teléfono se desplaza solo, despacio, para que quien mira
 * la vea entera; al llegar al final espera y pasa a la siguiente
 * celebración (boda → XV → cumpleaños → graduación).
 *
 * Se detiene cuando la persona lo toca, lo tiene bajo el cursor o lo
 * scrollea a mano (y retoma unos segundos después), con la pestaña
 * oculta y del todo con `prefers-reduced-motion` (quedan los puntos y
 * el scroll manual).
 */

/** Píxeles por segundo del paseo automático. */
const VELOCIDAD = 46;
/** Pausa arriba antes de empezar a bajar, y abajo antes de cambiar. */
const PAUSA_ARRIBA_MS = 2400;
const PAUSA_ABAJO_MS = 3800;
/** Cuánto espera después de que la persona scrollea a mano. */
const RESPIRO_MANUAL_MS = 6000;

export default function EspecimenVivo({ ancho = 290, className = "" }: { ancho?: number; className?: string }) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const movimientoReducido = useMovimientoReducido();
  const contenido = useRef<HTMLDivElement>(null);
  const manualHasta = useRef(0);
  const altoPantalla = Math.round(ancho * 2.05) - 14;

  const scroller = useCallback(() => contenido.current?.parentElement ?? null, []);

  const siguiente = useCallback(() => {
    const el = scroller();
    if (el) el.scrollTop = 0;
    setIndice((i) => (i + 1) % DEMOS.length);
  }, [scroller]);

  // El paseo automático: rAF que baja `VELOCIDAD` px/s con pausas arriba
  // y abajo. Se cancela al pausar y se reanuda donde estaba.
  useEffect(() => {
    if (pausado || movimientoReducido) return;
    let raf = 0;
    let fase: "arriba" | "bajando" | "abajo" = "arriba";
    let marca = performance.now();
    let ultimo = marca;
    // La posición se lleva en un acumulador con decimales: a 46 px/s son
    // ~0,75 px por cuadro, y `scrollTop` redondea — sumarle directo se
    // queda clavado (misma trampa que el desfile de rubros de Lealtad).
    let pos = scroller()?.scrollTop ?? 0;
    const paso = (ahora: number) => {
      const el = scroller();
      if (!el) {
        raf = requestAnimationFrame(paso);
        return;
      }
      if (document.hidden || ahora < manualHasta.current) {
        ultimo = ahora;
        marca = ahora;
        pos = el.scrollTop;
        raf = requestAnimationFrame(paso);
        return;
      }
      const fondo = el.scrollHeight - el.clientHeight;
      if (fase === "arriba") {
        if (ahora - marca > PAUSA_ARRIBA_MS) {
          fase = "bajando";
          ultimo = ahora;
        }
      } else if (fase === "bajando") {
        const dt = Math.min(0.1, (ahora - ultimo) / 1000);
        ultimo = ahora;
        pos = Math.min(fondo, pos + VELOCIDAD * dt);
        el.scrollTop = pos;
        if (pos >= fondo - 1) {
          fase = "abajo";
          marca = ahora;
        }
      } else if (ahora - marca > PAUSA_ABAJO_MS) {
        siguiente();
        fase = "arriba";
        marca = ahora;
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [pausado, movimientoReducido, scroller, siguiente, indice]);

  // Un scroll a mano (rueda o dedo) gana: el paseo espera un respiro.
  useEffect(() => {
    const el = scroller();
    if (!el) return;
    const manual = () => {
      manualHasta.current = performance.now() + RESPIRO_MANUAL_MS;
    };
    el.addEventListener("wheel", manual, { passive: true });
    el.addEventListener("touchmove", manual, { passive: true });
    return () => {
      el.removeEventListener("wheel", manual);
      el.removeEventListener("touchmove", manual);
    };
  }, [scroller]);

  const d = DEMOS[indice];

  return (
    <figure
      className={`flex flex-col items-center ${className}`}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={() => setPausado(false)}
    >
      <Telefono ancho={ancho} tinta={d.tintaBarra}>
        <div ref={contenido} key={d.id} className="c-especimen-texto">
          <RenderInvitacion documento={d.documento} celebracion={d.celebracion} modo="demo" altoPantalla={`${altoPantalla}px`} />
        </div>
      </Telefono>

      <figcaption className="mt-5 flex items-center gap-3 text-[13px] text-(--c-sobre-marino-suave)">
        <span>{d.etiqueta}</span>
        <div className="flex items-center gap-1" role="group" aria-label="Ver otra celebración">
          {DEMOS.map((demo, i) => (
            <button
              key={demo.id}
              type="button"
              onClick={() => {
                const el = scroller();
                if (el) el.scrollTop = 0;
                setIndice(i);
              }}
              aria-label={demo.etiqueta}
              aria-pressed={i === indice}
              className="flex h-8 w-8 items-center justify-center rounded-lg"
            >
              <span
                className="block h-2 w-2 rounded-full transition-transform duration-(--duracion-micro) ease-(--ease-bookea)"
                style={{
                  background: i === indice ? "var(--c-blanco)" : "var(--c-sobre-marino-suave)",
                  transform: i === indice ? "scale(1.35)" : "scale(1)",
                }}
              />
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
