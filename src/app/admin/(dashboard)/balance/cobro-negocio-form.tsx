"use client";

import { useState, useTransition } from "react";
import { guardarCobroNegocio, quitarCobroNegocio } from "./actions";
import {
  MODELOS_COBRO,
  MODELO_COBRO_LABEL,
  type CobroNegocio,
  type ModeloCobro,
} from "@/lib/cobro-plataforma";

const UNIDAD: Record<ModeloCobro, string> = {
  comision_por_persona: "₡ por persona reservada",
  comision_porcentaje: "% del total del evento",
  comision_fija_reserva: "₡ por reserva confirmada",
  membresia_mensual: "₡ por mes calendario",
  gratis: "sin cobro",
};

/**
 * La tarifa de plataforma de UN negocio, editable ahí mismo — con
 * "Volver al global" para borrar la fila y que vuelva a aplicar el
 * default (₡/persona de configuracion_plataforma). Requiere la
 * migración 0098; si la tabla no existe, guardar muestra el error.
 */
export default function CobroNegocioForm({
  ranchoId,
  nombre,
  cobroActual,
  comisionGlobal,
}: {
  ranchoId: string;
  nombre: string;
  cobroActual: CobroNegocio | null;
  comisionGlobal: number;
}) {
  const [modelo, setModelo] = useState<ModeloCobro>(
    cobroActual?.modelo ?? "comision_por_persona",
  );
  const [valor, setValor] = useState(String(cobroActual?.valor ?? ""));
  const [notas, setNotas] = useState(cobroActual?.notas ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await guardarCobroNegocio(
        ranchoId,
        modelo,
        modelo === "gratis" ? 0 : Number(valor) || 0,
        notas || null,
      );
      if (res.error) setError(res.error);
      else setMsg("Tarifa guardada — los números de arriba ya la usan.");
    });
  }

  function volverAlGlobal() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await quitarCobroNegocio(ranchoId);
      if (res.error) setError(res.error);
      else setMsg("Listo: vuelve a aplicar la tarifa global.");
    });
  }

  return (
    <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Modelo de cobro de {nombre}
      </p>
      <p className="mt-1 max-w-[70ch] text-[12.5px] text-aventurea-ink-soft">
        {cobroActual
          ? "Este negocio tiene tarifa propia — manda sobre la global."
          : `Hoy le aplica la tarifa global (₡${Math.round(comisionGlobal).toLocaleString("es-CR")} por persona). Fijale una propia acá.`}
        {" "}Mientras no cobremos automáticamente, esto alimenta la proyección.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Modelo
          </label>
          <select
            value={modelo}
            onChange={(e) => setModelo(e.target.value as ModeloCobro)}
            className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
          >
            {MODELOS_COBRO.map((m) => (
              <option key={m} value={m}>
                {MODELO_COBRO_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        {modelo !== "gratis" && (
          <div>
            <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Valor ({UNIDAD[modelo]})
            </label>
            <input
              type="number"
              min={0}
              max={modelo === "comision_porcentaje" ? 100 : undefined}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={modelo === "comision_porcentaje" ? "Ej. 8" : "Ej. 5000"}
              className="w-36 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
            />
          </div>
        )}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej. acuerdo especial hasta diciembre"
            className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13px] text-aventurea-ink"
          />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={guardar}
          className="h-[42px] rounded-xl bg-aventurea-navy px-5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-60"
        >
          Guardar tarifa
        </button>
        {cobroActual && (
          <button
            type="button"
            disabled={pending}
            onClick={volverAlGlobal}
            className="h-[42px] rounded-xl border border-aventurea-line px-4 text-[13px] font-bold text-aventurea-ink-soft hover:border-red-300 hover:text-red-700 disabled:opacity-60"
          >
            Volver al global
          </button>
        )}
      </div>

      {msg && <p className="mt-3 text-[12.5px] font-bold text-aventurea-green">✓ {msg}</p>}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
          {error.includes("cobro_negocio") &&
            " — ¿corriste la migración 0098_cobro_por_negocio.sql en el SQL Editor?"}
        </p>
      )}
    </section>
  );
}
