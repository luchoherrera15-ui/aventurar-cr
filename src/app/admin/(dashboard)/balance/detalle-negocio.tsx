"use client";

import { useMemo, useState } from "react";
import {
  desglose,
  etiquetaCobro,
  ingresoMembresia,
  type CobroResuelto,
  type GranularidadDesglose,
  type ReservaCobro,
} from "@/lib/cobro-plataforma";
import { aFecha } from "@/lib/finanzas";

function fmt(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

const GRANULARIDADES: { key: GranularidadDesglose; label: string }[] = [
  { key: "dia", label: "Por día" },
  { key: "semana", label: "Por semana" },
  { key: "mes", label: "Por mes" },
];

/**
 * El desglose temporal de UN negocio: qué le deja (proyectado) a la
 * plataforma cada día, semana o mes del rango elegido arriba. Aparece
 * al filtrar un negocio en el select del panel.
 */
export default function DetalleNegocio({
  nombre,
  reservas,
  cobro,
  desde,
  hasta,
  rangoDias,
}: {
  nombre: string;
  /** Las reservas del negocio, ya filtradas por sección (no por fecha). */
  reservas: ReservaCobro[];
  cobro: CobroResuelto;
  desde: string;
  hasta: string;
  rangoDias: number;
}) {
  // La granularidad arranca acorde al periodo: una semana se mira por
  // día, un trimestre por semana, un año por mes.
  const [gran, setGran] = useState<GranularidadDesglose | null>(null);
  const granEfectiva: GranularidadDesglose =
    gran ?? (rangoDias <= 14 ? "dia" : rangoDias <= 120 ? "semana" : "mes");

  const desdeD = useMemo(() => aFecha(desde), [desde]);
  const hastaD = useMemo(() => aFecha(hasta), [hasta]);

  const filas = useMemo(
    () => desglose(reservas, cobro, desdeD, hastaD, granEfectiva),
    [reservas, cobro, desdeD, hastaD, granEfectiva],
  );
  const membresia = useMemo(
    () => ingresoMembresia(cobro, desdeD, hastaD),
    [cobro, desdeD, hastaD],
  );

  const maxIngreso = Math.max(1, ...filas.map((f) => f.ingreso));
  const totalReservas = filas.reduce((a, f) => a + f.reservas, 0);
  const totalIngreso = filas.reduce((a, f) => a + f.ingreso, 0) + membresia;

  // Por día en rangos largos la tabla se vuelve inleíble: se recortan
  // los buckets vacíos de las puntas y se avisa.
  const visibles = useMemo(() => {
    if (granEfectiva !== "dia" || filas.length <= 45) return filas;
    const conDatos = filas.filter((f) => f.reservas > 0);
    return conDatos.length > 0 ? conDatos : filas.slice(-45);
  }, [filas, granEfectiva]);

  return (
    <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
            Desglose de {nombre}
          </p>
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Tarifa: <strong className="text-aventurea-ink">{etiquetaCobro(cobro)}</strong>
            {" · "}
            {totalReservas} reserva{totalReservas === 1 ? "" : "s"} en el periodo →{" "}
            <strong className="text-aventurea-navy">{fmt(totalIngreso)}</strong> proyectados
          </p>
        </div>
        <div className="flex gap-1.5">
          {GRANULARIDADES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGran(g.key)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
                granEfectiva === g.key
                  ? "bg-aventurea-ink text-white"
                  : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft hover:border-aventurea-navy"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {cobro.modelo === "membresia_mensual" && (
        <p className="mt-3 rounded-[10px] bg-aventurea-cream-2 p-3 text-[12.5px] text-aventurea-ink-soft">
          Membresía: {fmt(cobro.valor)}/mes → {fmt(membresia)} en este periodo (un
          mes tocado cuenta entero). Las filas de abajo muestran la actividad;
          con membresía las reservas no suman comisión.
        </p>
      )}

      {granEfectiva === "dia" && visibles.length < filas.length && (
        <p className="mt-3 text-[11.5px] text-zinc-500">
          Mostrando solo los días con actividad ({visibles.length} de {filas.length}).
        </p>
      )}

      <div className="mt-4 flex flex-col gap-1">
        {visibles.map((f) => (
          <div
            key={f.clave}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-aventurea-cream-2/50 sm:grid-cols-[150px_1fr_170px]"
          >
            <span className="truncate text-[12px] capitalize text-aventurea-ink-soft">
              {f.etiqueta}
            </span>
            {/* La barra desaparece en móvil: con tres columnas la fila
                pedía más de los ~298px disponibles y sacaba scroll
                horizontal a toda la página. */}
            <div className="hidden h-2 overflow-hidden rounded-full bg-aventurea-cream-2 sm:block">
              <div
                className="h-full rounded-full bg-aventurea-navy transition-[width]"
                style={{ width: `${Math.max(f.ingreso > 0 ? 3 : 0, (f.ingreso / maxIngreso) * 100)}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-right text-[12px] tabular-nums text-aventurea-ink">
              <strong>{fmt(f.ingreso)}</strong>
              <span className="ml-2 hidden text-aventurea-ink-soft sm:inline">
                {f.reservas > 0 ? `${f.reservas} res · ${f.personas} pers` : "—"}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
