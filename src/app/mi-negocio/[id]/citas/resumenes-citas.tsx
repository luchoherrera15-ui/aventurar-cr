"use client";

import { useMemo } from "react";
import { fmtColones } from "@/lib/finanzas";
import type { CitaDia } from "./agenda-citas";

interface Miembro {
  id: string;
  nombre: string;
}

interface ResumenesCitasProps {
  citas: CitaDia[];
  miembros: Miembro[];
}

export default function ResumenesCitas({ citas, miembros }: ResumenesCitasProps) {
  const stats = useMemo(() => {
    const confirmadas = citas.filter((c) => c.estado === "confirmada").length;
    const cumplidas = citas.filter((c) => c.estado === "cumplida").length;
    const noAsistio = citas.filter((c) => c.estado === "no_asistio").length;
    const total = citas.length;

    // Clientes frecuentes
    const clientesFreq = new Map<string, number>();
    citas.forEach((c) => {
      if (c.nombre) {
        clientesFreq.set(c.nombre, (clientesFreq.get(c.nombre) ?? 0) + 1);
      }
    });
    const topClientes = Array.from(clientesFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Ingresos
    const totalIngresos = citas
      .filter((c) => c.evento_pagado)
      .reduce((sum, c) => sum + (Number(c.monto_cobrado_final ?? c.monto_total ?? 0)), 0);

    // Ingresos por profesional
    const ingresosPorProf = new Map<string, number>();
    citas
      .filter((c) => c.evento_pagado && c.miembro_id)
      .forEach((c) => {
        const monto = Number(c.monto_cobrado_final ?? c.monto_total ?? 0);
        ingresosPorProf.set(c.miembro_id!, (ingresosPorProf.get(c.miembro_id!) ?? 0) + monto);
      });

    const tasaInasistencia = total > 0 ? ((noAsistio / total) * 100).toFixed(1) : "0";

    return {
      confirmadas,
      cumplidas,
      noAsistio,
      total,
      topClientes,
      totalIngresos,
      ingresosPorProf,
      tasaInasistencia,
    };
  }, [citas]);

  const nombreMiembro = new Map(miembros.map((m) => [m.id, m.nombre]));

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-aventurea-green/10 border border-aventurea-green/30 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-green">
            Confirmadas
          </p>
          <p className="mt-2 text-[24px] font-extrabold text-aventurea-green">
            {stats.confirmadas}
          </p>
        </div>

        <div className="rounded-xl bg-aventurea-navy/10 border border-aventurea-navy/30 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-navy">
            Completadas
          </p>
          <p className="mt-2 text-[24px] font-extrabold text-aventurea-navy">
            {stats.cumplidas}
          </p>
        </div>

        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700">
            No asistió
          </p>
          <p className="mt-2 text-[24px] font-extrabold text-red-700">{stats.noAsistio}</p>
        </div>

        <div className="rounded-xl bg-aventurea-sky/10 border border-aventurea-sky/30 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-orange">
            Tasa no-show
          </p>
          <p className="mt-2 text-[24px] font-extrabold text-aventurea-orange">
            {stats.tasaInasistencia}%
          </p>
        </div>
      </div>

      {/* Ingresos */}
      <div className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-5">
        <p className="text-[13px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Total ingresado
        </p>
        <p className="mt-2 text-[28px] font-extrabold text-aventurea-green">
          {fmtColones(stats.totalIngresos)}
        </p>
      </div>

      {/* Top clientes */}
      {stats.topClientes.length > 0 && (
        <div className="rounded-xl border border-aventurea-line">
          <div className="bg-aventurea-cream-2 px-5 py-3">
            <p className="text-[13px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Clientes frecuentes
            </p>
          </div>
          <div className="divide-y divide-aventurea-line">
            {stats.topClientes.map(([nombre, cantidad]) => (
              <div key={nombre} className="flex items-center justify-between px-5 py-3">
                <p className="font-bold text-aventurea-ink">{nombre}</p>
                <span className="rounded-lg bg-aventurea-sky/10 px-2.5 py-1 text-[12px] font-bold text-aventurea-orange">
                  {cantidad} cita{cantidad !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ingresos por profesional */}
      {stats.ingresosPorProf.size > 0 && (
        <div className="rounded-xl border border-aventurea-line">
          <div className="bg-aventurea-cream-2 px-5 py-3">
            <p className="text-[13px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Ingresos por profesional
            </p>
          </div>
          <div className="divide-y divide-aventurea-line">
            {Array.from(stats.ingresosPorProf.entries()).map(([miembroId, monto]) => (
              <div key={miembroId} className="flex items-center justify-between px-5 py-3">
                <p className="font-bold text-aventurea-ink">
                  {nombreMiembro.get(miembroId) ?? "Desconocido"}
                </p>
                <p className="font-bold text-aventurea-green">{fmtColones(monto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
