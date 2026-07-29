"use client";

import { useState } from "react";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

function fmt(n: number) {
  return "₡" + Math.round(n).toLocaleString("es-CR");
}

/**
 * Maqueta visual de cómo se vería cobrar con tarjeta y qué dejaría un
 * 15% de comisión — nada de esto llama a un procesador real. Bookea
 * hoy solo recibe comprobantes de SINPE/transferencia; esto es para
 * que el equipo vea la idea antes de decidir integrar una pasarela.
 */
export default function PasarelaPreview() {
  const [numero, setNumero] = useState("");
  const [venc, setVenc] = useState("");
  const [cvv, setCvv] = useState("");
  const [pagado, setPagado] = useState(false);
  const [monto, setMonto] = useState(150000);

  const comision = monto * 0.15;
  const recibeProveedor = monto - comision;

  return (
    <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
        Solo vista previa — no funcional
      </p>
      <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
        Pasarela de pago con tarjeta
      </h3>
      <p className="mt-1 max-w-[70ch] text-[12.5px] text-aventurea-ink-soft">
        Así se vería cobrar con tarjeta en vez de SINPE/comprobante. Esta
        maqueta no procesa ningún pago real ni se conecta a ningún banco —
        es para decidir el diseño antes de integrar una pasarela de verdad.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tarjetita + formulario, decorativos */}
        <div>
          <div className="relative aspect-[1.586/1] w-full max-w-[340px] overflow-hidden rounded-2xl bg-gradient-to-br from-aventurea-navy to-aventurea-navy-2 p-5 text-white shadow-lg">
            <div className="text-[11px] font-bold uppercase tracking-wide text-white/60">
              Bookea Pay
            </div>
            <div className="mt-7 text-[17px] font-bold tracking-[0.12em] tabular-nums">
              {numero ? numero.padEnd(19, "•") : "•••• •••• •••• ••••"}
            </div>
            <div className="mt-5 flex items-center justify-between text-[11px] text-white/70">
              <span>{venc || "MM/AA"}</span>
              <span className="font-bold uppercase tracking-wide">Débito / Crédito</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className={labelCls}>Número de tarjeta</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={19}
                value={numero}
                onChange={(e) => setNumero(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="4242 4242 4242 4242"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Vencimiento</label>
                <input
                  type="text"
                  maxLength={5}
                  value={venc}
                  onChange={(e) => setVenc(e.target.value)}
                  placeholder="MM/AA"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>CVV</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="123"
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPagado(true)}
              className="mt-1 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
            >
              Cobrar {fmt(monto)} (simulado)
            </button>
            {pagado && (
              <p className="rounded-lg bg-aventurea-green/10 p-2.5 text-[13px] font-bold text-aventurea-green">
                ✓ Pago simulado — ningún dinero se movió de verdad.
              </p>
            )}
          </div>
        </div>

        {/* Calculadora del 15% */}
        <div className="rounded-xl bg-aventurea-cream-2 p-4.5">
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-aventurea-orange">
            ¿Y si cobráramos 15% por transacción?
          </label>
          <p className="mb-3 text-[12px] text-aventurea-ink-soft">
            Metelé el monto de una reserva para ver cuánto sería la comisión y
            cuánto le quedaría al proveedor.
          </p>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-bold text-aventurea-ink-soft">₡</span>
            <input
              type="number"
              min={0}
              value={monto}
              onChange={(e) => setMonto(Math.max(0, Number(e.target.value)))}
              className="w-40 rounded-lg border border-aventurea-line bg-aventurea-surface px-2.5 py-2 text-[13px] text-aventurea-ink"
            />
            <span className="text-[12.5px] text-aventurea-ink-soft">monto de la reserva</span>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-aventurea-surface p-3.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-aventurea-ink-soft">Monto total</span>
              <span className="font-bold text-aventurea-ink">{fmt(monto)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-aventurea-ink-soft">Comisión Bookea (15%)</span>
              <span className="font-bold text-aventurea-orange">{fmt(comision)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-aventurea-line pt-2 text-[13px]">
              <span className="text-aventurea-ink-soft">Le queda al proveedor</span>
              <span className="font-bold text-aventurea-green">{fmt(recibeProveedor)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
