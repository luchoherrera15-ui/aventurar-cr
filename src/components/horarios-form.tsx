"use client";

import { useState, useTransition } from "react";
import { IconTrash, IconWarning } from "@/components/icons";
import {
  DIAS_SEMANA_CORTO,
  HORARIOS_MAX,
  duracionHoras,
  etiquetaHorario,
  resumenDias,
  type HorarioBloqueConfig,
} from "@/app/mi-negocio/types";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

/** Un punto de partida común, para no arrancar de una hoja en blanco. */
const SUGERENCIAS: Omit<HorarioBloqueConfig, "id">[] = [
  { etiqueta: "Mañana y tarde", desde: "07:00", hasta: "13:00" },
  { etiqueta: "Tarde y noche", desde: "18:00", hasta: "00:00" },
];

function nuevoId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function HorariosForm({
  initialHorarios,
  onGuardar,
}: {
  initialHorarios: HorarioBloqueConfig[];
  onGuardar: (
    horarios: HorarioBloqueConfig[],
  ) => Promise<{ error: string | null }>;
}) {
  const [horarios, setHorarios] = useState<HorarioBloqueConfig[]>(initialHorarios);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function editar(id: string, campo: keyof HorarioBloqueConfig, valor: string) {
    setHorarios((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [campo]: valor } : h)),
    );
    setOk(false);
  }

  function quitar(id: string) {
    setHorarios((prev) => prev.filter((h) => h.id !== id));
    setOk(false);
  }

  function toggleDia(id: string, dia: number) {
    setHorarios((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const dias = h.dias_semana ?? [];
        const tiene = dias.includes(dia);
        return {
          ...h,
          dias_semana: tiene ? dias.filter((d) => d !== dia) : [...dias, dia].sort(),
        };
      }),
    );
    setOk(false);
  }

  function agregar(base?: Omit<HorarioBloqueConfig, "id">) {
    if (horarios.length >= HORARIOS_MAX) return;
    setHorarios((prev) => [
      ...prev,
      { id: nuevoId(), etiqueta: "", desde: "08:00", hasta: "14:00", ...base },
    ]);
    setOk(false);
  }

  function guardar() {
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await onGuardar(horarios);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOk(true);
    });
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
      {horarios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-aventurea-line p-5 text-center">
          <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
            Todavía no definiste horarios. Sin ellos, al cliente no se le
            pregunta ninguna hora al reservar: solo elige la fecha y ustedes
            coordinan el resto.
          </p>
          <div className="mt-3.5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => agregar()}
              className="rounded-lg bg-aventurea-orange px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-aventurea-orange-dark"
            >
              + Agregar un horario
            </button>
            <button
              type="button"
              onClick={() => {
                setHorarios(SUGERENCIAS.map((s) => ({ id: nuevoId(), ...s })));
                setOk(false);
              }}
              className="rounded-lg border border-aventurea-line px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
            >
              Usar dos bloques de 6 horas
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {horarios.map((h) => {
            const horas = duracionHoras(h.desde, h.hasta);
            return (
              <div
                key={h.id}
                className="rounded-xl border border-aventurea-line bg-aventurea-cream-2/40 p-3.5"
              >
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={labelCls}>Nombre del horario</label>
                    <input
                      type="text"
                      value={h.etiqueta}
                      onChange={(e) => editar(h.id, "etiqueta", e.target.value)}
                      placeholder="Ej. Mañana, Día completo, Turno noche"
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => quitar(h.id)}
                    aria-label="Quitar este horario"
                    className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-aventurea-line text-aventurea-ink-soft hover:border-red-300 hover:text-red-600"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelCls}>Entrada</label>
                    <input
                      type="time"
                      value={h.desde}
                      onChange={(e) => editar(h.id, "desde", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Salida</label>
                    <input
                      type="time"
                      value={h.hasta}
                      onChange={(e) => editar(h.id, "hasta", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {DIAS_SEMANA_CORTO.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDia(h.id, i)}
                      aria-pressed={(h.dias_semana ?? []).includes(i)}
                      className={`rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors ${
                        (h.dias_semana ?? []).includes(i)
                          ? "bg-aventurea-navy text-white"
                          : "border border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-navy"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[10.5px] text-aventurea-ink-soft">
                  Sin ningún día marcado, aplica todos los días.
                </p>

                <p className="mt-2 text-[12px] text-aventurea-ink-soft">
                  El cliente lo va a ver así:{" "}
                  <strong className="text-aventurea-ink">{etiquetaHorario(h)}</strong>
                  {horas !== null && ` · ${horas} h`}
                  {resumenDias(h.dias_semana) && ` · ${resumenDias(h.dias_semana)}`}
                </p>
              </div>
            );
          })}

          {horarios.length < HORARIOS_MAX && (
            <button
              type="button"
              onClick={() => agregar()}
              className="rounded-lg border border-dashed border-aventurea-line px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
            >
              + Agregar otro horario
            </button>
          )}

          <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-zinc-500">
            <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Si la salida es más temprano que la entrada, el bloque se toma como
            que cruza la medianoche.
          </p>
        </div>
      )}

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
        {pending ? "Guardando..." : "Guardar horarios"}
      </button>
    </div>
  );
}
