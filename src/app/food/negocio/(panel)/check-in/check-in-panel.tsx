"use client";

import { useState, useTransition } from "react";
import { hacerCheckInPorCodigo } from "../panel-actions";

export default function CheckInPanel({ negocioId }: { negocioId: string }) {
  const [codigo, setCodigo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<
    { tipo: "ok"; partySize: number } | { tipo: "error"; mensaje: string } | null
  >(null);

  function confirmar() {
    setResultado(null);
    iniciar(async () => {
      const r = await hacerCheckInPorCodigo(negocioId, codigo);
      if (!r.ok) {
        setResultado({ tipo: "error", mensaje: r.error });
        return;
      }
      setResultado({ tipo: "ok", partySize: r.partySize });
      setCodigo("");
    });
  }

  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-4 rounded-2xl border border-aventurea-line bg-white p-6 text-center">
      <p className="text-[13.5px] text-aventurea-ink-soft">
        Pedile el código de 6 caracteres al cliente y escribilo acá.
      </p>
      <label htmlFor="codigo-checkin" className="sr-only">
        Código de confirmación de 6 caracteres
      </label>
      <input
        id="codigo-checkin"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && confirmar()}
        maxLength={6}
        autoFocus
        placeholder="A1B2C3"
        aria-label="Código de confirmación de 6 caracteres"
        className="w-full rounded-xl border border-aventurea-line bg-white px-4 py-3 text-center font-mono text-2xl font-extrabold tracking-[0.2em] text-aventurea-navy outline-none focus:border-aventurea-navy"
      />
      <button
        type="button"
        disabled={pendiente || codigo.trim().length < 4}
        onClick={confirmar}
        className="w-full rounded-xl bg-aventurea-navy px-5 py-3 text-[15px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
      >
        {pendiente ? "Verificando…" : "Confirmar check-in"}
      </button>

      {resultado?.tipo === "ok" && (
        <p className="w-full rounded-xl bg-aventurea-green/10 px-4 py-3 text-[14px] font-bold text-aventurea-green">
          ✓ Check-in listo — {resultado.partySize} {resultado.partySize === 1 ? "persona" : "personas"}
        </p>
      )}
      {resultado?.tipo === "error" && (
        <p className="w-full rounded-xl bg-red-50 px-4 py-3 text-[14px] font-bold text-red-700">
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
