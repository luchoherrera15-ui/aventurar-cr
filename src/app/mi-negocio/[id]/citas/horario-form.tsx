"use client";

import { useState, useTransition } from "react";
import { DIAS_SEMANA_LABEL, type HorarioSemana } from "@/app/citas/tipos";
import { guardarHorarioCitas } from "./actions";

const inputTimeCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13.5px] text-aventurea-ink";

type DiaBorrador = { abierto: boolean; abre: string; cierra: string };

/**
 * El estado inicial del editor. Sin horario guardado se sugiere lunes
 * a sábado de 9 a 6 — el dueño lo ajusta y lo guarda; hasta entonces
 * las citas se aceptan a cualquier hora (así lo trata el RPC).
 */
function estadoInicial(horario: HorarioSemana | null): DiaBorrador[] {
  return Array.from({ length: 7 }, (_, dow) => {
    const dia = horario?.[String(dow)];
    if (dia) return { abierto: true, abre: dia.abre, cierra: dia.cierra };
    return {
      abierto: horario === null ? dow !== 0 : false,
      abre: "09:00",
      cierra: "18:00",
    };
  });
}

/**
 * El horario semanal del negocio de citas: qué días abre y de qué hora
 * a qué hora. Es lo que limita las horas que el cliente puede elegir
 * al reservar y lo que se muestra en la página pública.
 */
export default function HorarioForm({
  ranchoId,
  initialHorario,
}: {
  ranchoId: string;
  initialHorario: HorarioSemana | null;
}) {
  const [dias, setDias] = useState<DiaBorrador[]>(() => estadoInicial(initialHorario));
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cambiar(dow: number, cambio: Partial<DiaBorrador>) {
    setDias((prev) => prev.map((d, i) => (i === dow ? { ...d, ...cambio } : d)));
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const horario: HorarioSemana = {};
      dias.forEach((d, dow) => {
        horario[String(dow)] = d.abierto ? { abre: d.abre, cierra: d.cierra } : null;
      });
      const res = await guardarHorarioCitas(ranchoId, horario);
      if (res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {initialHorario === null && (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
          Todavía no guardaste tu horario: mientras tanto se aceptan citas a{" "}
          <strong>cualquier hora</strong>. Revisá la sugerencia de abajo,
          ajustala a tu realidad y guardala.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
        {DIAS_SEMANA_LABEL.map((etiqueta, dow) => {
          const dia = dias[dow];
          return (
            <div
              key={etiqueta}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-aventurea-line px-4 py-3 last:border-none"
            >
              <span className="w-[88px] text-[13.5px] font-bold text-aventurea-ink">
                {etiqueta}
              </span>
              <button
                type="button"
                onClick={() => cambiar(dow, { abierto: !dia.abierto })}
                aria-pressed={dia.abierto}
                className={`w-[86px] rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  dia.abierto
                    ? "border-aventurea-green bg-aventurea-green/10 text-aventurea-green"
                    : "border-aventurea-line bg-aventurea-cream-2 text-zinc-500"
                }`}
              >
                {dia.abierto ? "Abierto" : "Cerrado"}
              </button>
              {dia.abierto ? (
                <span className="flex items-center gap-2 text-[13px] text-aventurea-ink-soft">
                  <input
                    type="time"
                    value={dia.abre}
                    onChange={(e) => cambiar(dow, { abre: e.target.value })}
                    aria-label={`Hora de apertura del ${etiqueta.toLowerCase()}`}
                    className={inputTimeCls}
                  />
                  a
                  <input
                    type="time"
                    value={dia.cierra}
                    onChange={(e) => cambiar(dow, { cierra: e.target.value })}
                    aria-label={`Hora de cierre del ${etiqueta.toLowerCase()}`}
                    className={inputTimeCls}
                  />
                </span>
              ) : (
                <span className="text-[12.5px] text-zinc-500">
                  Ese día no se toman citas.
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}
      {guardado && (
        <p className="rounded-xl bg-aventurea-green/10 p-3 text-[13px] font-bold text-aventurea-green">
          ✓ Horario guardado.
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="rounded-xl bg-aventurea-sky px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar horario"}
        </button>
      </div>
    </div>
  );
}
