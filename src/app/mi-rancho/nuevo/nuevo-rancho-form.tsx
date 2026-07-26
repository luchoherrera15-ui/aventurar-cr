"use client";

import { useActionState } from "react";
import { crearRancho, type NuevoRanchoState } from "./actions";
import { PROVINCIAS } from "../types";

const inputCls =
  "w-full rounded-[10px] border border-white/10 bg-zinc-800 px-3 py-2.5 text-[13.5px] text-white placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-zinc-400";

export default function NuevoRanchoForm() {
  const [state, formAction, pending] = useActionState<
    NuevoRanchoState,
    FormData
  >(crearRancho, undefined);

  return (
    <form
      action={formAction}
      className="mt-6 flex flex-col gap-3.5 rounded-[18px] border border-white/10 bg-zinc-900 p-6"
    >
      <div>
        <label className={labelCls}>Nombre del rancho</label>
        <input
          type="text"
          name="nombre"
          required
          placeholder="Ej. Rancho Los Almendros"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Descripción</label>
        <textarea
          name="descripcion"
          placeholder="Contanos qué incluye tu rancho y qué lo hace especial"
          className={`min-h-[80px] ${inputCls}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Provincia</label>
          <select name="provincia" required className={inputCls}>
            <option value="">Selecciona una opción</option>
            {PROVINCIAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Cantón</label>
          <input
            type="text"
            name="canton"
            placeholder="Ej. Esparza"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Capacidad mínima</label>
          <input
            type="number"
            min={1}
            name="capacidad_min"
            placeholder="Ej. 20"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Capacidad máxima</label>
          <input
            type="number"
            min={1}
            name="capacidad_max"
            placeholder="Ej. 150"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Precio desde (₡)</label>
          <input
            type="number"
            min={0}
            name="precio_desde"
            placeholder="Ej. 80000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>WhatsApp de contacto</label>
          <input
            type="text"
            name="contacto_whatsapp"
            placeholder="+506 ...."
            className={inputCls}
          />
        </div>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-950/40 p-2.5 text-[13px] text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1.5 rounded-full bg-aventurea-orange py-3 text-center text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar para revisión"}
      </button>
    </form>
  );
}
