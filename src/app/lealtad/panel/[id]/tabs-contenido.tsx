"use client";

import { useState, type ReactNode } from "react";

/**
 * EL SWITCHER DE PESTAÑAS del panel de lealtad, genérico.
 *
 * Es el mismo patrón que ya traía `ClientesVistas` (Mostrador/Auditoría) —
 * acá se generaliza para que Métricas y Configuración no reescriban el
 * mismo toggle de pastillas con otro nombre. `ClientesVistas` se queda como
 * su propio componente (tiene nombre semántico y un comentario largo
 * explicando por qué esas dos vistas van juntas): por dentro, usa este.
 *
 * Cada pestaña llega YA renderizada por el servidor — el mismo criterio de
 * siempre: cambiar de vista no repite ninguna consulta ni pierde el estado
 * de un formulario a medio llenar, porque todas quedan MONTADAS y se
 * esconden con `hidden`.
 */

export type PestanaContenido = {
  id: string;
  etiqueta: string;
  contenido: ReactNode;
};

export default function TabsContenido({
  etiquetaGrupo,
  pestanas,
}: {
  /** Para `aria-label` del `role="tablist"` — qué está eligiendo la persona. */
  etiquetaGrupo: string;
  pestanas: PestanaContenido[];
}) {
  const [activa, setActiva] = useState(pestanas[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={etiquetaGrupo}
        className="inline-flex w-fit flex-wrap gap-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
      >
        {pestanas.map((p) => (
          <BotonVista key={p.id} activo={activa === p.id} onClick={() => setActiva(p.id)}>
            {p.etiqueta}
          </BotonVista>
        ))}
      </div>

      {pestanas.map((p) => (
        <div key={p.id} hidden={activa !== p.id}>
          {p.contenido}
        </div>
      ))}
    </div>
  );
}

function BotonVista({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${
        activo
          ? "bg-white text-aventurea-navy shadow-sm"
          : "text-aventurea-ink-soft hover:text-aventurea-navy"
      }`}
    >
      {children}
    </button>
  );
}
