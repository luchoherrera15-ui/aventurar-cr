"use client";

import { useState } from "react";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import DaySlider from "./day-slider";
import AgendaPorProfesional from "./agenda-por-profesional";
import ResumenesCitas from "./resumenes-citas";
import HorariosNegocioForm from "./horarios-negocio-form";
import AgendaCitas, { type CitaDia } from "./agenda-citas";
import type { MiembroEquipo, HorarioNegocioDia } from "./actions";

type Tab = "agenda" | "resumenes" | "clientes" | "finanzas" | "configuracion";

interface CitasTabsProps {
  ranchoId: string;
  zona: string;
  equipo: Array<{
    id: string;
    nombre: string;
    tipo?: string;
    activo: boolean;
    fotoUrl: string | null;
  }>;
  servicios: Array<{
    id: string;
    nombre: string;
    duracionMinutos: number | null;
    precio: number | null;
  }>;
  horario: Record<string, { abre: string; cierra: string }>;
  initialFecha: string;
  initialCitas: CitaDia[];
  initialBloqueos: Array<{
    id: string;
    rancho_id: string;
    miembro_id: string | null;
    inicio: string;
    fin: string;
    motivo: string | null;
  }>;
  initialHorariosNegocio?: HorarioNegocioDia[];
}

const TAB_LABELS: Record<Tab, string> = {
  agenda: "Agenda",
  resumenes: "Resúmenes",
  clientes: "Clientes",
  finanzas: "Finanzas",
  configuracion: "Configuración",
};

export default function CitasTabs({
  ranchoId,
  zona,
  equipo,
  servicios,
  horario,
  initialFecha,
  initialCitas,
  initialBloqueos,
  initialHorariosNegocio = [],
}: CitasTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("agenda");
  const [fechaSeleccionada, setFechaSeleccionada] = useState(initialFecha);

  // Para la vista por profesional, necesitamos filtrar citas por fecha
  const citasFecha = initialCitas.filter(
    (c) => c.hora_inicio.slice(0, 10) === fechaSeleccionada,
  );

  // Obtener hora de cierre del negocio
  const hoy = new Date(fechaSeleccionada);
  const dow = hoy.getDay();
  const diasSemana = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const diaStr = diasSemana[dow === 0 ? 6 : dow - 1];
  const horarioHoy = horario[diaStr];
  const horaCierreParts = horarioHoy?.cierra?.split(":") || ["20", "00"];
  const minutosCierre = parseInt(horaCierreParts[0]) * 60 + parseInt(horaCierraParts[1] || "0");

  return (
    <div>
      {/* Tabs de navegación */}
      <div className="mb-6 flex gap-2 border-b border-aventurea-line">
        {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-bold transition-colors ${
              activeTab === tab
                ? "border-b-2 border-aventurea-orange text-aventurea-orange"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Contenido de tabs */}
      {activeTab === "agenda" && (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-[12px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Selecciona un día
            </label>
            <DaySlider
              fechaSeleccionada={fechaSeleccionada}
              onFechaChange={setFechaSeleccionada}
            />
          </div>

          <div>
            <h3 className="mb-3 text-[14px] font-bold text-aventurea-ink">
              Agenda por profesional
            </h3>
            <AgendaPorProfesional
              citas={citasFecha}
              profesionales={equipo.map((m) => ({
                id: m.id,
                nombre: m.nombre,
                foto: m.fotoUrl || undefined,
              }))}
              horaInicio={360} // 06:00
              horaFin={minutosCierre}
              onSelectCita={(cita) => {
                console.log("Cita seleccionada:", cita);
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "resumenes" && (
        <ResumenesCitas
          citas={initialCitas}
          miembros={equipo.map((m) => ({ id: m.id, nombre: m.nombre }))}
        />
      )}

      {activeTab === "clientes" && (
        <div className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-5 text-center text-aventurea-ink-soft">
          <p>Panel de clientes - próximamente</p>
        </div>
      )}

      {activeTab === "finanzas" && (
        <div className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-5 text-center text-aventurea-ink-soft">
          <p>Panel de finanzas - próximamente</p>
        </div>
      )}

      {activeTab === "configuracion" && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 text-[14px] font-bold text-aventurea-ink">
              Horarios y precios por día
            </h3>
            <p className="mb-4 text-[13px] text-aventurea-ink-soft">
              Configura horarios y precios diferentes para cada día de la semana.
            </p>
            <HorariosNegocioForm
              ranchoId={ranchoId}
              initialHorarios={initialHorariosNegocio}
            />
          </div>
        </div>
      )}
    </div>
  );
}
