"use client";

import { useState } from "react";
import ResumenesCitas from "./resumenes-citas";
import AgendaCitas, { type CitaDia } from "./agenda-citas";
import type { HorarioSemana } from "@/app/citas/tipos";

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
  horario: HorarioSemana | null;
  horariosPorMiembro: Record<string, { dow: number; abre: string; cierra: string }[]>;
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
  horariosPorMiembro,
  initialFecha,
  initialCitas,
  initialBloqueos,
}: CitasTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("agenda");

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
                ? "border-b-2 border-aventurea-sky text-aventurea-orange"
                : "text-aventurea-ink-soft hover:text-aventurea-ink"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Contenido de tabs */}
      {activeTab === "agenda" && (
        <AgendaCitas
          ranchoId={ranchoId}
          zona={zona}
          equipo={equipo.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            tipo: m.tipo ?? "profesional",
            activo: m.activo,
            fotoUrl: m.fotoUrl,
          }))}
          servicios={servicios}
          horario={horario}
          horariosPorMiembro={horariosPorMiembro}
          initialFecha={initialFecha}
          initialCitas={initialCitas}
          initialBloqueos={initialBloqueos}
        />
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
        <div className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-5 text-center text-aventurea-ink-soft">
          <p>Configuración - próximamente</p>
        </div>
      )}
    </div>
  );
}
