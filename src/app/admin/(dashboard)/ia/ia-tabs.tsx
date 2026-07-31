"use client";

import { useState } from "react";

export type TabIA = "gasto" | "modelos" | "conocimiento";

const TABS: { id: TabIA; label: string; hint: string }[] = [
  {
    id: "gasto",
    label: "Gasto",
    hint: "Cuánto costó cada llamada, por agente y por día",
  },
  {
    id: "modelos",
    label: "Modelos",
    hint: "Con qué modelo trabaja cada agente y cuánto cuesta",
  },
  {
    id: "conocimiento",
    label: "Conocimiento",
    hint: "Lo que el asistente sabe de cada negocio",
  },
];

export function esTabIA(valor: string | undefined): valor is TabIA {
  return TABS.some((t) => t.id === valor);
}

/**
 * Las tres caras del panel de IA viven en una sola pantalla, igual que
 * en Finanzas: los paneles se montan todos y se esconden con CSS, así
 * el negocio que estabas editando en Conocimiento o el modelo que ya
 * habías cambiado sin guardar siguen ahí cuando volvés a la pestaña.
 */
export default function IaTabs({
  inicial = "gasto",
  gasto,
  modelos,
  conocimiento,
}: {
  inicial?: TabIA;
  gasto: React.ReactNode;
  modelos: React.ReactNode;
  conocimiento: React.ReactNode;
}) {
  const [activa, setActiva] = useState<TabIA>(inicial);
  const contenido: Record<TabIA, React.ReactNode> = {
    gasto,
    modelos,
    conocimiento,
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de inteligencia artificial"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-1.5 shadow-sm"
      >
        {TABS.map((t) => {
          const seleccionada = activa === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-ia-${t.id}`}
              aria-selected={seleccionada}
              aria-controls={`panel-ia-${t.id}`}
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
          id={`panel-ia-${t.id}`}
          aria-labelledby={`tab-ia-${t.id}`}
          className={`mt-6 ${activa === t.id ? "" : "hidden"}`}
        >
          {contenido[t.id]}
        </div>
      ))}
    </div>
  );
}
