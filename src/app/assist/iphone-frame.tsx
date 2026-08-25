"use client";

/**
 * El mockup de iPhone reusable: marco + Dynamic Island + barra de
 * estado (hora + señal/wifi/batería en SVG inline) + botones del canto
 * + barra de home. `children` es lo único que cambia entre secciones
 * (el hilo de chat del hero, el paso de "Cómo funciona", el chat de un
 * escenario).
 *
 * El tilt 3D con el mouse es un efecto local (no pasa por el motor de
 * scroll: no depende del scroll, depende del puntero) y se apaga solo
 * si el dispositivo no tiene mouse fino (`hover:hover / pointer:fine`)
 * o si el visitante pidió `prefers-reduced-motion: reduce`.
 */

import { useEffect, useRef, type RefObject } from "react";
import { useMotionReducido } from "./motor";
import estilos from "./assist.module.css";

function useTiltPuntero(ref: RefObject<HTMLDivElement | null>) {
  const reducedMotion = useMotionReducido();
  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const alMover = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tiltX", `${(-py * 7).toFixed(2)}deg`);
      el.style.setProperty("--tiltY", `${(px * 9).toFixed(2)}deg`);
    };
    const alSalir = () => {
      el.style.setProperty("--tiltX", "0deg");
      el.style.setProperty("--tiltY", "0deg");
    };
    el.addEventListener("pointermove", alMover);
    el.addEventListener("pointerleave", alSalir);
    return () => {
      el.removeEventListener("pointermove", alMover);
      el.removeEventListener("pointerleave", alSalir);
    };
  }, [reducedMotion, ref]);
}

function IconoSenal() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true">
      <rect x="0" y="7" width="3" height="5" rx="0.6" fill="currentColor" />
      <rect x="4.5" y="5" width="3" height="7" rx="0.6" fill="currentColor" />
      <rect x="9" y="3" width="3" height="9" rx="0.6" fill="currentColor" />
      <rect x="13.5" y="0" width="3" height="12" rx="0.6" fill="currentColor" />
    </svg>
  );
}

function IconoWifi() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <path
        d="M8 10.4a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z"
        fill="currentColor"
      />
      <path
        d="M4.7 7.2a4.6 4.6 0 0 1 6.6 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M2 4.4a8.4 8.4 0 0 1 12 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function IconoBateria() {
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true">
      <rect
        x="0.75"
        y="0.75"
        width="20.5"
        height="10.5"
        rx="2.8"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <rect x="2.25" y="2.25" width="17.5" height="7.5" rx="1.6" fill="currentColor" />
      <rect x="22.5" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

type PropsIphoneFrame = {
  children: React.ReactNode;
  hora?: string;
  className?: string;
  etiqueta?: string;
};

export default function IphoneFrame({
  children,
  hora = "9:41",
  className,
  etiqueta,
}: PropsIphoneFrame) {
  const ref = useRef<HTMLDivElement | null>(null);
  useTiltPuntero(ref);

  return (
    <div
      ref={ref}
      className={`${estilos.iphone} ${className ?? ""}`}
      aria-label={etiqueta}
    >
      <div className={estilos.iphoneCanto} aria-hidden="true" />
      <div className={estilos.iphonePantalla}>
        <div className={estilos.iphoneStatusBar}>
          <span className={estilos.iphoneHora}>{hora}</span>
          <div className={estilos.iphoneIsla} aria-hidden="true" />
          <span className={estilos.iphoneIconos}>
            <IconoSenal />
            <IconoWifi />
            <IconoBateria />
          </span>
        </div>
        <div className={estilos.iphoneContenido}>{children}</div>
        <div className={estilos.iphoneHome} aria-hidden="true" />
      </div>
    </div>
  );
}
