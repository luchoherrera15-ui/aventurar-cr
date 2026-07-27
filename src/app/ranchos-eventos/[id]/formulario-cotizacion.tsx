"use client";

import { useActionState } from "react";
import { solicitarCotizacion, type CotizacionState } from "../cotizacion-actions";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function FormularioCotizacion({ ranchoId }: { ranchoId: string }) {
  const accion = solicitarCotizacion.bind(null, ranchoId);
  const [state, formAction, pending] = useActionState<CotizacionState, FormData>(
    accion,
    undefined,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <div>
        <label className={labelCls}>Fecha del evento</label>
        <input type="date" name="fecha" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Cantidad de invitados (opcional)</label>
        <input type="number" name="invitados" min={1} placeholder="Ej. 80" className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Tipo de evento (opcional)</label>
        <input
          type="text"
          name="tipo_evento"
          placeholder="Ej. Cumpleaños, boda, evento corporativo..."
          className={inputCls}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Contanos qué necesitás (opcional)</label>
        <textarea
          name="notas"
          rows={3}
          placeholder="Ej. Buscamos catering para 80 personas, menú con opción vegetariana..."
          className={inputCls}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 sm:col-span-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 items-center justify-center rounded-xl bg-aventurea-navy px-6 text-sm font-bold text-white transition-colors hover:bg-aventurea-orange-dark disabled:opacity-60 sm:col-span-2 sm:w-fit"
      >
        {pending ? "Enviando..." : "Enviar solicitud"}
      </button>
      <p className="text-[12px] text-aventurea-ink-soft sm:col-span-2">
        Al enviar, se abre un chat directo con el proveedor para que te cotice.
      </p>
    </form>
  );
}
