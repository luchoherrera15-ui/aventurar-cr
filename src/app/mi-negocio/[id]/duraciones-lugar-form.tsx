"use client";

import { useState, useTransition } from "react";
import { guardarDuracionesPorDia, type DuracionPorDia } from "./duraciones-lugar-actions";

const GRUPOS_DIA = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes / Sábado / Domingo" },
];

type DiaBorrador = {
  dowGrupo: 1 | 2 | 3 | 4 | 5;
  duracionMaximaHoras: string;
};

function estadoInicial(duraciones: DuracionPorDia[]): DiaBorrador[] {
  const mapaExistente = new Map(duraciones.map((d) => [d.dowGrupo, d]));

  return GRUPOS_DIA.map((grupo) => {
    const existente = mapaExistente.get(grupo.id as 1 | 2 | 3 | 4 | 5);
    return {
      dowGrupo: grupo.id as 1 | 2 | 3 | 4 | 5,
      duracionMaximaHoras: existente ? String(existente.duracionMaximaHoras) : "24",
    };
  });
}

export default function DuracionesLugarForm({
  ranchoId,
  initialDuraciones = [],
}: {
  ranchoId: string;
  initialDuraciones?: DuracionPorDia[];
}) {
  const [dias, setDias] = useState<DiaBorrador[]>(() => estadoInicial(initialDuraciones));
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cambiar(dowGrupo: 1 | 2 | 3 | 4 | 5, cambio: Partial<DiaBorrador>) {
    setDias((prev) => prev.map((d) => (d.dowGrupo === dowGrupo ? { ...d, ...cambio } : d)));
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      // Validar datos en cliente antes de enviar
      for (const dia of dias) {
        const valor = Number(dia.duracionMaximaHoras);
        if (!Number.isFinite(valor) || valor <= 0) {
          setError(`La duración para ${GRUPOS_DIA.find(g => g.id === dia.dowGrupo)?.label} debe ser mayor a 0.`);
          return;
        }
        if (valor > 24) {
          setError(`La duración para ${GRUPOS_DIA.find(g => g.id === dia.dowGrupo)?.label} no puede exceder 24 horas.`);
          return;
        }
      }

      const duraciones: DuracionPorDia[] = dias.map((d) => ({
        dowGrupo: d.dowGrupo,
        duracionMaximaHoras: Number(d.duracionMaximaHoras),
      }));

      const res = await guardarDuracionesPorDia(ranchoId, duraciones);
      if (res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
        Define la duración máxima de alquiler para cada día de la semana. Los clientes podrán
        agregar horas adicionales a ₡20.000 cada una.
      </p>

      <div className="space-y-3">
        {dias.map((dia) => {
          const grupo = GRUPOS_DIA.find(g => g.id === dia.dowGrupo);
          return (
            <div
              key={dia.dowGrupo}
              className="rounded-xl border border-aventurea-line bg-aventurea-surface p-4"
            >
              <label className="mb-3 block text-[13px] font-bold text-aventurea-ink">
                {grupo?.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={dia.duracionMaximaHoras}
                  onChange={(e) => cambiar(dia.dowGrupo, { duracionMaximaHoras: e.target.value })}
                  placeholder="24"
                  min="1"
                  max="24"
                  step="0.5"
                  className="flex-1 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[13.5px] text-aventurea-ink"
                />
                <span className="text-[13px] text-aventurea-ink-soft">horas</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}
      {guardado && (
        <p className="rounded-xl bg-aventurea-green/10 p-3 text-[13px] font-bold text-aventurea-green">
          ✓ Duraciones máximas guardadas.
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar duraciones"}
      </button>
    </div>
  );
}
