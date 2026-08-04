"use client";

import { useState, useTransition } from "react";
import { guardarHorariosNegocio, type HorarioNegocioDia } from "./actions";

const DIAS_SEMANA = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const inputTimeCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13.5px] text-aventurea-ink";
const inputPreceCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13.5px] text-aventurea-ink";

type DiaBorrador = {
  dow: number;
  abierto: boolean;
  abre: string;
  cierra: string;
  precioEspecial: string;
  modalidad: "" | "rango_personas" | "hora" | "fijo";
  precioHora: string;
  precioFijo: string;
};

function estadoInicial(horarios: HorarioNegocioDia[]): DiaBorrador[] {
  return Array.from({ length: 7 }, (_, dow) => {
    const dia = horarios.find((h) => h.dow === dow);
    if (dia && (dia.abre || dia.cierra)) {
      return {
        dow,
        abierto: true,
        abre: dia.abre || "09:00",
        cierra: dia.cierra || "18:00",
        precioEspecial: dia.precioEspecial ? String(dia.precioEspecial) : "",
        modalidad: (dia.modalidad as any) || "",
        precioHora: dia.precioHora ? String(dia.precioHora) : "",
        precioFijo: dia.precioFijo ? String(dia.precioFijo) : "",
      };
    }
    return {
      dow,
      abierto: false,
      abre: "09:00",
      cierra: "18:00",
      precioEspecial: "",
      modalidad: "",
      precioHora: "",
      precioFijo: "",
    };
  });
}

export default function HorariosNegocioForm({
  ranchoId,
  initialHorarios = [],
}: {
  ranchoId: string;
  initialHorarios?: HorarioNegocioDia[];
}) {
  const [dias, setDias] = useState<DiaBorrador[]>(() => estadoInicial(initialHorarios));
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cambiar(dow: number, cambio: Partial<DiaBorrador>) {
    setDias((prev) => prev.map((d) => (d.dow === dow ? { ...d, ...cambio } : d)));
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const horarios: HorarioNegocioDia[] = dias
        .filter((d) => d.abierto)
        .map((d) => ({
          dow: d.dow,
          abre: d.abre,
          cierra: d.cierra,
          precioEspecial: d.precioEspecial ? Number(d.precioEspecial) : null,
          modalidad: d.modalidad || null,
          precioHora: d.precioHora ? Number(d.precioHora) : null,
          precioFijo: d.precioFijo ? Number(d.precioFijo) : null,
        }));

      const res = await guardarHorariosNegocio(ranchoId, horarios);
      if (res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
        Configurá horarios y precios diferentes para cada día de la semana. Por ejemplo, puedes
        tener horarios distintos o precios especiales para fin de semana.
      </p>

      <div className="space-y-4">
        {dias.map((dia) => (
          <div
            key={dia.dow}
            className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4"
          >
            {/* Encabezado: día y toggle abierto/cerrado */}
            <div className="mb-4 flex items-center justify-between">
              <span className="font-bold text-aventurea-ink">{DIAS_SEMANA[dia.dow]}</span>
              <button
                type="button"
                onClick={() => cambiar(dia.dow, { abierto: !dia.abierto })}
                aria-pressed={dia.abierto}
                className={`w-[86px] rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  dia.abierto
                    ? "border-aventurea-green bg-aventurea-green/10 text-aventurea-green"
                    : "border-aventurea-line bg-aventurea-cream-2 text-zinc-500"
                }`}
              >
                {dia.abierto ? "Abierto" : "Cerrado"}
              </button>
            </div>

            {dia.abierto && (
              <div className="space-y-4">
                {/* Horario */}
                <div>
                  <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Horario de atención
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={dia.abre}
                      onChange={(e) => cambiar(dia.dow, { abre: e.target.value })}
                      className={inputTimeCls}
                    />
                    <span className="text-aventurea-ink-soft">a</span>
                    <input
                      type="time"
                      value={dia.cierra}
                      onChange={(e) => cambiar(dia.dow, { cierra: e.target.value })}
                      className={inputTimeCls}
                    />
                  </div>
                </div>

                {/* Precio especial */}
                <div>
                  <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Precio especial (opcional)
                  </label>
                  <input
                    type="number"
                    value={dia.precioEspecial}
                    onChange={(e) => cambiar(dia.dow, { precioEspecial: e.target.value })}
                    placeholder="₡ 0"
                    min="0"
                    step="100"
                    className={inputPreceCls}
                  />
                  <p className="mt-1 text-[11px] text-aventurea-ink-soft">
                    Deja vacío para usar el precio base del catálogo.
                  </p>
                </div>

                {/* Modalidad de precio */}
                <div>
                  <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                    Modalidad de precio (opcional)
                  </label>
                  <select
                    value={dia.modalidad}
                    onChange={(e) =>
                      cambiar(dia.dow, { modalidad: e.target.value as any })
                    }
                    className="rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13.5px] text-aventurea-ink"
                  >
                    <option value="">Usar la modalidad base</option>
                    <option value="rango_personas">Rangos de personas</option>
                    <option value="hora">Precio por hora</option>
                    <option value="fijo">Precio fijo</option>
                  </select>
                </div>

                {/* Precio por hora */}
                {dia.modalidad === "hora" && (
                  <div>
                    <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                      Precio por hora
                    </label>
                    <input
                      type="number"
                      value={dia.precioHora}
                      onChange={(e) => cambiar(dia.dow, { precioHora: e.target.value })}
                      placeholder="₡ 0"
                      min="0"
                      step="100"
                      className={inputPreceCls}
                    />
                  </div>
                )}

                {/* Precio fijo */}
                {dia.modalidad === "fijo" && (
                  <div>
                    <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                      Precio fijo del evento
                    </label>
                    <input
                      type="number"
                      value={dia.precioFijo}
                      onChange={(e) => cambiar(dia.dow, { precioFijo: e.target.value })}
                      placeholder="₡ 0"
                      min="0"
                      step="100"
                      className={inputPreceCls}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}
      {guardado && (
        <p className="rounded-xl bg-aventurea-green/10 p-3 text-[13px] font-bold text-aventurea-green">
          ✓ Horarios guardados.
        </p>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={pending}
        className="rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar horarios"}
      </button>
    </div>
  );
}
