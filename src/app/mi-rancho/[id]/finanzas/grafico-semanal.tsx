"use client";

import { useId, useState } from "react";
import { fmtColones, fmtColonesCorto, type SemanaFinanzas } from "@/lib/finanzas";

/**
 * El gráfico de "semana a semana" — antes era una tabla plegada con
 * una barrita fina metida en una celda (fácil de pasar por alto, que
 * es justo lo que pedían dejar de hacer: "llevarlo por semana, con
 * gráficos, que se vea todo ordenado y claro"). Ahora es una tarjeta
 * abierta con dos barras por semana (lo que entró vs. lo que falta
 * cobrar) y una vista de tabla detrás de un botón, para quien prefiera
 * los números exactos.
 *
 * Paleta: el verde y el azul que el resto de Finanzas ya usa para
 * "entró" y "por cobrar" (`--color-aventurea-green` / `-blue`) — se
 * corrieron por el validador de la guía de dataviz y pasan los seis
 * chequeos (contraste, CVD, franja de luminancia) en modo claro, que
 * es el único que existe: el sitio fuerza `color-scheme: only light`.
 */

const ALTO_GRAFICO = 148;
const ANCHO_COLUMNA = 46;
const GROSOR_BARRA = 15;

/** Redondea el techo del eje a un número "limpio" (10, 20, 50, 100 × 10^n). */
function techoLimpio(max: number): number {
  if (max <= 0) return 1000;
  const magnitud = Math.pow(10, Math.floor(Math.log10(max)));
  const pasos = [1, 2, 5, 10];
  for (const p of pasos) {
    const candidato = p * magnitud;
    if (candidato >= max) return candidato;
  }
  return 10 * magnitud;
}

function etiquetaCorta(s: SemanaFinanzas): string {
  if (s.esActual) return "Hoy";
  return s.inicio.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

export default function GraficoSemanal({
  semanas,
  maximoSemanal,
}: {
  semanas: SemanaFinanzas[];
  maximoSemanal: number;
}) {
  const [vista, setVista] = useState<"grafico" | "tabla">("grafico");
  const [activa, setActiva] = useState<string | null>(null);
  const tituloId = useId();

  const techo = techoLimpio(maximoSemanal);
  const ticks = [0, techo / 3, (techo * 2) / 3, techo];

  return (
    <section
      aria-labelledby={tituloId}
      className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={tituloId} className="text-[16px] font-bold text-aventurea-ink">
            Semana a semana
          </h2>
          <p className="mt-1 max-w-[52ch] text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            Lo cobrado se cuenta en la semana en que entró la plata. Lo por
            cobrar, en la semana del evento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVista(vista === "grafico" ? "tabla" : "grafico")}
          className="shrink-0 rounded-lg border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
        >
          {vista === "grafico" ? "Ver como tabla" : "Ver como gráfico"}
        </button>
      </div>

      {/* La leyenda: nunca solo color, el texto va en tinta normal y el
          color vive en el puntito de al lado. */}
      <div className="mt-4 flex gap-4">
        <Leyenda color="bg-aventurea-green" label="Entró" />
        <Leyenda color="bg-aventurea-blue" label="Por cobrar" />
      </div>

      {vista === "tabla" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-aventurea-line text-left">
                <Th>Semana</Th>
                <Th alinear="right">Entró</Th>
                <Th alinear="right">Por cobrar</Th>
                <Th alinear="right">Gastos</Th>
                <Th alinear="right">Eventos</Th>
              </tr>
            </thead>
            <tbody>
              {semanas.map((s) => (
                <tr
                  key={s.clave}
                  className={`border-b border-aventurea-line/70 last:border-none ${
                    s.esActual ? "bg-aventurea-cream-2/60" : ""
                  }`}
                >
                  <td className="py-2.5 pr-4 align-middle">
                    <span
                      className={`text-[13px] ${
                        s.esActual ? "font-bold text-aventurea-ink" : "text-aventurea-ink"
                      }`}
                    >
                      {s.rango}
                    </span>
                    {s.esActual && (
                      <span className="ml-2 rounded-lg bg-aventurea-ink px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
                        Esta semana
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right align-middle text-[13px] font-bold tabular-nums text-aventurea-ink">
                    {s.entro > 0 ? fmtColones(s.entro) : "—"}
                  </td>
                  <td className="py-2.5 text-right align-middle text-[13px] tabular-nums text-aventurea-ink-soft">
                    {s.porCobrar > 0 ? fmtColones(s.porCobrar) : "—"}
                  </td>
                  <td className="py-2.5 text-right align-middle text-[13px] tabular-nums text-aventurea-ink-soft">
                    {s.gastos > 0 ? `−${fmtColones(s.gastos)}` : "—"}
                  </td>
                  <td className="py-2.5 text-right align-middle text-[13px] tabular-nums text-aventurea-ink-soft">
                    {s.eventos || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 flex">
          {/* El eje Y queda FUERA del área que scrollea horizontalmente:
              si viviera adentro, las etiquetas de plata se irían con las
              barras al deslizar y dejarían de servir de referencia. */}
          <div className="relative shrink-0" style={{ width: 34, height: ALTO_GRAFICO }}>
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute right-1.5 -translate-y-1/2 whitespace-nowrap text-[9.5px] tabular-nums text-aventurea-ink-soft"
                style={{ bottom: (t / techo) * ALTO_GRAFICO }}
              >
                {t === 0 ? "0" : fmtColonesCorto(t)}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="relative" style={{ minWidth: semanas.length * ANCHO_COLUMNA }}>
              {/* Líneas recesivas, un paso más claras que la superficie —
                  nunca discontinuas. Van DETRÁS de las barras (z-0 contra
                  el z-10 de la fila de abajo). */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-0"
                style={{ height: ALTO_GRAFICO }}
              >
                {ticks.map((t, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-aventurea-line/60"
                    style={{ bottom: (t / techo) * ALTO_GRAFICO }}
                  />
                ))}
              </div>

              <div className="relative z-10 flex items-start gap-0">
                {semanas.map((s) => {
                  const altoEntro = Math.max(
                    s.entro > 0 ? 3 : 0,
                    (s.entro / techo) * ALTO_GRAFICO,
                  );
                  const altoPorCobrar = Math.max(
                    s.porCobrar > 0 ? 3 : 0,
                    (s.porCobrar / techo) * ALTO_GRAFICO,
                  );
                  return (
                    <button
                      key={s.clave}
                      type="button"
                      onMouseEnter={() => setActiva(s.clave)}
                      onMouseLeave={() => setActiva((a) => (a === s.clave ? null : a))}
                      onFocus={() => setActiva(s.clave)}
                      onBlur={() => setActiva((a) => (a === s.clave ? null : a))}
                      aria-label={`${s.rango}: entró ${fmtColones(s.entro)}, por cobrar ${fmtColones(
                        s.porCobrar,
                      )}, gastos ${fmtColones(s.gastos)}, ${s.eventos} evento${s.eventos === 1 ? "" : "s"}`}
                      className={`relative flex shrink-0 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-aventurea-navy ${
                        s.esActual ? "bg-aventurea-cream-2/70" : "hover:bg-aventurea-cream-2/40"
                      }`}
                      style={{ width: ANCHO_COLUMNA }}
                    >
                      {/* La caja de las barras mide EXACTO ALTO_GRAFICO —
                          nada de padding acá adentro, o la escala contra
                          ese mismo número deja de ser cierta y las barras
                          más altas se salen de su carril. */}
                      <div className="flex items-end gap-[2px]" style={{ height: ALTO_GRAFICO }}>
                        <span
                          className="block rounded-t-[4px] bg-aventurea-green"
                          style={{ width: GROSOR_BARRA, height: altoEntro }}
                        />
                        <span
                          className="block rounded-t-[4px] bg-aventurea-blue"
                          style={{ width: GROSOR_BARRA, height: altoPorCobrar }}
                        />
                      </div>
                      <span
                        className={`mt-1 whitespace-nowrap text-[9.5px] ${
                          s.esActual ? "font-bold text-aventurea-ink" : "text-aventurea-ink-soft"
                        }`}
                      >
                        {etiquetaCorta(s)}
                      </span>

                      {/* El tooltip vive DENTRO de su propia columna: así
                          queda centrado sobre la barra que corresponde
                          pase lo que pase con el scroll horizontal, sin
                          tener que calcular esa posición a mano. */}
                      {activa === s.clave && (
                        <div
                          role="status"
                          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[180px] -translate-x-1/2 rounded-xl border border-aventurea-line bg-aventurea-ink px-3.5 py-3 text-left text-white shadow-lg"
                        >
                          <p className="text-[11.5px] font-bold">{s.rango}</p>
                          <dl className="mt-1.5 flex flex-col gap-1 text-[12px]">
                            <FilaTooltip
                              color="bg-aventurea-green"
                              label="Entró"
                              valor={fmtColones(s.entro)}
                            />
                            <FilaTooltip
                              color="bg-aventurea-blue"
                              label="Por cobrar"
                              valor={fmtColones(s.porCobrar)}
                            />
                            <FilaTooltip
                              color="bg-white/30"
                              label="Gastos"
                              valor={s.gastos > 0 ? `−${fmtColones(s.gastos)}` : "—"}
                            />
                          </dl>
                          <p className="mt-1.5 text-[10.5px] text-white/60">
                            {s.eventos} evento{s.eventos === 1 ? "" : "s"}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  alinear = "left",
}: {
  children: React.ReactNode;
  alinear?: "left" | "right";
}) {
  return (
    <th
      className={`pb-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft ${
        alinear === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Leyenda({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-aventurea-ink-soft">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${color}`} />
      {label}
    </span>
  );
}

function FilaTooltip({ color, label, valor }: { color: string; label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-white/75">
        <span className={`h-2 w-2 shrink-0 rounded-[2px] ${color}`} />
        {label}
      </span>
      <span className="font-bold tabular-nums">{valor}</span>
    </div>
  );
}
