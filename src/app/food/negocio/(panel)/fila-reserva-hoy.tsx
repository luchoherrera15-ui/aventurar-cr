"use client";

import { useState, useTransition } from "react";
import { hacerCheckInPorId, marcarNoShow } from "./panel-actions";

const ESTADO_LABEL: Record<string, string> = {
  confirmada: "Confirmada",
  check_in: "Check-in hecho",
  no_show: "No se presentó",
  cancelada: "Cancelada",
};

export default function FilaReservaHoy({
  negocioId,
  reservaId,
  hora,
  partySize,
  codigo,
  estado,
}: {
  negocioId: string;
  reservaId: string;
  hora: string;
  partySize: number;
  codigo: string;
  estado: string;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [estadoLocal, setEstadoLocal] = useState(estado);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-aventurea-line bg-white p-3.5">
      <div className="w-16 shrink-0 text-[14px] font-bold text-aventurea-ink">{hora}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-aventurea-ink">
          {partySize} {partySize === 1 ? "persona" : "personas"} · <span className="font-mono">{codigo}</span>
        </p>
        {error && <p className="mt-0.5 text-[12px] font-bold text-red-700">{error}</p>}
      </div>
      {estadoLocal === "confirmada" ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await hacerCheckInPorId(negocioId, reservaId);
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setEstadoLocal("check_in");
              })
            }
            className="rounded-lg bg-aventurea-navy px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
          >
            {pendiente ? "…" : "Check-in"}
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await marcarNoShow(negocioId, reservaId);
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setEstadoLocal("no_show");
              })
            }
            className="rounded-lg border border-aventurea-line px-3 py-2 text-[12px] font-bold text-aventurea-ink-soft transition-colors hover:border-red-400 hover:text-red-700"
          >
            No llegó
          </button>
        </div>
      ) : (
        <span className="shrink-0 rounded-lg bg-aventurea-cream-2 px-3 py-1.5 text-[12px] font-bold text-aventurea-ink-soft">
          {ESTADO_LABEL[estadoLocal] ?? estadoLocal}
        </span>
      )}
    </li>
  );
}
