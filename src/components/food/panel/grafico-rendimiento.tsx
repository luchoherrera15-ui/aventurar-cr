"use client";

import { useState } from "react";
import type { PuntoDia } from "@/lib/food/panel-demo";
import { fmtFechaCorta } from "@/lib/fechas";
import { GraficoArea } from "./grafico-area";

/**
 * EL GRÁFICO PRINCIPAL DEL DASHBOARD: la serie diaria con pestañas
 * [Reservas] [Personas] [Check-ins]. Una serie a la vista por vez —
 * tres líneas encimadas de tres métricas emparentadas (los check-ins
 * viven DEBAJO de las reservas por definición) solo se taparían entre
 * ellas; la pestaña deja comparar formas sin ensuciar.
 *
 * Importa de panel-demo SOLO el tipo (import type, se borra al
 * compilar): los datos llegan por props desde el Server Component, y
 * el día que la serie salga de food_reservations este componente no
 * cambia ni una línea.
 *
 * Cada métrica tiene SU color fijo del tema (la identidad sigue a la
 * métrica, no a la pestaña activa): reservas celeste, personas navy,
 * check-ins verde — los tres medidos contra blanco en el sistema.
 */

type Metrica = "reservas" | "personas" | "checkIns";

const METRICAS: { id: Metrica; rotulo: string; color: string }[] = [
  { id: "reservas", rotulo: "Reservas", color: "var(--color-aventurea-sky)" },
  { id: "personas", rotulo: "Personas", color: "var(--color-aventurea-navy-3)" },
  { id: "checkIns", rotulo: "Check-ins", color: "var(--color-aventurea-green)" },
];

export function GraficoRendimiento({
  serie,
  alto = 250,
  className = "",
}: {
  serie: PuntoDia[];
  alto?: number;
  className?: string;
}) {
  const [activa, setActiva] = useState<Metrica>("reservas");
  const metrica = METRICAS.find((m) => m.id === activa) ?? METRICAS[0];

  const puntos = serie.map((p) => ({ etiqueta: fmtFechaCorta(p.fecha), valor: p[activa] }));
  const total = serie.reduce((a, p) => a + p[activa], 0);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Control segmentado: fondo hundido, pestaña activa blanca. */}
        <div
          role="tablist"
          aria-label="Métrica del gráfico"
          className="inline-flex rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-0.5"
        >
          {METRICAS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === activa}
              onClick={() => setActiva(m.id)}
              className={`rounded-[10px] px-3 py-1.5 text-[12px] font-bold transition-colors ${
                m.id === activa
                  ? "bg-white text-aventurea-navy shadow-[var(--shadow-plano)]"
                  : "text-aventurea-ink-soft hover:text-aventurea-ink"
              }`}
            >
              {m.rotulo}
            </button>
          ))}
        </div>

        <p className="text-[12px] text-aventurea-ink-soft">
          <span className="font-extrabold text-aventurea-ink">
            {total.toLocaleString("es-CR")}
          </span>{" "}
          {metrica.rotulo.toLowerCase()} en el período
        </p>
      </div>

      <GraficoArea
        puntos={puntos}
        serie={metrica.rotulo}
        color={metrica.color}
        alto={alto}
        className="mt-3"
      />
    </div>
  );
}
