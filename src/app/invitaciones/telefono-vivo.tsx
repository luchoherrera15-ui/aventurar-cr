"use client";

import { useEffect, useRef, useState } from "react";
import Telefono from "@/components/solutions/telefono";

/**
 * EL TELÉFONO CON UNA INVITACIÓN DE VERDAD ADENTRO.
 *
 * No es una maqueta ni una captura: es la página /i/{slug} corriendo en
 * un iframe dentro del marco. Quien mira la landing puede deslizar la
 * invitación, abrir el sobre, tocar «Confirmar» — exactamente lo que va
 * a hacer su invitado. Es la pieza que convierte «te contamos cómo es»
 * en «probalo».
 *
 * ── POR QUÉ NO SE MONTA DE ENTRADA ──────────────────────────────────
 * Una invitación pesa lo que pesa una página entera (fuentes, fotos,
 * su propio React). Cargarla junto con el HTML de la landing atrasaría
 * lo primero que se pinta. Por eso el iframe se monta recién cuando el
 * marco está cerca de la pantalla Y el navegador está ocioso
 * (`requestIdleCallback`), y mientras tanto se ve un «papel» con el
 * nombre de la invitación, en los colores reales de ese diseño. Al
 * cargar, el papel se desvanece encima del iframe ya pintado — nunca
 * hay un rectángulo blanco.
 *
 * Cambiar `src` (las pestañas de la vitrina) vuelve a mostrar el papel
 * hasta que la nueva termine de cargar.
 */
/**
 * La barra de scroll del documento de ADENTRO se ve en escritorio y
 * rompe la ilusión de teléfono. Es el mismo origen, así que se le puede
 * agregar una regla al cargar; si algún día no lo fuera, el try lo
 * deja pasar y solo se ve la barra.
 */
function ocultarBarra(marco: HTMLIFrameElement) {
  try {
    const doc = marco.contentDocument;
    if (!doc?.head) return;
    const regla = doc.createElement("style");
    regla.textContent = "html{scrollbar-width:none}html::-webkit-scrollbar{display:none}";
    doc.head.appendChild(regla);
  } catch {
    // Otro origen: no se toca.
  }
}

export default function TelefonoVivo({
  src,
  titulo,
  ocasion,
  papel,
  ancho = 300,
  prioridad = false,
  className = "",
  claseSerif,
}: {
  /** La invitación real: /i/{slug}. */
  src: string;
  /** Lo que se lee en el papel mientras carga, y el título del iframe. */
  titulo: string;
  ocasion: string;
  /** Los colores reales de ese diseño (catalogo-invitaciones → muestra). */
  papel: { fondo: string; tinta: string; acento: string };
  ancho?: number;
  /** true en el héroe: no espera a que el marco se acerque, solo al ocio. */
  prioridad?: boolean;
  className?: string;
  claseSerif: string;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(prioridad);
  const [ocioso, setOcioso] = useState(false);
  // Qué `src` terminó de cargar. Se compara con el actual en vez de
  // resetearse en un efecto: al cambiar de invitación, el papel vuelve
  // solo porque el src cargado ya no es el que se muestra.
  const [cargadaSrc, setCargadaSrc] = useState<string | null>(null);
  const cargada = cargadaSrc === src;

  // Cerca de la pantalla: 300 px antes de asomar, para que el iframe
  // tenga tiempo de cargar mientras la persona todavía baja.
  useEffect(() => {
    if (cerca) return;
    const el = marcoRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setCerca(true);
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setCerca(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cerca]);

  // Ocioso: después de que el navegador terminó con lo urgente. Sin
  // `requestIdleCallback` (Safari) se espera un instante y listo.
  useEffect(() => {
    if (!cerca) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setOcioso(true), { timeout: 1500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setOcioso(true), 400);
    return () => clearTimeout(t);
  }, [cerca]);

  const montar = cerca && ocioso;

  return (
    <div ref={marcoRef} className={className}>
      <Telefono ancho={ancho} tinta={papel.tinta}>
        <div className="relative h-full w-full">
          {montar && (
            <iframe
              key={src}
              src={src}
              title={`Invitación de ejemplo: ${titulo}`}
              className="inv-ventana"
              loading="lazy"
              onLoad={(e) => {
                ocultarBarra(e.currentTarget);
                setCargadaSrc(src);
              }}
            />
          )}
          {/* El papel: encima del iframe hasta que cargue. No se
              desmonta de golpe — se desvanece con la duración de card. */}
          <div
            aria-hidden={cargada}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center transition-opacity duration-[var(--duracion-card)] ${
              cargada ? "pointer-events-none opacity-0" : "inv-papel-brillo opacity-100"
            }`}
            style={{ background: papel.fondo, color: papel.tinta }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.3em]"
              style={{ color: papel.acento }}
            >
              {ocasion}
            </span>
            <span className={`${claseSerif} text-[30px] leading-[1.05]`}>{titulo}</span>
            <span aria-hidden className="h-px w-10" style={{ background: papel.acento }} />
            <span className="text-[11.5px] opacity-70">
              {montar ? "Abriendo la invitación…" : "La invitación de verdad, en un momento."}
            </span>
          </div>
        </div>
      </Telefono>
    </div>
  );
}
