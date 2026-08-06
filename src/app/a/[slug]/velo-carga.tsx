"use client";

import { useEffect, useRef, useState } from "react";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";

/**
 * El velo de carga del álbum: al entrar se ve SOLO esto — el título en
 * la serif y un porcentaje que sube — y cuando las fotos ya están en el
 * caché del navegador, el velo se desvanece y el álbum aparece entero,
 * de una sola vez. Sin esto la grilla se iba pintando a pedazos, foto
 * por foto, y la primera impresión era un álbum a medio hacer.
 *
 * El porcentaje es real: se precargan las primeras fotos de la grilla
 * (las mismas URLs que va a pedir la grilla, así ya quedan en caché) y
 * cada una que llega mueve el número. Con un tope de tiempo: si la red
 * está lenta, a los 5 segundos se abre igual — un velo eterno es peor
 * que una grilla a medio cargar.
 */
export default function VeloCarga({
  urls,
  titulo,
  paleta,
  claseSerif,
}: {
  /** Las primeras fotos de la grilla, ya con el dominio completo. */
  urls: string[];
  titulo: string;
  paleta: Paleta;
  claseSerif: string;
}) {
  const [pct, setPct] = useState(0);
  const [desvaneciendo, setDesvaneciendo] = useState(false);
  const [visible, setVisible] = useState(true);
  const corrio = useRef(false);

  useEffect(() => {
    if (corrio.current) return;
    corrio.current = true;

    let vivo = true;
    const inicio = Date.now();

    // El velo se queda al menos un momento aunque todo esté en caché:
    // un destello de medio frame se siente como un error, no como una
    // bienvenida.
    const terminar = () => {
      if (!vivo) return;
      const espera = Math.max(0, 900 - (Date.now() - inicio));
      setTimeout(() => {
        if (!vivo) return;
        setPct(100);
        setDesvaneciendo(true);
        setTimeout(() => vivo && setVisible(false), 650);
      }, espera);
    };

    if (urls.length === 0) {
      terminar();
      return () => {
        vivo = false;
      };
    }

    const tope = setTimeout(terminar, 5000);
    let cargadas = 0;
    for (const u of urls) {
      const img = new window.Image();
      const unaMas = () => {
        cargadas += 1;
        if (!vivo) return;
        setPct(Math.min(99, Math.round((cargadas / urls.length) * 100)));
        if (cargadas === urls.length) {
          clearTimeout(tope);
          terminar();
        }
      };
      img.onload = unaMas;
      img.onerror = unaMas;
      img.src = u;
    }

    return () => {
      vivo = false;
      clearTimeout(tope);
    };
  }, [urls]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[70] flex flex-col items-center justify-center px-6 transition-opacity duration-[650ms] ${
        desvaneciendo ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: paleta.fondo, color: paleta.tinta }}
    >
      <p
        className="text-[10.5px] font-bold uppercase tracking-[0.34em]"
        style={{ color: conAlfa(paleta.tinta, 0.5) }}
      >
        El álbum del evento
      </p>
      <p
        className={`${claseSerif} mt-3 max-w-[16ch] text-center text-[clamp(30px,7vw,54px)] font-semibold italic leading-[1.08]`}
      >
        {titulo}
      </p>

      <div className="mt-9 flex items-baseline gap-4">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.3em]"
          style={{ color: conAlfa(paleta.tinta, 0.5) }}
        >
          Cargando…
        </span>
        <span
          className={`${claseSerif} text-[27px] italic tabular-nums`}
          style={{ color: paleta.acento }}
        >
          {pct}%
        </span>
      </div>
      <div
        className="mt-3 h-[3px] w-44 overflow-hidden rounded-full"
        style={{ background: conAlfa(paleta.tinta, 0.12) }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, background: paleta.acento }}
        />
      </div>
    </div>
  );
}
