"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * GRÁFICO DE ÁREA/LÍNEA PROPIO — SVG inline, sin librerías (el repo no
 * tiene librería de charts y no vamos a sumar una dependencia por un
 * área con hover). Sigue las specs del sistema de dataviz del sitio:
 * línea de 2px con uniones redondas, relleno del mismo tono a ~10% de
 * opacidad, grilla de hairlines sólidas recesivas, ticks "lindos" en Y,
 * crosshair vertical que ajusta al punto más cercano y UN tooltip con
 * el valor en fuerte. El texto nunca lleva el color de la serie: los
 * rótulos van en tinta del sistema y la identidad la da la marca de
 * color al lado.
 *
 * El ancho se mide con ResizeObserver y se dibuja a píxeles exactos —
 * escalar un viewBox estira la tipografía y a ancho de escritorio los
 * rótulos quedaban gigantes.
 */

export type PuntoGrafico = { etiqueta: string; valor: number };

/** Paso "lindo" (1/2/5×10ⁿ) ≥ v, para que la grilla caiga en redondos. */
function pasoLindo(v: number): number {
  const pot = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
  for (const m of [1, 2, 5, 10]) if (m * pot >= v) return m * pot;
  return 10 * pot;
}

export function GraficoArea({
  puntos,
  serie,
  color = "var(--color-aventurea-sky)",
  alto = 240,
  formatearValor = (v: number) => v.toLocaleString("es-CR"),
  formatearTick,
  className = "",
}: {
  puntos: PuntoGrafico[];
  /** Nombre de la serie ("Reservas") — tooltip y descripción accesible. */
  serie: string;
  /** Color CSS de la serie (token del tema, no un hex suelto). */
  color?: string;
  /** Alto del área de dibujo en px. */
  alto?: number;
  formatearValor?: (v: number) => string;
  /** Formato de los ticks de Y si difiere del valor (ej. ₡ compacto). */
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

  // Entrada suave: el grupo arranca invisible (estilo inline del SSR)
  // y un rAF le quita opacidad/desplazamiento — la transición CSS hace
  // el resto y motion-safe la apaga si pidieron menos movimiento. Se
  // muta el DOM directo en vez de un estado "montado" para no
  // re-renderizar todo el SVG solo por la animación de entrada.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const g = grupoRef.current;
      if (g) {
        g.style.opacity = "1";
        g.style.transform = "none";
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const MI = 42; // margen izquierdo: rótulos de Y
  const MD = 10;
  const MA = 12;
  const MB = 24; // margen inferior: rótulos de X

  const geo = useMemo(() => {
    const n = puntos.length;
    const maxDato = Math.max(1, ...puntos.map((p) => p.valor));
    const paso = pasoLindo(Math.ceil(maxDato / 3));
    const maxY = Math.max(paso, paso * Math.ceil(maxDato / paso));
    const anchoUtil = ancho - MI - MD;
    const altoUtil = alto - MA - MB;
    const x = (i: number) => MI + (n <= 1 ? anchoUtil / 2 : (i * anchoUtil) / (n - 1));
    const y = (v: number) => MA + altoUtil * (1 - v / maxY);
    const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.valor)}`).join(" ");
    const area =
      linea + ` L${x(n - 1)},${MA + altoUtil} L${x(0)},${MA + altoUtil} Z`;
    const ticks: number[] = [];
    for (let t = paso; t <= maxY; t += paso) ticks.push(t);
    // ~5 rótulos de X repartidos, siempre el primero y el último.
    const cuantos = Math.min(n, 5);
    const idxEtiquetas = Array.from({ length: cuantos }, (_, k) =>
      Math.round((k * (n - 1)) / Math.max(1, cuantos - 1)),
    );
    return { n, maxY, x, y, linea, area, ticks, idxEtiquetas, baseY: MA + altoUtil };
  }, [puntos, ancho, alto]);

  const total = useMemo(() => puntos.reduce((a, p) => a + p.valor, 0), [puntos]);

  // El crosshair ajusta al índice más cercano: se apunta a una fecha,
  // no a una línea de 2px.
  const alMover = (ev: React.PointerEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const anchoUtil = ancho - MI - MD;
    const i = Math.round(((px - MI) / Math.max(1, anchoUtil)) * (geo.n - 1));
    setHover(Math.min(geo.n - 1, Math.max(0, i)));
  };

  const puntoHover = hover !== null ? puntos[hover] : null;

  return (
    <div ref={contenedorRef} className={`relative ${className}`}>
      <svg
        width={ancho}
        height={alto}
        role="img"
        aria-label={`${serie}: ${formatearValor(total)} en el período, en ${geo.n} días`}
        className="block max-w-full"
        onPointerMove={alMover}
        onPointerLeave={() => setHover(null)}
      >
        {/* Grilla recesiva: hairlines sólidas del gris de línea. */}
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
          style={{ opacity: 0, transform: "translateY(6px)" }}
          className="motion-safe:transition-[opacity,transform] motion-safe:duration-500"
        >
          <path d={geo.area} fill={color} opacity={0.1} />
          <path
            d={geo.linea}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Marcador del final: el "hoy" de la serie, con anillo blanco. */}
          {geo.n > 0 && (
            <circle
              cx={geo.x(geo.n - 1)}
              cy={geo.y(puntos[geo.n - 1].valor)}
              r={4}
              fill={color}
              stroke="var(--color-aventurea-surface)"
              strokeWidth={2}
            />
          )}
        </g>

        {/* Rótulos de X. */}
        {geo.idxEtiquetas.map((i) => (
          <text
            key={i}
            x={geo.x(i)}
            y={alto - 7}
            textAnchor={i === 0 ? "start" : i === geo.n - 1 ? "end" : "middle"}
            className="fill-aventurea-ink-soft text-[10px]"
          >
            {puntos[i].etiqueta}
          </text>
        ))}

        {/* Crosshair + punto activo. */}
        {hover !== null && puntoHover && (
          <g>
            <line
              x1={geo.x(hover)}
              x2={geo.x(hover)}
              y1={MA}
              y2={geo.baseY}
              stroke="var(--color-aventurea-line-fuerte)"
              strokeWidth={1}
            />
            <circle
              cx={geo.x(hover)}
              cy={geo.y(puntoHover.valor)}
              r={4.5}
              fill={color}
              stroke="var(--color-aventurea-surface)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* Tooltip: el valor manda, la serie acompaña con su marquita. */}
      {hover !== null && puntoHover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-aventurea-line bg-white px-3 py-2 shadow-[var(--shadow-elevado)]"
          style={{
            left: Math.min(ancho - 70, Math.max(70, geo.x(hover))),
            top: Math.max(0, geo.y(puntoHover.valor) - 64),
          }}
        >
          <p className="whitespace-nowrap text-[10.5px] text-aventurea-ink-soft">
            {puntoHover.etiqueta}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />
            <span className="text-[13px] font-extrabold text-aventurea-ink">
              {formatearValor(puntoHover.valor)}
            </span>
            <span className="text-[11px] text-aventurea-ink-soft">{serie}</span>
          </p>
        </div>
      )}
    </div>
  );
}
