"use client";

import { useActionState } from "react";
import { promoverModerador, type ResultadoPromo } from "./actions";

/**
 * El formulario para dar de alta un moderador. Cliente para poder
 * mostrar el resultado (código generado / error) sin recargar. El alta
 * la resuelve la server action `promoverModerador`.
 */
export default function PromoverModeradorForm() {
  const [estado, accion, enviando] = useActionState<ResultadoPromo | null, FormData>(
    promoverModerador,
    null,
  );

  return (
    <form action={accion} className="rounded-2xl border border-aventurea-line bg-white p-5">
      <p className="text-[14px] font-extrabold text-aventurea-navy">
        Dar rol de moderador a un usuario
      </p>
      <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
        La persona tiene que estar registrada en Bookea. El código de 4 dígitos
        se genera solo. La comisión no se fija acá: sale sola del paquete de
        cada negocio (Starter en grupos de 3 · Impulso $10).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
            Correo de la cuenta
          </span>
          <input
            type="email"
            name="correo"
            required
            placeholder="vendedor@correo.com"
            className="mt-1 w-full rounded-xl border border-aventurea-line bg-aventurea-surface px-3 py-2 text-[14px] text-aventurea-ink"
          />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-extrabold text-white transition disabled:opacity-50"
        >
          {enviando ? "Creando…" : "Dar rol"}
        </button>
      </div>

      {estado?.aviso && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-bold text-emerald-700">
          {estado.aviso}
        </p>
      )}
      {estado?.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-bold text-red-600">
          {estado.error}
        </p>
      )}
    </form>
  );
}
