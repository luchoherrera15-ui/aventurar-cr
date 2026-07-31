"use client";

import { useState } from "react";

import type { TabFinanzas } from "./pestanas";

const TABS: { id: TabFinanzas; label: string; hint: string }[] = [
  {
    id: "alquileres",
    label: "Ingresos de alquileres",
    hint: "Comisiones, gastos y balance del periodo",
  },
  {
    id: "promocion",
    label: "Paquetes de promoción",
    hint: "Más adelante",
  },
  {
    id: "invitaciones",
    label: "Invitaciones virtuales",
    hint: "SINPE, transferencia y Stripe",
  },
];

/**
 * Las finanzas del negocio viven todas en una sola pantalla: cada
 * fuente de plata es una pestaña, no una tarjeta suelta del panel.
 *
 * Los tres paneles se montan de una vez y se esconden con CSS, así el
 * filtro de fechas o de método de pago que dejaste puesto sigue ahí
 * cuando volvés a la pestaña.
 */
export default function FinanzasTabs({
  inicial = "alquileres",
  alquileres,
  promocion,
  invitaciones,
}: {
  inicial?: TabFinanzas;
  alquileres: React.ReactNode;
  promocion: React.ReactNode;
  invitaciones: React.ReactNode;
}) {
  const [activa, setActiva] = useState<TabFinanzas>(inicial);
  const contenido: Record<TabFinanzas, React.ReactNode> = {
    alquileres,
    promocion,
    invitaciones,
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de finanzas"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-1.5 shadow-sm"
      >
        {TABS.map((t) => {
          const seleccionada = activa === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={seleccionada}
              aria-controls={`panel-${t.id}`}
              onClick={() => setActiva(t.id)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-left transition-colors ${
                seleccionada
                  ? "bg-aventurea-navy text-white"
                  : "text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
              }`}
            >
              <span className="block text-[13.5px] font-bold">{t.label}</span>
              <span
                className={`mt-0.5 block text-[11.5px] ${
                  seleccionada ? "text-white/70" : "text-aventurea-ink-soft"
                }`}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          className={`mt-6 ${activa === t.id ? "" : "hidden"}`}
        >
          {contenido[t.id]}
        </div>
      ))}
    </div>
  );
}
