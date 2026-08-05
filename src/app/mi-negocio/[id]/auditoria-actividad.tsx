"use client";

import { useState } from "react";
import type { Reserva } from "@/app/admin/(dashboard)/eventos/types";

const MOSTRAR_INICIAL = 5;

const ACCION_LABEL: Record<string, { accion: string; icono: string; color: string }> = {
  pendiente: { accion: "Se reservó", icono: "📋", color: "text-aventurea-orange" },
  confirmada: { accion: "Se confirmó", icono: "✓", color: "text-aventurea-green" },
  cancelada: { accion: "Se canceló", icono: "✕", color: "text-red-600" },
  bloqueada: { accion: "Se bloqueó", icono: "🔒", color: "text-zinc-500" },
};

function fmtColones(n: number | null) {
  if (n === null) return "—";
  return "₡" + Number(n).toLocaleString("es-CR");
}

function fmtFecha(iso: string) {
  const date = new Date(iso + "T00:00:00");
  return date.toLocaleDateString("es-CR", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtHora(iso: string | null | undefined) {
  if (!iso) return "";
  const [hora, minuto] = iso.split(":").slice(0, 2);
  return `${hora}:${minuto}`;
}

interface EventoAuditoria {
  id: string;
  nombre: string | null;
  fecha: string;
  hora_inicio?: string | null;
  estado: string;
  monto_total: number | null;
  created_at?: string;
}

export default function AuditoriaActividad({ reservas }: { reservas: Reserva[] }) {
  const [expandido, setExpandido] = useState(false);

  // Generar eventos de auditoría ordenados por fecha más reciente
  const eventos: EventoAuditoria[] = reservas
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      fecha: r.fecha,
      hora_inicio: r.hora_inicio,
      estado: r.estado,
      monto_total: r.monto_total,
      created_at: r.created_at,
    }))
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const mostrados = expandido ? eventos : eventos.slice(0, MOSTRAR_INICIAL);
  const hayMas = eventos.length > MOSTRAR_INICIAL;

  if (eventos.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
        No hay actividad registrada aún.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-aventurea-line overflow-hidden">
        <div className="divide-y divide-aventurea-line">
          {mostrados.map((evento) => {
            const accion = ACCION_LABEL[evento.estado] || {
              accion: evento.estado,
              icono: "•",
              color: "text-aventurea-ink-soft",
            };
            const fecha = fmtFecha(evento.fecha);
            const hora = fmtHora(evento.hora_inicio);

            return (
              <div key={evento.id} className="bg-aventurea-surface px-4 py-3.5 sm:px-5">
                <div className="flex items-start gap-3">
                  <span className={`text-lg shrink-0 ${accion.color}`}>{accion.icono}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2 gap-y-1">
                      <p className="font-bold text-aventurea-ink text-[14px]">
                        {evento.nombre}
                      </p>
                      <span className={`text-[12px] font-semibold ${accion.color}`}>
                        {accion.accion}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-aventurea-ink-soft">
                      <span>
                        <span className="font-semibold text-aventurea-ink">{fecha}</span>
                        {hora && <span> a las {hora}hs</span>}
                      </span>
                      {evento.monto_total !== null && (
                        <span>
                          Monto: <span className="font-semibold text-aventurea-ink">{fmtColones(evento.monto_total)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hayMas && (
        <button
          onClick={() => setExpandido(!expandido)}
          className="rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2.5 text-[13px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
        >
          {expandido ? "Ver menos" : `Ver más (${eventos.length - MOSTRAR_INICIAL})`}
        </button>
      )}
    </div>
  );
}
