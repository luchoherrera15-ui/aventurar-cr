"use client";

import { useState, useTransition } from "react";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export type CuentasPago = {
  sinpeNumero: string;
  sinpeTitular: string;
  cuentaBanco: string;
  cuentaNumero: string;
  cuentaTitular: string;
  cuentaTipo: string;
};

export default function CuentasPagoForm({
  initial,
  onGuardar,
}: {
  initial: CuentasPago;
  onGuardar: (cuentas: CuentasPago) => Promise<{ error: string | null }>;
}) {
  const [cuentas, setCuentas] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function set<K extends keyof CuentasPago>(campo: K, valor: string) {
    setCuentas((prev) => ({ ...prev, [campo]: valor }));
    setOk(false);
  }

  function guardar() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await onGuardar(cuentas);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOk(true);
    });
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <p className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        El cliente ve estos datos recién en el segundo paso de la reserva,
        cuando ya eligió cómo va a pagar el depósito. Completá al menos uno
        de los dos — si dejás alguno vacío, esa forma de pago no se le
        ofrece al cliente.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-aventurea-ink">
            SINPE Móvil
          </h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Número de teléfono</label>
              <input
                type="text"
                value={cuentas.sinpeNumero}
                onChange={(e) => set("sinpeNumero", e.target.value)}
                placeholder="Ej. 8888-8888"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>A nombre de</label>
              <input
                type="text"
                value={cuentas.sinpeTitular}
                onChange={(e) => set("sinpeTitular", e.target.value)}
                placeholder="Nombre del titular"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[13px] font-bold text-aventurea-ink">
            Transferencia bancaria
          </h3>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>Banco</label>
              <input
                type="text"
                value={cuentas.cuentaBanco}
                onChange={(e) => set("cuentaBanco", e.target.value)}
                placeholder="Ej. BAC, BCR, Banco Nacional..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Número de cuenta / IBAN</label>
              <input
                type="text"
                value={cuentas.cuentaNumero}
                onChange={(e) => set("cuentaNumero", e.target.value)}
                placeholder="CR00000000000000000000"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tipo</label>
                <select
                  value={cuentas.cuentaTipo}
                  onChange={(e) => set("cuentaTipo", e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  <option value="ahorro">Ahorro</option>
                  <option value="corriente">Corriente</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>A nombre de</label>
                <input
                  type="text"
                  value={cuentas.cuentaTitular}
                  onChange={(e) => set("cuentaTitular", e.target.value)}
                  placeholder="Nombre del titular"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-4 rounded-lg bg-aventurea-green/10 p-2.5 text-[13px] font-bold text-aventurea-green">
          ✓ Guardado.
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="mt-4 rounded-xl bg-aventurea-sky px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar cuentas"}
      </button>
    </div>
  );
}
