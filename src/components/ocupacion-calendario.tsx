"use client";

import { useState } from "react";
import { hoyISOCR } from "@/lib/fechas";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type DiaOcupado = { fecha: string; estado: string; nombre: string | null };

/**
 * Calendario mensual de solo lectura: de un vistazo, qué días ya tienen
 * una reserva (confirmada o en aprobación). El proveedor lo usa para
 * saber qué fechas ofrecer cuando alguien le escribe o llama fuera del
 * flujo en línea.
 */
export default function OcupacionCalendario({ dias }: { dias: DiaOcupado[] }) {
  const hoy = hoyISOCR();
  const [y0, m0] = hoy.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState(m0 - 1);

  const porFecha = new Map(dias.map((d) => [d.fecha, d]));

  function cambiarMes(dir: number) {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-bold capitalize text-aventurea-ink">
          {MESES[viewMonth]} {viewYear}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-[15px] text-aventurea-ink hover:border-aventurea-navy hover:bg-aventurea-cream-2"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-aventurea-line text-[15px] text-aventurea-ink hover:border-aventurea-navy hover:bg-aventurea-cream-2"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5">
        {DOW.map((d, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-500"
          >
            {d}
          </div>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const fecha = iso(viewYear, viewMonth, d);
          const info = porFecha.get(fecha);
          const esHoy = fecha === hoy;

          let cls =
            "relative flex min-h-[40px] flex-col items-center justify-center rounded-lg text-[12.5px] sm:min-h-[52px] sm:text-[13.5px]";
          if (info?.estado === "confirmada") {
            cls += " bg-red-50 font-bold text-red-700";
          } else if (info?.estado === "pendiente") {
            cls += " bg-amber-50 font-bold text-amber-800";
          } else if (info?.estado === "bloqueada") {
            // Bloqueos: manuales o importados de una agenda externa.
            cls += " bg-zinc-100 font-bold text-zinc-500";
          } else {
            cls += " text-aventurea-ink-soft";
          }
          if (esHoy) cls += " ring-1 ring-aventurea-navy";

          return (
            <div key={i} className={cls} title={info?.nombre ?? undefined}>
              {d}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-[11.5px] text-aventurea-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Confirmada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> En aprobación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" /> Bloqueado / agenda externa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-aventurea-line" /> Libre
        </span>
      </div>
    </div>
  );
}
