"use client";

import { sumarDiasISO, hoyISOCR } from "@/lib/fechas";

interface DaySliderProps {
  fechaSeleccionada: string;
  onFechaChange: (fecha: string) => void;
}

export default function DaySlider({ fechaSeleccionada, onFechaChange }: DaySliderProps) {
  const hoy = hoyISOCR();
  const dias = Array.from({ length: 14 }, (_, i) => sumarDiasISO(hoy, i));

  const obtenerEtiqueta = (fecha: string, idx: number) => {
    if (idx === 0) return "Hoy";
    if (idx === 1) return "Mañana";
    const [_, m, d] = fecha.split("-").map(Number);
    return `${d}`;
  };

  const obtenerDia = (fecha: string) => {
    const diasNombre = ["D", "L", "M", "M", "J", "V", "S"];
    const date = new Date(fecha);
    return diasNombre[date.getDay()];
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dias.map((fecha, idx) => (
        <button
          key={fecha}
          onClick={() => onFechaChange(fecha)}
          className={`shrink-0 rounded-xl px-3 py-2 text-center font-bold transition-all ${
            fechaSeleccionada === fecha
              ? "bg-aventurea-sky text-white"
              : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink hover:border-aventurea-sky"
          }`}
        >
          <div className="text-[11px]">{obtenerDia(fecha)}</div>
          <div className="text-[12px]">{obtenerEtiqueta(fecha, idx)}</div>
        </button>
      ))}
    </div>
  );
}
