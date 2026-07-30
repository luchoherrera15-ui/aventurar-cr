"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";

type Grupo = {
  titulo: string;
  items: { id: string; label: string }[];
};

/**
 * Las amenidades como tabs: los grupos (Espacios, Cocina, Servicios...)
 * van arriba como pastillas y solo se despliega el grupo elegido.
 * Sin caja contenedora: las pastillas y la lista viven directo sobre
 * la página — la tarjeta blanca gigante se veía pesada.
 */
export default function AmenidadesTabs({
  grupos,
  enColumna = false,
}: {
  grupos: Grupo[];
  enColumna?: boolean;
}) {
  const [activo, setActivo] = useState(0);
  const grupo = grupos[Math.min(activo, grupos.length - 1)];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {grupos.map((g, i) => {
          const esActivo = i === activo;
          return (
            <button
              key={g.titulo}
              type="button"
              onClick={() => setActivo(i)}
              aria-expanded={esActivo}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold transition-all ${
                esActivo
                  ? "bg-aventurea-navy text-white shadow-[0_4px_14px_rgba(22,41,94,0.28)]"
                  : "border border-aventurea-line bg-aventurea-surface text-aventurea-ink-soft hover:border-aventurea-navy/40 hover:text-aventurea-ink"
              }`}
            >
              {g.titulo}
              <span
                className={`text-[11px] font-extrabold ${
                  esActivo ? "text-white/70" : "text-aventurea-ink-soft/60"
                }`}
              >
                {g.items.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* El grupo elegido, sin caja: solo los checks en columnas. */}
      <ul
        key={grupo.titulo}
        className={`anim-panel-entrar mt-5 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2 ${
          enColumna ? "" : "lg:grid-cols-3"
        }`}
      >
        {grupo.items.map((i) => (
          <li
            key={i.id}
            className="flex items-center gap-2.5 text-[13.5px] text-aventurea-ink"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aventurea-green/15 text-aventurea-green">
              <IconCheck className="h-3 w-3" />
            </span>
            {i.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
