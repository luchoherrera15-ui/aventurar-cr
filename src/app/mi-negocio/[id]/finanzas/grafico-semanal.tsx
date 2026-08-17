"use client";

import { useId, useState } from "react";
import { fmtColones, fmtColonesCorto, type SemanaFinanzas } from "@/lib/finanzas";
import { CardHead } from "@/components/panel/piezas";
import {
  BOTON_PANEL,
  CUERPO_SUAVE,
  DETALLE,
  ESTADO_PILDORA,
  PADDING_CARD,
  RADIO_CARD,
  SUPERFICIE_PANEL,
} from "@/components/panel/sistema";

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
 * Como elementos gráficos miden 5,32:1 y 4,18:1 sobre la tarjeta
 * blanca, los dos por encima del piso de 3:1.
 *
 * ── QUÉ CAMBIÓ EN EL REDISEÑO ──────────────────────────────────────
 * La piel: la tarjeta y su encabezado son los del sistema del panel
 * (`referencia/bookeapaneles.html`), las barras toman el radio superior
 * de la maqueta y la tabla alinea toda la plata a la derecha con
 * `tabular-nums`.
 *
 * Y se fueron los alfas que marcaban estado: la semana actual se pintaba
 * con `bg-aventurea-cream-2/60`, la columna activa con `/70` y el hover
 * con `/40` — tres tonos del MISMO estado según con qué se solapara, y
 * ninguno medible una sola vez. Ahora los tres son el gris sólido, y la
 * semana actual además se dice con palabras («Esta semana»), no solo con
 * un fondo. Y en el tooltip, `text-white/75` y `text-white/60` pasaron a
 * `--color-aventurea-rail` sólido (8,46:1 sobre la tinta del tooltip).
 *
 * Ni un cálculo cambió: `techoLimpio`, la escala contra `ALTO_GRAFICO` y
 * los datos de `resumenFinanciero` son los mismos.
 */

const ALTO_GRAFICO = 160;
const ANCHO_COLUMNA = 52;
const GROSOR_BARRA = 16;

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
    // Tarjeta del sistema escrita a mano y no con `<Card>` para poder
    // conservar el `aria-labelledby`: sin él la sección deja de ser una
    // región con nombre y desaparece de la lista de regiones del lector
    // de pantalla, que es cómo se salta directo al gráfico.
    <section
      aria-labelledby={tituloId}
      className={`${SUPERFICIE_PANEL} ${RADIO_CARD} ${PADDING_CARD}`}
    >
      <CardHead
        eyebrow="Semana a semana"
        titulo="Cómo entró la plata"
        id={tituloId}
        accion={
          <button
            type="button"
            onClick={() => setVista(vista === "grafico" ? "tabla" : "grafico")}
            className={BOTON_PANEL}
          >
            {vista === "grafico" ? "Ver como tabla" : "Ver como gráfico"}
          </button>
        }
      />

      <p className={`-mt-1.5 mb-3.5 max-w-[62ch] ${DETALLE}`}>
        Lo cobrado se cuenta en la semana en que entró la plata. Lo por cobrar, en la
        semana del evento.
      </p>

      {/* La leyenda: nunca solo color, el texto va en tinta normal y el
          color vive en el puntito de al lado. */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Leyenda color="bg-aventurea-green" label="Entró" />
        <Leyenda color="bg-aventurea-blue" label="Por cobrar" />
      </div>

      {vista === "tabla" ? (
        // La tabla scrollea DENTRO de su caja: el ancho mínimo de cinco
        // columnas de plata no cabe en 390px y el `main` nunca debe
        // scrollear en horizontal.
        <div className="mt-4 -mx-1 overflow-x-auto px-1">
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
                  // Gris SÓLIDO para la semana actual, no un alfa: el
                  // mismo estado tiene que verse igual caiga sobre lo que
                  // caiga. Y no viaja solo — la píldora «Esta semana» lo
                  // dice con palabras.
                  className={`border-b border-aventurea-line last:border-none ${
                    s.esActual ? "bg-aventurea-cream-2" : ""
                  }`}
                >
                  <td className="py-2.5 pr-4 align-middle">
                    <span
                      className={`text-[13px] text-aventurea-ink ${
                        s.esActual ? "font-bold" : ""
                      }`}
                    >
                      {s.rango}
                    </span>
                    {s.esActual && (
                      <span
                        className={`ml-2 inline-block whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${ESTADO_PILDORA.info}`}
                      >
                        Esta semana
                      </span>
                    )}
                  </td>
                  <Td fuerte>{s.entro > 0 ? fmtColones(s.entro) : "—"}</Td>
                  <Td>{s.porCobrar > 0 ? fmtColones(s.porCobrar) : "—"}</Td>
                  <Td>{s.gastos > 0 ? `−${fmtColones(s.gastos)}` : "—"}</Td>
                  <Td>{s.eventos || "—"}</Td>
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
          <div className="relative shrink-0" style={{ width: 44, height: ALTO_GRAFICO }}>
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[10.5px] tabular-nums text-aventurea-ink-soft"
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
                    className="absolute left-0 right-0 border-t border-aventurea-line"
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
                      // El gris de la columna actual y el del hover son
                      // el MISMO gris sólido; antes eran dos alfas
                      // distintos del mismo token.
                      className={`relative flex shrink-0 flex-col items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-aventurea-navy ${
                        s.esActual ? "bg-aventurea-cream-2" : "hover:bg-aventurea-cream-2"
                      }`}
                      style={{ width: ANCHO_COLUMNA }}
                    >
                      {/* La caja de las barras mide EXACTO ALTO_GRAFICO —
                          nada de padding acá adentro, o la escala contra
                          ese mismo número deja de ser cierta y las barras
                          más altas se salen de su carril. */}
                      <div className="flex items-end gap-[2px]" style={{ height: ALTO_GRAFICO }}>
                        <span
                          className="block rounded-t-[5px] bg-aventurea-green"
                          style={{ width: GROSOR_BARRA, height: altoEntro }}
                        />
                        <span
                          className="block rounded-t-[5px] bg-aventurea-blue"
                          style={{ width: GROSOR_BARRA, height: altoPorCobrar }}
                        />
                      </div>
                      <span
                        className={`mt-1.5 whitespace-nowrap text-[10.5px] ${
                          s.esActual
                            ? "font-bold text-aventurea-ink"
                            : "text-aventurea-ink-soft"
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
                          // Fondo en la tinta fuerte (#161616) y no en el
                          // navy: sobre navy el punto verde de la leyenda
                          // cae a 2,55:1 y deja de pasar el 3:1 de un
                          // elemento gráfico. Sobre la tinta, verde 3,48:1
                          // y azul 4,43:1.
                          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[190px] -translate-x-1/2 rounded-xl bg-aventurea-ink px-3.5 py-3 text-left text-white shadow-elevado"
                        >
                          <p className="text-[11.5px] font-extrabold">{s.rango}</p>
                          <dl className="mt-2 flex flex-col gap-1.5 text-[12px]">
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
                            {/* Los gastos NO tienen barra en el gráfico,
                                así que tampoco llevan punto de color: un
                                punto sin nada a qué apuntar es una clave
                                de leyenda que miente. */}
                            <FilaTooltip
                              label="Gastos"
                              valor={s.gastos > 0 ? `−${fmtColones(s.gastos)}` : "—"}
                            />
                          </dl>
                          <p className="mt-2 text-[11px] text-aventurea-rail">
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
      className={`pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft ${
        alinear === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/** Una celda de plata: SIEMPRE a la derecha, tabular y sin partirse.
 *  Es lo único que hace que cinco filas de montos se lean como una
 *  columna y no como cinco textos sueltos. */
function Td({ children, fuerte = false }: { children: React.ReactNode; fuerte?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap py-2.5 pl-3 text-right align-middle text-[13px] tabular-nums ${
        fuerte ? "font-bold text-aventurea-ink" : "text-aventurea-ink-soft"
      }`}
    >
      {children}
    </td>
  );
}

function Leyenda({ color, label }: { color: string; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${CUERPO_SUAVE}`}>
      <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${color}`} />
      {label}
    </span>
  );
}

function FilaTooltip({
  color,
  label,
  valor,
}: {
  color?: string;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {/* `--color-aventurea-rail` (#9fb0cf) sobre la tinta del tooltip
          (#161616): 8,46:1, sólido. Reemplaza al `text-white/75`. */}
      <span className="flex items-center gap-1.5 text-aventurea-rail">
        {color && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-[2px] ${color}`} />}
        {label}
      </span>
      <span className="whitespace-nowrap font-bold tabular-nums">{valor}</span>
    </div>
  );
}
