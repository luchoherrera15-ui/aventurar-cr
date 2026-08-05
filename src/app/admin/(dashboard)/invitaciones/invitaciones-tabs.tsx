"use client";

import { useState } from "react";

import type { TabInvitaciones } from "./pestanas";

const TABS: { id: TabInvitaciones; label: string; hint: string }[] = [
  {
    id: "invitaciones",
    label: "Invitaciones",
    hint: "Las que ya existen: link, confirmaciones y álbum",
  },
  {
    id: "pedidos",
    label: "Pedidos",
    hint: "Lo que el cliente llenó y todavía hay que diseñar",
  },
];

/**
 * Las dos caras del panel de invitaciones en una sola pantalla, igual
 * que en Finanzas y en IA: los paneles se montan todos y se esconden
 * con CSS, así el formulario que estabas llenando en una pestaña sigue
 * ahí cuando volvés de la otra.
 */
export default function InvitacionesTabs({
  inicial = "invitaciones",
  pendientes = 0,
  invitaciones,
  pedidos,
}: {
  inicial?: TabInvitaciones;
  /** Pedidos que esperan algo del equipo — el globito de la pestaña. */
  pendientes?: number;
  invitaciones: React.ReactNode;
  pedidos: React.ReactNode;
}) {
  const [activa, setActiva] = useState<TabInvitaciones>(inicial);
  const contenido: Record<TabInvitaciones, React.ReactNode> = {
    invitaciones,
    pedidos,
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de invitaciones digitales"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-aventurea-line bg-aventurea-surface p-1.5 shadow-sm"
      >
        {TABS.map((t) => {
          const seleccionada = activa === t.id;
          const globo = t.id === "pedidos" && pendientes > 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-inv-${t.id}`}
              aria-selected={seleccionada}
              aria-controls={`panel-inv-${t.id}`}
              onClick={() => setActiva(t.id)}
              className={`flex-1 rounded-xl px-4 py-2.5 text-left transition-colors ${
                seleccionada
                  ? "bg-aventurea-navy text-white"
                  : "text-aventurea-ink-soft hover:bg-aventurea-cream-2 hover:text-aventurea-ink"
              }`}
            >
              <span className="flex items-center gap-2 text-[13.5px] font-bold">
                {t.label}
                {globo && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                      seleccionada
                        ? "bg-white/20 text-white"
                        : "bg-aventurea-sky text-white"
                    }`}
                  >
                    {pendientes}
                  </span>
                )}
              </span>
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
          id={`panel-inv-${t.id}`}
          aria-labelledby={`tab-inv-${t.id}`}
          className={`mt-6 ${activa === t.id ? "" : "hidden"}`}
        >
          {contenido[t.id]}
        </div>
      ))}
    </div>
  );
}
