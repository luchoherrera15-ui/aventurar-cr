"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelarReservaFood } from "../actions";

export default function CancelarReserva({ reservaId }: { reservaId: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="mt-3 text-[12.5px] font-bold text-red-700 hover:underline"
      >
        Cancelar mi reserva
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <p className="text-[12.5px] font-semibold text-aventurea-ink">¿Seguro que querés cancelarla?</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await cancelarReservaFood(reservaId);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              router.refresh();
            })
          }
          className="rounded-lg bg-red-600 px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {pendiente ? "Cancelando…" : "Sí, cancelar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink-soft"
        >
          No
        </button>
      </div>
      {error && <p className="text-[12px] font-bold text-red-700">{error}</p>}
    </div>
  );
}
