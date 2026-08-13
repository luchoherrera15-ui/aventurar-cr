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
    // El id conserva el nombre viejo para no romper enlaces guardados
    // (?tab=invitaciones): la pestaña ahora junta TODA la venta directa
    // de Bookea — invitaciones y planes de lealtad — desglosada por
    // producto y por método de pago.
    id: "invitaciones",
    label: "Ventas Bookea",
    hint: "Invitaciones y planes de lealtad · SINPE vs transferencia",
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
              // basis-full en móvil: tres pestañas a ~100px partían el
              // hint en siete líneas de 11.5px.
              className={`basis-full rounded-xl px-4 py-2.5 text-left transition-colors sm:flex-1 sm:basis-0 ${
                seleccionada
                  ? "bg-aventurea-navy text-white"
                  : "text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
              }`}
            >
              <span className="block text-[13.5px] font-bold">{t.label}</span>
              <span
                className={`mt-0.5 hidden text-[11.5px] sm:block ${
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
