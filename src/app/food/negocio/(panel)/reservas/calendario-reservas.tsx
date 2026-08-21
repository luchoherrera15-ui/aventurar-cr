"use client";

import { useMemo } from "react";
import { TarjetaPanel } from "@/components/food/panel";
import { BOTON_ICONO } from "@/components/panel/sistema";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { fechaCorta, horaCorta } from "@/lib/food/tipos";
import { sumarDiasISO } from "@/lib/fechas";
import type { FranjaDisponible, ReservaPanelFila } from "./tipos";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  CALENDARIO DE OCUPACIÓN — día / semana / mes
 * ═══════════════════════════════════════════════════════════════════
 *
 * La otra cara de la lista: CUÁNDO se llena el restaurante. Todo es
 * DIV + CSS propio (el repo no carga librerías de calendario ni de
 * charts): barras horizontales por hora en la vista de día, una
 * cuadrícula hora×día en la semana y un mes con celdas de intensidad.
 *
 * La ocupación es "personas por hora": la suma de comensales de las
 * reservas no canceladas (reales + utilería, la tarjeta lo marca) en
 * esa hora. Para las horas futuras donde hay franjas reales abiertas
 * se muestra además el cupo total — eso sí es un dato duro del
 * negocio, no una estimación.
 *
 * COLOR: escala SECUENCIAL de un solo tono (la regla de todo mapa de
 * calor: un tono, de claro a oscuro), construida con color-mix sobre
 * `--color-aventurea-orange-dark` — el único naranja de la marca que
 * aguanta texto de tinta encima (#161616 sobre #cf5d0e ≈ 5:1, AA).
 * Nada de hex nuevos: el token ya existe en globals.css.
 *
 * El día ancla y el modo viven en el querystring (?dia=&cal=), igual
 * que los filtros de la lista: navegar el calendario es navegable
 * hacia atrás y compartible.
 */

type ModoCal = "dia" | "semana" | "mes";

/** Las horas del lienzo: el rango de servicio de un restaurante urbano
 *  (el mismo 11:00–21:00 de HORAS_DEMANDA en panel-demo.ts). */
const HORAS_BASE = ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21"];

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

function dowDe(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** El lunes de la semana de una fecha (la semana tica arranca lunes). */
function lunesDe(fecha: string): string {
  return sumarDiasISO(fecha, -((dowDe(fecha) + 6) % 7));
}

/** Suma meses cayendo siempre al día 1 (para navegar la vista de mes). */
function sumarMesesISO(fecha: string, meses: number): string {
  const [y, m] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + meses, 1)).toISOString().slice(0, 10);
}

/**
 * El color de una intensidad relativa t ∈ [0,1]: de casi-blanco al
 * naranja fuerte, un solo tono. t=0 no pasa por acá (la celda vacía
 * usa el gris hundido del sistema, que se lee como "sin datos" y no
 * como "poquito").
 */
function colorCalor(t: number): string {
  const pct = Math.round(14 + 86 * Math.min(1, Math.max(0, t)));
  return `color-mix(in srgb, var(--color-aventurea-orange-dark) ${pct}%, white)`;
}

export default function CalendarioReservas({
  filas,
  franjas,
  hoy,
  ancla,
  modo,
  alNavegar,
}: {
  filas: ReservaPanelFila[];
  franjas: FranjaDisponible[];
  hoy: string;
  ancla: string;
  modo: ModoCal;
  alNavegar: (cambios: Record<string, string | null>) => void;
}) {
  // ── Agregados: personas por "fecha|HH" y por fecha ────────────────
  // Cuentan cupo TOMADO, por eso el no-show y el check-in suman y la
  // cancelada no: la mesa estuvo bloqueada aunque nadie llegara.
  const { porHora, porDia } = useMemo(() => {
    const porHora = new Map<string, number>();
    const porDia = new Map<string, number>();
    for (const f of filas) {
      if (f.estado === "cancelada") continue;
      const hh = f.hora.slice(0, 2);
      porHora.set(f.fecha + "|" + hh, (porHora.get(f.fecha + "|" + hh) ?? 0) + f.personas);
      porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + f.personas);
    }
    return { porHora, porDia };
  }, [filas]);

  /** Cupo real abierto por "fecha|HH" (solo franjas futuras activas). */
  const cupoPorHora = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of franjas) {
      const clave = f.fecha + "|" + f.hora.slice(0, 2);
      m.set(clave, (m.get(clave) ?? 0) + f.capacidad);
    }
    return m;
  }, [franjas]);

  // ── Navegación ────────────────────────────────────────────────────
  const mover = (direccion: 1 | -1) => {
    const destino =
      modo === "dia"
        ? sumarDiasISO(ancla, direccion)
        : modo === "semana"
          ? sumarDiasISO(ancla, 7 * direccion)
          : sumarMesesISO(ancla, direccion);
    alNavegar({ dia: destino === hoy ? null : destino });
  };

  const [anclaY, anclaM] = ancla.split("-").map(Number);
  const rotulo =
    modo === "dia"
      ? `${DIAS_CORTOS[dowDe(ancla)]} ${fechaCorta(ancla)}`
      : modo === "semana"
        ? `Semana del ${fechaCorta(lunesDe(ancla))}`
        : `${MESES_LARGOS[anclaM - 1]} ${anclaY}`;

  return (
    <TarjetaPanel
      kicker="Ocupación"
      titulo="Calendario de reservas"
      notaDemo
      accion={
        <div className="flex items-center gap-1.5">
          {(
            [
              { valor: "dia", label: "Día" },
              { valor: "semana", label: "Semana" },
              { valor: "mes", label: "Mes" },
            ] as const
          ).map((t) => (
            <button
              key={t.valor}
              type="button"
              aria-pressed={modo === t.valor}
              onClick={() => alNavegar({ cal: t.valor === "dia" ? null : t.valor })}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                modo === t.valor
                  ? "bg-aventurea-navy text-white"
                  : "text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-navy"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {/* La animación de entrada de las barras, con su apagado para
          quien pidió menos movimiento. Vive acá y no en globals.css
          porque es exclusiva de este calendario. */}
      <style>{`
        @keyframes cal-crecer { from { transform: scaleX(0); } }
        .cal-barra { transform-origin: left; animation: cal-crecer 0.45s var(--ease-bookea); }
        @media (prefers-reduced-motion: reduce) { .cal-barra { animation: none; } }
      `}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => mover(-1)} aria-label="Anterior" className={BOTON_ICONO}>
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Siguiente" className={BOTON_ICONO}>
            <IconChevronRight className="h-4 w-4" />
          </button>
          {ancla !== hoy && (
            <button
              type="button"
              onClick={() => alNavegar({ dia: null })}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-cream-2"
            >
              Hoy
            </button>
          )}
        </div>
        <p className="text-[13.5px] font-bold capitalize text-aventurea-ink">{rotulo}</p>
      </div>

      {modo === "dia" && (
        <VistaDia fecha={ancla} porHora={porHora} cupoPorHora={cupoPorHora} />
      )}
      {modo === "semana" && (
        <VistaSemana ancla={ancla} hoy={hoy} porHora={porHora} alAbrirDia={(f) => alNavegar({ cal: null, dia: f === hoy ? null : f })} />
      )}
      {modo === "mes" && (
        <VistaMes ancla={ancla} hoy={hoy} porDia={porDia} alAbrirDia={(f) => alNavegar({ cal: null, dia: f === hoy ? null : f })} />
      )}

      {/* La leyenda de la escala: un solo tono, de menos a más. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-aventurea-ink-soft">
        <span>Personas por hora:</span>
        <span className="inline-flex items-center gap-1">
          menos
          <span className="flex overflow-hidden rounded" aria-hidden>
            {[0.15, 0.4, 0.65, 1].map((t) => (
              <span key={t} className="h-3 w-5" style={{ backgroundColor: colorCalor(t) }} />
            ))}
          </span>
          más
        </span>
        <span aria-hidden>·</span>
        <span>Incluye reservas de ejemplo, marcadas arriba.</span>
      </div>
    </TarjetaPanel>
  );
}

// ───────────────────────────────────────────────────────────────────
//  Día: barras horizontales por hora
// ───────────────────────────────────────────────────────────────────

function VistaDia({
  fecha,
  porHora,
  cupoPorHora,
}: {
  fecha: string;
  porHora: Map<string, number>;
  cupoPorHora: Map<string, number>;
}) {
  const valores = HORAS_BASE.map((hh) => porHora.get(fecha + "|" + hh) ?? 0);
  const max = Math.max(1, ...valores);
  const total = valores.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <p className="rounded-xl bg-aventurea-cream-2 px-6 py-8 text-center text-[13px] text-aventurea-ink-soft">
        Sin reservas este día.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {HORAS_BASE.map((hh, i) => {
        const personas = valores[i];
        const cupo = cupoPorHora.get(fecha + "|" + hh);
        const t = personas / max;
        return (
          <li key={hh} className="flex items-center gap-3">
            <span className="w-[74px] shrink-0 text-right text-[12px] font-bold tabular-nums text-aventurea-ink-soft">
              {horaCorta(hh + ":00")}
            </span>
            <span
              className="h-6 flex-1 overflow-hidden rounded-md bg-aventurea-cream-2"
              role="img"
              aria-label={`${horaCorta(hh + ":00")}: ${personas} personas${cupo ? ` de ${cupo} lugares abiertos` : ""}`}
              title={`${personas} ${personas === 1 ? "persona" : "personas"}${cupo ? ` · ${cupo} lugares abiertos` : ""}`}
            >
              {personas > 0 && (
                <span
                  className="cal-barra block h-full rounded-md"
                  style={{
                    width: `${Math.max(6, Math.round(t * 100))}%`,
                    backgroundColor: colorCalor(t),
                  }}
                />
              )}
            </span>
            <span className="w-[92px] shrink-0 text-[12px] tabular-nums text-aventurea-ink">
              <span className="font-extrabold">{personas > 0 ? personas : "—"}</span>
              {cupo !== undefined && (
                <span className="text-aventurea-ink-soft"> / {cupo} lug.</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ───────────────────────────────────────────────────────────────────
//  Semana: cuadrícula hora × día
// ───────────────────────────────────────────────────────────────────

function VistaSemana({
  ancla,
  hoy,
  porHora,
  alAbrirDia,
}: {
  ancla: string;
  hoy: string;
  porHora: Map<string, number>;
  alAbrirDia: (fecha: string) => void;
}) {
  const lunes = lunesDe(ancla);
  const dias = Array.from({ length: 7 }, (_, i) => sumarDiasISO(lunes, i));

  const max = Math.max(
    1,
    ...dias.flatMap((d) => HORAS_BASE.map((hh) => porHora.get(d + "|" + hh) ?? 0)),
  );

  // La cuadrícula scrollea DENTRO de su contenedor en el teléfono; la
  // página nunca scrollea horizontal.
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-[70px]" aria-label="Hora" />
            {dias.map((d) => (
              <th key={d} scope="col" className="pb-1">
                <button
                  type="button"
                  onClick={() => alAbrirDia(d)}
                  className={`w-full rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-aventurea-cream-2 ${
                    d === hoy ? "bg-aventurea-navy text-white hover:bg-aventurea-navy-2" : ""
                  }`}
                  title={`Ver el día ${fechaCorta(d)}`}
                >
                  <span
                    className={`block text-[10.5px] font-bold uppercase ${
                      d === hoy ? "text-white/80" : "text-aventurea-ink-soft"
                    }`}
                  >
                    {DIAS_CORTOS[dowDe(d)]}
                  </span>
                  <span className="block text-[12.5px] font-extrabold tabular-nums">
                    {Number(d.slice(8, 10))}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HORAS_BASE.map((hh) => (
            <tr key={hh}>
              <th
                scope="row"
                className="pr-1.5 text-right text-[11px] font-bold tabular-nums text-aventurea-ink-soft"
              >
                {horaCorta(hh + ":00")}
              </th>
              {dias.map((d) => {
                const personas = porHora.get(d + "|" + hh) ?? 0;
                const t = personas / max;
                return (
                  <td key={d} className="p-0">
                    <div
                      className="grid h-8 place-items-center rounded-md text-[11.5px] font-bold tabular-nums text-aventurea-ink"
                      style={
                        personas > 0
                          ? { backgroundColor: colorCalor(t) }
                          : { backgroundColor: "var(--color-aventurea-cream-2)" }
                      }
                      title={`${DIAS_CORTOS[dowDe(d)]} ${fechaCorta(d)} · ${horaCorta(hh + ":00")}: ${personas} ${personas === 1 ? "persona" : "personas"}`}
                    >
                      {personas > 0 ? personas : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
//  Mes: celdas por día con total e intensidad
// ───────────────────────────────────────────────────────────────────

function VistaMes({
  ancla,
  hoy,
  porDia,
  alAbrirDia,
}: {
  ancla: string;
  hoy: string;
  porDia: Map<string, number>;
  alAbrirDia: (fecha: string) => void;
}) {
  const [y, m] = ancla.split("-").map(Number);
  const primerDia = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const inicio = lunesDe(primerDia);

  // 6 semanas cubren cualquier mes; las celdas de otros meses se
  // pintan apagadas pero siguen siendo clickeables (el mes no es una
  // cárcel: el 31 de la semana pasada también interesa).
  const celdas = Array.from({ length: 42 }, (_, i) => sumarDiasISO(inicio, i));
  const max = Math.max(1, ...celdas.map((d) => porDia.get(d) ?? 0));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
            <p
              key={dow}
              className="text-center text-[10.5px] font-bold uppercase text-aventurea-ink-soft"
            >
              {DIAS_CORTOS[dow]}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((d) => {
            const delMes = d.slice(5, 7) === ancla.slice(5, 7);
            const personas = porDia.get(d) ?? 0;
            const t = personas / max;
            return (
              <button
                key={d}
                type="button"
                onClick={() => alAbrirDia(d)}
                title={`${DIAS_CORTOS[dowDe(d)]} ${fechaCorta(d)}: ${personas} ${personas === 1 ? "persona" : "personas"}`}
                className={`flex h-[64px] flex-col justify-between rounded-lg border p-1.5 text-left transition-colors hover:border-aventurea-navy ${
                  d === hoy
                    ? "border-aventurea-navy"
                    : "border-aventurea-line"
                } ${delMes ? "bg-white" : "bg-aventurea-cream-2 opacity-60"}`}
              >
                <span
                  className={`text-[11px] font-bold tabular-nums ${
                    d === hoy ? "text-aventurea-navy" : "text-aventurea-ink-soft"
                  }`}
                >
                  {Number(d.slice(8, 10))}
                </span>
                {personas > 0 && (
                  <span className="flex items-center gap-1">
                    <span
                      className="cal-barra h-1.5 rounded-full"
                      style={{
                        width: `${Math.max(14, Math.round(t * 100))}%`,
                        backgroundColor: colorCalor(t),
                      }}
                      aria-hidden
                    />
                    <span className="text-[10.5px] font-bold tabular-nums text-aventurea-ink">
                      {personas}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
