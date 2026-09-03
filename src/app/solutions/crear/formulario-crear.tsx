"use client";

import { useActionState } from "react";
import { crearNegocioSolutions } from "./actions";
import { TOPES } from "@/lib/solutions/tipos";

export default function FormularioCrear() {
  const [estado, accion, pendiente] = useActionState(crearNegocioSolutions, null);
  return (
    <form action={accion} className="flex flex-col gap-4">
      <div>
        <label htmlFor="nombre" className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
          Nombre del negocio
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          minLength={2}
          maxLength={TOPES.nombre}
          autoFocus
          placeholder="Café Aroma"
          className="mt-1.5 w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-3 text-[16px] font-bold text-aventurea-navy outline-none focus:border-bookea-azul"
        />
      </div>
      {estado?.error && <p className="rounded-xl bg-red-50 p-3 text-[13px] font-bold text-red-700">{estado.error}</p>}
      <button
        type="submit"
        disabled={pendiente}
        className="presionable inline-flex min-h-[48px] items-center justify-center rounded-xl bg-aventurea-navy px-6 text-[15px] font-extrabold text-white disabled:opacity-60"
      >
        {pendiente ? "Creando…" : "Crear mi negocio →"}
      </button>
    </form>
  );
}
