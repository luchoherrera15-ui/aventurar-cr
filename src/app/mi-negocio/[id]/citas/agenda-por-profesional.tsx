"use client";

import { useState } from "react";
import { horaBonita, etiquetaMinutos } from "@/app/citas/tipos";
import type { CitaDia } from "./agenda-citas";

const ESTADO_BLOQUE: Record<CitaDia["estado"], string> = {
  confirmada: "border-aventurea-green/40 bg-aventurea-green/10",
  pendiente: "border-aventurea-orange/50 bg-aventurea-orange/10",
  rechazada: "border-red-200 bg-red-50 opacity-60",
  bloqueada: "border-aventurea-line bg-aventurea-cream-2",
  cumplida: "border-aventurea-navy/30 bg-aventurea-navy/10",
  no_asistio: "border-red-300 bg-red-50",
  cancelada: "border-red-200 bg-red-50 opacity-60",
};

interface Profesional {
  id: string;
  nombre: string;
  foto?: string;
}

interface AgendaPorProfesionalProps {
  citas: CitaDia[];
  profesionales: Profesional[];
  horaInicio?: number; // en minutos desde medianoche, default 360 (06:00)
  horaFin?: number; // en minutos desde medianoche, default 1200 (20:00)
  onSelectCita: (cita: CitaDia) => void;
}

function minutosDe(horaISO: string): number {
  const [h, m] = horaISO.split(":").map(Number);
  return h * 60 + (m || 0);
}

export default function AgendaPorProfesional({
  citas,
  profesionales,
  horaInicio = 360, // 06:00
  horaFin = 1200, // 20:00
  onSelectCita,
}: AgendaPorProfesionalProps) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set([profesionales[0]?.id]));

  const toggleProfesional = (id: string) => {
    const nuevos = new Set(expandidos);
    if (nuevos.has(id)) {
      nuevos.delete(id);
    } else {
      nuevos.add(id);
    }
    setExpandidos(nuevos);
  };

  const obtenerCitasProfesional = (miembroId: string | null) => {
    return citas.filter((c) => c.miembro_id === miembroId);
  };

  const alturaTotal = horaFin - horaInicio;

  return (
    <div className="space-y-3">
      {profesionales.map((prof) => {
        const citasProf = obtenerCitasProfesional(prof.id);
        const expanded = expandidos.has(prof.id);

        return (
          <div key={prof.id} className="rounded-xl border border-aventurea-line">
            {/* Header del profesional */}
            <button
              onClick={() => toggleProfesional(prof.id)}
              className="flex w-full items-center justify-between gap-3 bg-aventurea-cream-2 px-4 py-3 hover:bg-aventurea-cream-2/80"
            >
              <div className="flex items-center gap-3 min-w-0">
                {prof.foto && (
                  <img
                    src={prof.foto}
                    alt={prof.nombre}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                )}
                <p className="font-bold text-aventurea-ink">{prof.nombre}</p>
                <span className="text-[12px] text-aventurea-ink-soft">
                  {citasProf.length} cita{citasProf.length !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-[18px] text-aventurea-ink-soft">
                {expanded ? "−" : "+"}
              </span>
            </button>

            {/* Grilla de horarios */}
            {expanded && (
              <div className="border-t border-aventurea-line p-4">
                {/* Horas */}
                <div className="mb-3 grid gap-px pl-12">
                  {Array.from({ length: (horaFin - horaInicio) / 60 }, (_, i) => {
                    const minutos = horaInicio + i * 60;
                    const horas = Math.floor(minutos / 60);
                    const mins = minutos % 60;
                    const horaStr = `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
                    return (
                      <div
                        key={horaStr}
                        className="text-[11px] font-bold text-aventurea-ink-soft"
                      >
                        {horaStr}
                      </div>
                    );
                  })}
                </div>

                {/* Citas en la grilla */}
                <div className="relative bg-aventurea-cream-2/30 rounded-lg overflow-hidden">
                  {citasProf.map((cita) => {
                    const ini = minutosDe(cita.hora_inicio.slice(0, 5));
                    const dur = cita.duracion_minutos ?? 30;
                    const topPx = ((ini - horaInicio) / alturaTotal) * 100;
                    const heightPx = (dur / alturaTotal) * 100;

                    if (ini < horaInicio || ini >= horaFin) return null;

                    return (
                      <button
                        key={cita.id}
                        onClick={() => onSelectCita(cita)}
                        className={`absolute left-1 right-1 p-2 rounded border text-left text-[11px] hover:ring-2 hover:ring-aventurea-orange ${
                          ESTADO_BLOQUE[cita.estado]
                        }`}
                        style={{
                          top: `${topPx}%`,
                          height: `${heightPx}%`,
                          minHeight: "32px",
                        }}
                        title={`${cita.hora_inicio.slice(0, 5)} - ${cita.nombre ?? "Cliente"}`}
                      >
                        <div className="font-bold">{cita.hora_inicio.slice(0, 5)}</div>
                        <div className="truncate text-[10px]">{cita.nombre ?? "Cliente"}</div>
                        {dur >= 40 && (
                          <div className="truncate text-[10px] opacity-75">
                            {cita.tipo_evento ?? ""}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
