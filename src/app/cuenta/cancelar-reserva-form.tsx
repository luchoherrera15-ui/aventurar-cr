"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarReservaCliente } from "./actions";

/**
 * Cancelar la propia reserva, sin salir de la cuenta — mismo patrón que
 * `resena-form.tsx` (un botón que despliega un panel en el lugar). El
 * motivo es obligatorio: el dueño lo pidió explícito ("debe dejar un
 * detalle del por qué cancela").
 */
export default function CancelarReservaForm({
  reservaId,
  nombreRancho,
}: {
  reservaId: string;
  nombreRancho: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    if (motivo.trim().length < 3) {
      setError("Contanos por qué cancelás.");
      return;
    }
    startTransition(async () => {
      const res = await cancelarReservaCliente(reservaId, motivo);
      if (res.error) {
        setError(res.error);
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-[12.5px] font-bold text-red-700 hover:underline"
      >
        Cancelar reserva
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-3.5">
      <p className="text-[13px] font-bold text-aventurea-ink">
        ¿Por qué cancelás en {nombreRancho}?
      </p>
      <p className="mt-0.5 text-[11.5px] text-aventurea-ink-soft">
        Si dejaste un adelanto, no se devuelve solo por cancelar — el negocio lo revisa a mano.
      </p>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={500}
        placeholder="Ej.: se me complicó el día, encontré otra opción, etc."
        className="mt-2.5 min-h-[64px] w-full rounded-[10px] border border-aventurea-line bg-aventurea-surface px-3 py-2 text-[13px] text-aventurea-ink placeholder:text-zinc-400"
      />
      {error && <p className="mt-1.5 text-[12px] font-bold text-red-700">{error}</p>}
      <div className="mt-2.5 flex gap-3">
        <button
          type="button"
          onClick={confirmar}
          disabled={pendiente}
          className="rounded-lg bg-red-700 px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
        >
          {pendiente ? "Cancelando..." : "Confirmar cancelación"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[12.5px] font-bold text-zinc-500 hover:text-aventurea-ink"
        >
          Ya no
        </button>
      </div>
    </div>
  );
}
