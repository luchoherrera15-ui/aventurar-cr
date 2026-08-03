"use client";

import { useState, useTransition } from "react";
import { fmtColones } from "@/lib/finanzas";
import { guardarDepositoCitas } from "./deposito-actions";

const inputCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink";

/**
 * El depósito para asegurar la cita: apagado por defecto (la cita se
 * paga en el local, como siempre); encendido, el cliente ve el monto
 * al reservar y las instrucciones de SINPE al confirmar. La cita
 * igual queda confirmada al instante — el depósito se valida después
 * en Finanzas, con la misma maquinaria de los eventos.
 */
export default function DepositoCitasForm({
  ranchoId,
  initialDeposito,
  tieneSinpe,
}: {
  ranchoId: string;
  initialDeposito: number | null;
  /** Sin cuenta SINPE configurada no hay cómo cobrar el depósito. */
  tieneSinpe: boolean;
}) {
  const [activo, setActivo] = useState(initialDeposito !== null && initialDeposito > 0);
  const [monto, setMonto] = useState(
    initialDeposito && initialDeposito > 0 ? String(initialDeposito) : "",
  );
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    setGuardado(false);
    const n = Number(monto);
    if (activo && (!Number.isFinite(n) || n <= 0)) {
      setError("Poné el monto del depósito (en colones).");
      return;
    }
    startTransition(async () => {
      const res = await guardarDepositoCitas(ranchoId, activo ? n : null);
      if (res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setActivo(!activo);
            setGuardado(false);
          }}
          aria-pressed={activo}
          className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
            activo
              ? "border-aventurea-green bg-aventurea-green/10 text-aventurea-green"
              : "border-aventurea-line bg-aventurea-cream-2 text-zinc-500"
          }`}
        >
          {activo ? "Con depósito" : "Sin depósito"}
        </button>
        {activo && (
          <label className="flex items-center gap-2 text-[13px] text-aventurea-ink-soft">
            ₡
            <input
              type="number"
              min={0}
              step={500}
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value);
                setGuardado(false);
              }}
              placeholder="Ej. 5000"
              aria-label="Monto del depósito en colones"
              className={`${inputCls} w-[130px]`}
            />
          </label>
        )}
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-xl bg-aventurea-orange px-4 py-2 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
        {guardado && (
          <span className="text-[12.5px] font-bold text-aventurea-green">✓ Guardado</span>
        )}
      </div>

      <p className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        {activo
          ? `Al reservar, el cliente ve que la cita lleva un depósito${monto && Number(monto) > 0 ? ` de ${fmtColones(Number(monto))}` : ""} por SINPE. La cita queda confirmada al instante y el comprobante te llega por el chat — lo validás en Finanzas, como los depósitos de eventos.`
          : "La cita se paga completa en el local (el flujo de siempre). Activá el depósito si los no-shows te están costando plata."}
      </p>
      {activo && !tieneSinpe && (
        <p className="rounded-xl bg-aventurea-orange-light p-3 text-[12.5px] text-aventurea-ink">
          Ojo: todavía no configuraste tu cuenta SINPE en Configuración → Cuentas
          de cobro — sin ella el cliente no sabe a dónde depositar.
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}
