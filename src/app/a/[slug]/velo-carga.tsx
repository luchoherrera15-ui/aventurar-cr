"use client";

import { useEffect, useRef, useState } from "react";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";

/** Cuántas fotos de la grilla se esperan antes de abrir el velo. */
const FOTOS_A_ESPERAR = 6;
/** El velo no se va antes de esto, aunque todo esté en caché. */
const MINIMO_MS = 600;
/** Ni se queda más que esto, aunque la red esté pésima. */
const TOPE_MS = 3000;

/**
 * El velo de carga del álbum: al entrar se ve SOLO esto — el título en
 * la serif y un porcentaje que sube — y cuando las primeras fotos ya
 * están, el velo se desvanece y el álbum aparece entero, de una sola
 * vez. Sin esto la grilla se iba pintando a pedazos, foto por foto, y
 * la primera impresión era un álbum a medio hacer.
 *
 * ── QUÉ SE ARREGLÓ ACÁ (y era caro) ──────────────────────────────────
 *
 * Antes este velo recibía por props las URLs CRUDAS del bucket de
 * Supabase Storage y las descargaba con `new Image()` "para dejarlas en
 * caché". No quedaban en caché de nada: la grilla usa `next/image`, o
 * sea que pide `/_next/image?url=…&w=…`, que es OTRA URL. Resultado
 * medido en producción: el álbum bajaba cada foto DOS veces — 1193,8 KB
 * de originales sin optimizar (el mayor, 332,4 KB) MÁS 161 KB de las
 * versiones optimizadas que sí se ven. 1737 KB en total para una página
 * que necesita ~160 KB. Y encima esos originales le competían el ancho
 * de banda a las fotos de verdad, así que el velo se quedaba puesto más
 * tiempo por su propia culpa.
 *
 * Ahora el porcentaje mira las <img> que la grilla YA está pidiendo
 * (`document.images`, las de `/_next/image`). Cero bytes extra: es el
 * mismo trabajo que el navegador iba a hacer igual, solo que contado.
 * Y los tiempos bajaron de 900/5000 ms a 600/3000: el velo llegó a
 * retener la página hasta 5 segundos.
 */
export default function VeloCarga({
  hayFotos,
  titulo,
  paleta,
  claseSerif,
}: {
  /** Si el álbum tiene fotos; sin fotos el velo se abre de una. */
  hayFotos: boolean;
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
      const espera = Math.max(0, MINIMO_MS - (Date.now() - inicio));
      setTimeout(() => {
        if (!vivo) return;
        setPct(100);
        setDesvaneciendo(true);
        setTimeout(() => vivo && setVisible(false), 650);
      }, espera);
    };

    if (!hayFotos) {
      terminar();
      return () => {
        vivo = false;
      };
    }

    const tope = setTimeout(terminar, TOPE_MS);

    // Las fotos que la grilla ya está bajando por su cuenta. No se
    // dispara ninguna descarga nueva: solo se mira el progreso de las
    // que el navegador pidió al montar la página.
    const observadas = Array.from(document.images)
      .filter((img) => img.src.includes("/_next/image"))
      .slice(0, FOTOS_A_ESPERAR);

    if (observadas.length === 0) {
      // Todavía no montó la grilla (o no hay imágenes optimizadas): se
      // abre por tiempo, con el tope de arriba.
      return () => {
        vivo = false;
        clearTimeout(tope);
      };
    }

    let listas = 0;
    const total = observadas.length;
    const unaMas = () => {
      listas += 1;
      if (!vivo) return;
      setPct(Math.min(99, Math.round((listas / total) * 100)));
      if (listas === total) {
        clearTimeout(tope);
        terminar();
      }
    };

    const limpiezas: (() => void)[] = [];
    for (const img of observadas) {
      if (img.complete) {
        unaMas();
        continue;
      }
      img.addEventListener("load", unaMas);
      img.addEventListener("error", unaMas);
      limpiezas.push(() => {
        img.removeEventListener("load", unaMas);
        img.removeEventListener("error", unaMas);
      });
    }

    return () => {
      vivo = false;
      clearTimeout(tope);
      limpiezas.forEach((f) => f());
    };
  }, [hayFotos]);

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
