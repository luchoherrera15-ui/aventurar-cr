"use client";

import { useState, useTransition } from "react";

/**
 * El monto del depósito para agendar, para categorías de servicio.
 * Con esto (más las cuentas de cobro) el negocio pasa de recibir
 * "solicitudes" a recibir reservas agendadas con pago por adelantado.
 */
export default function DepositoForm({
  initialDeposito,
  onGuardar,
}: {
  initialDeposito: number;
  onGuardar: (deposito: number) => Promise<{ error: string | null } | { error?: string }>;
}) {
  const [valor, setValor] = useState(String(initialDeposito || ""));
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setAviso(null);
    setError(null);
    const n = Math.round(Number(valor));
    if (!Number.isFinite(n) || n < 0) {
      setError("Poné un monto válido (0 = sin depósito).");
      return;
    }
    startTransition(async () => {
      const res = await onGuardar(n);
      if (res?.error) setError(res.error);
      else setAviso("Depósito guardado.");
    });
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Depósito para agendar (₡)
          </label>
          <input
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ej. 15000"
            className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink"
          />
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="h-[42px] rounded-xl bg-aventurea-sky px-5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-aventurea-ink-soft">
        Es lo que el cliente paga por adelantado para agendar su fecha. El
        resto lo cobrás vos directo. Con 0, la fecha se agenda sin pago.
      </p>
      {error && <p className="mt-2 text-[12.5px] text-red-700">{error}</p>}
      {aviso && <p className="mt-2 text-[12.5px] font-bold text-aventurea-green">✓ {aviso}</p>}
    </div>
  );
}
