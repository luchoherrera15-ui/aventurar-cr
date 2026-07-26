"use client";

import { useActionState, useState } from "react";
import { crearRancho, type NuevoRanchoState } from "./actions";
import { CATEGORIAS, CATEGORIA_LABEL, PROVINCIAS, type Categoria } from "../types";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function NuevoRanchoForm() {
  const [state, formAction, pending] = useActionState<
    NuevoRanchoState,
    FormData
  >(crearRancho, undefined);
  const [categoria, setCategoria] = useState<Categoria | "">("");
  const esSalon = categoria === "salon";

  return (
    <form
      action={formAction}
      className="mt-6 flex flex-col gap-3.5 rounded-[18px] border border-aventurea-line bg-white p-6"
    >
      <div>
        <label className={labelCls}>¿Qué tipo de servicio ofrecés?</label>
        <select
          name="categoria"
          required
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as Categoria)}
          className={inputCls}
        >
          <option value="">Selecciona una opción</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>
          {esSalon ? "Nombre del salón o rancho" : "Nombre de tu negocio"}
        </label>
        <input
          type="text"
          name="nombre"
          required
          placeholder={esSalon ? "Ej. Rancho Los Almendros" : "Ej. DJ Mauricio Eventos"}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Descripción</label>
        <textarea
          name="descripcion"
          placeholder="Contanos qué ofrecés y qué te hace especial"
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

      <div>
        <label className={labelCls}>Dirección exacta</label>
        <input
          type="text"
          name="direccion_exacta"
          placeholder="Ej. Calle Monge, 200m norte de la iglesia"
          className={inputCls}
        />
      </div>

      {esSalon && (
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
      )}

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
        <p className="rounded-lg bg-red-50 p-2.5 text-[13px] text-red-700">
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
