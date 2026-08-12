"use client";

import { useState, useTransition } from "react";
import { atenderSolicitudLealtad } from "./plan-actions";

/**
 * La bandeja de solicitudes del plan de lealtad (0126): lo primero que
 * ve el admin al entrar a Complementos, porque es plata esperando.
 * "Aprobar" hace las tres cosas de una: plan + complemento + marcada.
 */

export type SolicitudPendiente = {
  id: string;
  ranchoId: string;
  negocio: string;
  plan: string;
  solicitante: string;
  correo: string;
  telefono: string | null;
  mensaje: string | null;
  fecha: string;
};

export default function SolicitudesPanel({ solicitudes }: { solicitudes: SolicitudPendiente[] }) {
  const [filas, setFilas] = useState(solicitudes);
  if (filas.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-aventurea-navy bg-white">
      <p className="border-b border-aventurea-line bg-aventurea-navy px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white">
        Solicitudes del plan de lealtad · {filas.length}
      </p>
      {filas.map((s, i) => (
        <Fila
          key={s.id}
          solicitud={s}
          primera={i === 0}
          alResolver={() => setFilas((prev) => prev.filter((x) => x.id !== s.id))}
        />
      ))}
    </div>
  );
}

function Fila({
  solicitud: s,
  primera,
  alResolver,
}: {
  solicitud: SolicitudPendiente;
  primera: boolean;
  alResolver: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const [aprobada, setAprobada] = useState(false);

  function atender(aprobar: boolean) {
    if (!aprobar && !confirm(`¿Rechazar la solicitud de ${s.negocio}?`)) return;
    iniciar(async () => {
      const res = await atenderSolicitudLealtad({ solicitudId: s.id, aprobar });
      if (res.error) setError(res.error);
      else if (aprobar) setAprobada(true); // se deja a la vista: el paso que sigue es configurar
      else alResolver();
    });
  }

  if (aprobada) {
    return (
      <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
        <p className="text-[13px] font-bold text-aventurea-green">
          {s.negocio} activado con el plan {s.plan}.{" "}
          <a
            href={`/lealtad/panel/${s.ranchoId}`}
            className="text-aventurea-ink underline"
          >
            Configurar su programa →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-aventurea-ink">
          {s.negocio}
        </span>
        <span className="rounded-full bg-aventurea-cream-2 px-2.5 py-0.5 text-[11px] font-bold uppercase text-aventurea-ink">
          {s.plan}
        </span>
        <span className="text-[11.5px] text-aventurea-ink-soft">{s.fecha}</span>
        <button
          type="button"
          onClick={() => atender(true)}
          disabled={ocupado}
          className="rounded-[10px] bg-aventurea-navy px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
        >
          Aprobar y activar
        </button>
        <button
          type="button"
          onClick={() => atender(false)}
          disabled={ocupado}
          className="text-[12px] font-bold text-red-700 underline"
        >
          Rechazar
        </button>
      </div>
      <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
        Pide {s.solicitante} · {s.correo}
        {s.telefono ? ` · tel ${s.telefono}` : ""}
      </p>
      {s.mensaje && (
        <p className="mt-0.5 text-[12.5px] italic text-aventurea-ink-soft">“{s.mensaje}”</p>
      )}
      {error && <p className="mt-1 text-[12.5px] font-bold text-red-700">{error}</p>}
    </div>
  );
}
