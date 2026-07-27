"use client";

import { useState, useTransition } from "react";
import { IconTrash, IconWarning } from "@/components/icons";
import { TERMINOS_MAX, terminosPorDefecto } from "@/app/mi-rancho/types";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function TerminosForm({
  initialTerminos,
  initialMontoMinimo,
  depositoReserva,
  esLugar,
  onGuardar,
}: {
  initialTerminos: string[];
  initialMontoMinimo: number | null;
  depositoReserva: number;
  esLugar: boolean;
  onGuardar: (
    terminos: string[],
    montoMinimo: number | null,
  ) => Promise<{ error: string | null }>;
}) {
  const [montoMinimo, setMontoMinimo] = useState(
    initialMontoMinimo ? String(initialMontoMinimo) : "",
  );

  // Lista vacía = todavía usa los de la plataforma. Los mostramos ya
  // cargados para que el dueño los pueda editar en vez de partir de cero.
  const usabaLosDeLaPlataforma = initialTerminos.length === 0;
  const [terminos, setTerminos] = useState<string[]>(
    usabaLosDeLaPlataforma
      ? terminosPorDefecto(depositoReserva, initialMontoMinimo)
      : initialTerminos,
  );
  const [porDefecto, setPorDefecto] = useState(usabaLosDeLaPlataforma);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function editar(i: number, valor: string) {
    setTerminos((prev) => prev.map((t, j) => (j === i ? valor : t)));
    setPorDefecto(false);
    setOk(false);
  }

  function quitar(i: number) {
    setTerminos((prev) => prev.filter((_, j) => j !== i));
    setPorDefecto(false);
    setOk(false);
  }

  function agregar() {
    if (terminos.length >= TERMINOS_MAX) return;
    setTerminos((prev) => [...prev, ""]);
    setPorDefecto(false);
    setOk(false);
  }

  function restaurar() {
    setTerminos(
      terminosPorDefecto(depositoReserva, parseInt(montoMinimo) || null),
    );
    setPorDefecto(true);
    setOk(false);
  }

  function guardar() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const monto = montoMinimo ? Number(montoMinimo) : null;
      // Si nunca los tocó, guardamos lista vacía: así siguen actualizándose
      // solos cuando la plataforma cambie los suyos.
      const res = await onGuardar(porDefecto ? [] : terminos, monto);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOk(true);
    });
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      <div className="mb-4 max-w-lg">
        <label className={labelCls}>Monto mínimo de contratación (₡)</label>
        <input
          type="number"
          min={0}
          value={montoMinimo}
          onChange={(e) => {
            setMontoMinimo(e.target.value);
            setOk(false);
          }}
          placeholder="Ej. 80000 — dejalo vacío si no tenés mínimo"
          className={inputCls}
        />
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
          {esLugar
            ? "Se muestra en tu página y se agrega como condición si usás los términos de la plataforma."
            : "Se muestra en tu página para que el cliente sepa desde cuánto trabajás."}
        </p>
      </div>

      <div className="border-t border-aventurea-line pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-bold text-aventurea-ink">
              Términos y condiciones
            </h3>
            <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">
              {porDefecto
                ? "Estás usando los de Bookear CR. Editá cualquiera para hacerlos tuyos."
                : "Son tuyos: el cliente los acepta antes de confirmar."}
            </p>
          </div>
          {!porDefecto && (
            <button
              type="button"
              onClick={restaurar}
              className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
            >
              Volver a los de Bookear CR
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {terminos.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-right text-[12px] font-bold text-aventurea-ink-soft">
                {i + 1}.
              </span>
              <textarea
                value={t}
                onChange={(e) => editar(i, e.target.value)}
                placeholder="Escribí la condición..."
                // field-sizing hace que el campo crezca con el texto, para
                // que no queden condiciones cortadas a media línea.
                className={`min-h-[62px] field-sizing-content ${inputCls}`}
              />
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar el término ${i + 1}`}
                className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-300 hover:text-red-600"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {terminos.length === 0 && (
          <p className="flex items-start gap-1.5 rounded-lg bg-aventurea-orange/10 p-3 text-[12.5px] leading-relaxed text-aventurea-orange">
            <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sin términos propios se van a mostrar los de Bookear CR. Publicar
            sin condiciones te deja sin respaldo ante un daño o una cancelación.
          </p>
        )}

        {terminos.length < TERMINOS_MAX && (
          <button
            type="button"
            onClick={agregar}
            className="mt-3 rounded-lg border border-dashed border-aventurea-line px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            + Agregar una condición
          </button>
        )}
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
        className="mt-4 rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar términos"}
      </button>
    </div>
  );
}
