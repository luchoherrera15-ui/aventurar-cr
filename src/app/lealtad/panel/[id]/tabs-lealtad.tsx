"use client";

import { useState, type ReactNode } from "react";

/**
 * El shell de pestañas del panel de lealtad: General, Auditoría,
 * Métricas, Equipo (y Configuración para Bookea).
 *
 * Las pestañas visibles las decide el SERVIDOR según el permiso de
 * quien mira — acá solo se pinta lo que llegó. Todo el contenido queda
 * montado y se oculta con `hidden` (el patrón de PanelSidebar): cambiar
 * de pestaña no re-consulta nada y el estado del escáner sobrevive.
 */

export type PestanaLealtad = { id: string; etiqueta: string };

export default function TabsLealtad({
  pestanas,
  contenidos,
}: {
  pestanas: PestanaLealtad[];
  contenidos: Record<string, ReactNode>;
}) {
  const [activa, setActiva] = useState(pestanas[0]?.id ?? "general");

  // Si al que mira le quitaron un permiso, la pestaña elegida puede ya
  // no venir en la lista del servidor: se cae a la primera visible en
  // vez de renderizar nada.
  const efectiva = pestanas.some((p) => p.id === activa) ? activa : (pestanas[0]?.id ?? "general");

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {pestanas.map((p) => {
          const esta = p.id === efectiva;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={esta}
              onClick={() => setActiva(p.id)}
              className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
                esta ? "bg-white text-[#0a1226]" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      {pestanas.map((p) => (
        <section key={p.id} hidden={p.id !== efectiva} className="mt-5">
          {contenidos[p.id]}
        </section>
      ))}
    </div>
  );
}
