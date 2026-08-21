"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * GRÁFICO DE BARRAS PROPIO — SVG inline, sin dependencias. Mismas
 * reglas que el de área: barras de ≤24px con la punta redondeada 4px y
 * la base cuadrada, grilla recesiva con ticks lindos, tooltip por
 * barra (acá el hit target es el SLOT completo de la barra, no solo lo
 * pintado — nadie acierta una barra de 8px en el teléfono).
 *
 * `destacada` implementa la forma "énfasis" del sistema: si alguna
 * barra la trae, esa(s) llevan el color y el resto baja a gris — es la
 * manera honesta de decir "mirá este horario" sin inventar una segunda
 * serie. Lo usa Rendimiento para el pico de demanda, y sirve igual
 * para promos o días de la semana.
 */

export type BarraGrafico = { etiqueta: string; valor: number; destacada?: boolean };

function pasoLindo(v: number): number {
  const pot = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
  for (const m of [1, 2, 5, 10]) if (m * pot >= v) return m * pot;
  return 10 * pot;
}

export function GraficoBarras({
  barras,
  serie,
  color = "var(--color-aventurea-sky)",
  alto = 220,
  formatearValor = (v: number) => v.toLocaleString("es-CR"),
  formatearTick,
  className = "",
}: {
  barras: BarraGrafico[];
  /** Nombre de lo que mide ("Reservas por hora") — tooltip y aria. */
  serie: string;
  color?: string;
  alto?: number;
  formatearValor?: (v: number) => string;
  formatearTick?: (v: number) => string;
  className?: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const grupoRef = useRef<SVGGElement>(null);
  const [ancho, setAncho] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entradas) => {
      const w = entradas[0]?.contentRect.width;
      if (w) setAncho(Math.max(240, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Entrada suave sin estado: mismo mecanismo que GraficoArea (mutar
  // el estilo del grupo en un rAF y dejar que la transición CSS haga
  // el fundido) — así la animación no re-renderiza el SVG entero.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const g = grupoRef.current;
      if (g) g.style.opacity = "1";
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const MI = 42;
  const MD = 10;
  const MA = 12;
  const MB = 24;

  const geo = useMemo(() => {
    const n = barras.length;
    const maxDato = Math.max(1, ...barras.map((b) => b.valor));
    const paso = pasoLindo(Math.ceil(maxDato / 3));
    const maxY = Math.max(paso, paso * Math.ceil(maxDato / paso));
    const anchoUtil = ancho - MI - MD;
    const altoUtil = alto - MA - MB;
    const slot = n > 0 ? anchoUtil / n : anchoUtil;
    // ≤24px de grosor: la barra nunca llena su slot — el aire separa.
    const grosor = Math.min(24, slot * 0.6);
    const xSlot = (i: number) => MI + i * slot;
    const xBarra = (i: number) => xSlot(i) + (slot - grosor) / 2;
    const y = (v: number) => MA + altoUtil * (1 - v / maxY);
    const ticks: number[] = [];
    for (let t = paso; t <= maxY; t += paso) ticks.push(t);
    const cadaCuanto = n > 12 ? Math.ceil(n / 8) : 1;
    return { n, maxY, slot, grosor, xSlot, xBarra, y, ticks, cadaCuanto, baseY: MA + altoUtil };
  }, [barras, ancho, alto]);

  const hayEnfasis = barras.some((b) => b.destacada);
  const barraHover = hover !== null ? barras[hover] : null;

  /** Punta redondeada 4px, base cuadrada — nunca un rect con rx. */
  const caminoBarra = (i: number, valor: number): string => {
    const x = geo.xBarra(i);
    const yTop = geo.y(valor);
    const h = geo.baseY - yTop;
    const r = Math.min(4, h, geo.grosor / 2);
    const w = geo.grosor;
    return [
      `M${x},${geo.baseY}`,
      `L${x},${yTop + r}`,
      `Q${x},${yTop} ${x + r},${yTop}`,
      `L${x + w - r},${yTop}`,
      `Q${x + w},${yTop} ${x + w},${yTop + r}`,
      `L${x + w},${geo.baseY}`,
      "Z",
    ].join(" ");
  };

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <svg
        width={ancho}
        height={alto}
        role="img"
        aria-label={`${serie}: ${geo.n} categorías`}
        className="block max-w-full"
        onPointerLeave={() => setHover(null)}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line
              x1={MI}
              x2={ancho - MD}
              y1={geo.y(t)}
              y2={geo.y(t)}
              stroke="var(--color-aventurea-line)"
              strokeWidth={1}
            />
            <text
              x={MI - 8}
              y={geo.y(t) + 3.5}
              textAnchor="end"
              className="fill-aventurea-ink-soft text-[10px]"
            >
              {(formatearTick ?? formatearValor)(t)}
            </text>
          </g>
        ))}
        <line
          x1={MI}
          x2={ancho - MD}
          y1={geo.baseY}
          y2={geo.baseY}
          stroke="var(--color-aventurea-line-fuerte)"
          strokeWidth={1}
        />

        <g
          ref={grupoRef}
          style={{ opacity: 0 }}
          className="motion-safe:transition-opacity motion-safe:duration-500"
        >
          {barras.map((b, i) => {
            const apagada = hayEnfasis && !b.destacada;
            return (
              <path
                key={b.etiqueta + i}
                d={caminoBarra(i, b.valor)}
                fill={apagada ? "var(--color-aventurea-line-fuerte)" : color}
                opacity={hover === i ? 0.8 : 1}
                className="transition-opacity duration-150"
              />
            );
          })}
        </g>

        {barras.map((b, i) =>
          i % geo.cadaCuanto === 0 ? (
            <text
              key={"x" + i}
              x={geo.xSlot(i) + geo.slot / 2}
              y={alto - 7}
              textAnchor="middle"
              className="fill-aventurea-ink-soft text-[10px]"
            >
              {b.etiqueta}
            </text>
          ) : null,
        )}

        {/* Capa de hover: el slot COMPLETO es el hit target de la barra. */}
        {barras.map((b, i) => (
          <rect
            key={"h" + i}
            x={geo.xSlot(i)}
            y={MA}
            width={geo.slot}
            height={geo.baseY - MA}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {hover !== null && barraHover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-aventurea-line bg-white px-3 py-2 shadow-[var(--shadow-elevado)]"
          style={{
            left: Math.min(ancho - 70, Math.max(70, geo.xSlot(hover) + geo.slot / 2)),
            top: Math.max(0, geo.y(barraHover.valor) - 64),
          }}
        >
          <p className="whitespace-nowrap text-[10.5px] text-aventurea-ink-soft">
            {barraHover.etiqueta}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="h-2 w-2 rounded-[3px]"
              style={{
                background:
                  hayEnfasis && !barraHover.destacada
                    ? "var(--color-aventurea-line-fuerte)"
                    : color,
              }}
              aria-hidden
            />
            <span className="text-[13px] font-extrabold text-aventurea-ink">
              {formatearValor(barraHover.valor)}
            </span>
            <span className="text-[11px] text-aventurea-ink-soft">{serie}</span>
          </p>
        </div>
      )}
    </div>
  );
}
