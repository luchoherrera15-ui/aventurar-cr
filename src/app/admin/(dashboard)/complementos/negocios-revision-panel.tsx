"use client";

import { useState, useTransition } from "react";
import { aprobarNegocioLealtad } from "./plan-actions";

/**
 * Los negocios recién creados esperando el visto bueno (0129). Un solo
 * botón: aprobar los desbloquea para elegir paquete y dejar su
 * solicitud — hasta entonces su panel dice "en revisión".
 */

export type NegocioEnRevision = {
  id: string;
  nombre: string;
  vertical: string | null;
  creador: string;
  correo: string;
  fecha: string;
};

export default function NegociosRevisionPanel({ negocios }: { negocios: NegocioEnRevision[] }) {
  const [filas, setFilas] = useState(negocios);
  if (filas.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-amber-500 bg-white">
      <p className="border-b border-aventurea-line bg-amber-500 px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white">
        Negocios nuevos en revisión · {filas.length}
      </p>
      {filas.map((n, i) => (
        <Fila
          key={n.id}
          negocio={n}
          primera={i === 0}
          alAprobar={() => setFilas((prev) => prev.filter((x) => x.id !== n.id))}
        />
      ))}
    </div>
  );
}

function Fila({
  negocio: n,
  primera,
  alAprobar,
}: {
  negocio: NegocioEnRevision;
  primera: boolean;
  alAprobar: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function aprobar() {
    iniciar(async () => {
      const res = await aprobarNegocioLealtad({ ranchoId: n.id });
      if (res.error) setError(res.error);
      else alAprobar();
    });
  }

  return (
    <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-aventurea-ink">
          {n.nombre}
        </span>
        {n.vertical && (
          <span className="rounded-full bg-aventurea-cream-2 px-2.5 py-0.5 text-[11px] font-bold text-aventurea-ink-soft">
            {n.vertical}
          </span>
        )}
        <span className="text-[11.5px] text-aventurea-ink-soft">{n.fecha}</span>
        <button
          type="button"
          onClick={aprobar}
          disabled={ocupado}
          className="rounded-[10px] bg-aventurea-navy px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
        >
          Aprobar
        </button>
      </div>
      <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
        Lo creó {n.creador} · {n.correo}
      </p>
      {error && <p className="mt-1 text-[12.5px] font-bold text-red-700">{error}</p>}
    </div>
  );
}
