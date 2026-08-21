"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { formatearCRC } from "@/lib/dinero";

/**
 * LA TARJETA DE KPI DEL PANEL DE FOOD: rótulo, número grande animado,
 * tendencia contra el período anterior e icono. Es cliente solo por la
 * animación del número — todo lo demás podría ser servidor, pero
 * partirla en dos capas por eso no paga.
 *
 * La animación respeta prefers-reduced-motion: si la persona pidió
 * menos movimiento, el número aparece de una. Y el primer render
 * (SSR) ya trae el valor final, no un 0: si el JS tarda o no llega,
 * el dato está igual — la animación es progresiva, nunca requisito.
 */

/** Los formatos que sabe pintar la tarjeta (y animar: todos son numéricos). */
type FormatoKpi = "entero" | "colones" | "porcentaje";

function formatear(v: number, formato: FormatoKpi): string {
  if (formato === "colones") return formatearCRC(v);
  // Un decimal SIEMPRE (12,8%, no 13%): las tasas del panel viven en
  // ese orden de precisión y redondearlas al entero las haría bailar
  // contra el texto que las explica al lado.
  if (formato === "porcentaje")
    return `${v.toLocaleString("es-CR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  return Math.round(v).toLocaleString("es-CR");
}

export function KpiCard({
  rotulo,
  valor,
  formato = "entero",
  delta,
  notaDelta = "vs período anterior",
  detalle,
  icono,
  className = "",
}: {
  rotulo: string;
  valor: number;
  /** "colones" antepone ₡; "porcentaje" agrega % con un decimal;
   *  "entero" solo separa miles. Todo en formato es-CR. */
  formato?: FormatoKpi;
  /** Variación % (14.2 = +14,2%). Positivo pinta verde, negativo rojo. */
  delta?: number;
  /** La base de comparación de `delta`. */
  notaDelta?: string;
  /** Renglón de contexto bajo el número para las métricas SIN delta
   *  ("por mesa con check-in") — así una fila mezclada de tarjetas con
   *  y sin tendencia mantiene la misma altura y nadie queda mudo. */
  detalle?: string;
  /** Icono decorativo arriba a la derecha (de @/components/icons). */
  icono?: ReactNode;
  className?: string;
}) {
  // El span del número. El SSR ya trae el valor FINAL adentro (si el
  // JS no llega, el dato está igual) y la animación escribe
  // textContent a mano cuadro a cuadro: mutar el DOM desde el efecto
  // en vez de setState evita re-renderizar la tarjeta entera 40 veces
  // por segundo — es exactamente el caso "sincronizar con un sistema
  // externo" para el que son los efectos.
  const numeroRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const span = numeroRef.current;
    if (!span) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      span.textContent = formatear(valor, formato);
      return;
    }
    const inicio = performance.now();
    const DURACION = 650;
    let raf = requestAnimationFrame(function paso(ahora: number) {
      const t = Math.min(1, (ahora - inicio) / DURACION);
      const suave = 1 - Math.pow(1 - t, 3); // easeOutCubic
      span.textContent = formatear(valor * suave, formato);
      if (t < 1) raf = requestAnimationFrame(paso);
    });
    return () => cancelAnimationFrame(raf);
  }, [valor, formato]);

  const positivo = (delta ?? 0) >= 0;

  return (
    <div
      className={`rounded-2xl border border-aventurea-line bg-white p-4 shadow-[var(--shadow-plano)] transition-shadow hover:shadow-[var(--shadow-elevado)] ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-aventurea-ink-soft">
          {rotulo}
        </p>
        {icono && (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aventurea-cream-2 text-[15px] text-aventurea-navy"
            aria-hidden
          >
            {icono}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[27px] font-extrabold leading-none tracking-tight text-aventurea-ink">
        <span ref={numeroRef}>{formatear(valor, formato)}</span>
      </p>

      {delta !== undefined && (
        <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold ${
              positivo
                ? "bg-aventurea-green-light text-aventurea-green"
                : "bg-red-50 text-red-700"
            }`}
          >
            <span aria-hidden>{positivo ? "↑" : "↓"}</span>
            {positivo ? "+" : "−"}
            {Math.abs(delta).toLocaleString("es-CR", { maximumFractionDigits: 1 })}%
          </span>
          {notaDelta}
        </p>
      )}

      {detalle && (
        <p className="mt-2.5 text-[11.5px] leading-snug text-aventurea-ink-soft">{detalle}</p>
      )}
    </div>
  );
}
