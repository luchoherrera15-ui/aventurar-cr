"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { etiquetaMinutos, horaBonita } from "@/app/citas/tipos";
import { hoyISOCR } from "@/lib/fechas";

const inputCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink";

/** Una cita del día tal como se lee de reservas (solo lo que se muestra). */
export type CitaDia = {
  id: string;
  hora_inicio: string;
  duracion_minutos: number | null;
  miembro_id: string | null;
  nombre: string | null;
  tipo_evento: string | null;
  estado: "pendiente" | "confirmada" | "rechazada" | "bloqueada";
};

const ESTADO_LABEL: Record<CitaDia["estado"], string> = {
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  rechazada: "Cancelada",
  bloqueada: "Bloqueada",
};

const ESTADO_BADGE: Record<CitaDia["estado"], string> = {
  confirmada: "bg-aventurea-green/15 text-aventurea-green",
  pendiente: "bg-aventurea-orange/15 text-aventurea-orange",
  rechazada: "bg-red-50 text-red-700",
  bloqueada: "bg-aventurea-cream-2 text-zinc-500",
};

/**
 * La agenda del día del negocio de citas: elegí una fecha y ves las
 * citas en orden, con hora, servicio, cliente y con quién. La primera
 * carga viene del servidor (hoy); al cambiar la fecha se consulta
 * directo desde el navegador — las políticas de la base ya limitan la
 * lectura al dueño del negocio.
 */
export default function AgendaCitas({
  ranchoId,
  equipo,
  initialFecha,
  initialCitas,
}: {
  ranchoId: string;
  equipo: { id: string; nombre: string }[];
  initialFecha: string;
  initialCitas: CitaDia[];
}) {
  const [fecha, setFecha] = useState(initialFecha);
  const [citas, setCitas] = useState<CitaDia[]>(initialCitas);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si el dueño cambia la fecha rápido, solo interesa la última consulta.
  const ultimaFecha = useRef(initialFecha);

  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));

  async function cargar(nueva: string) {
    setFecha(nueva);
    ultimaFecha.current = nueva;
    if (!nueva) return;
    setCargando(true);
    setError(null);

    const supabase = createClient();
    const { data, error: errorCarga } = await supabase
      .from("reservas")
      .select("id, hora_inicio, duracion_minutos, miembro_id, nombre, tipo_evento, estado")
      .eq("rancho_id", ranchoId)
      .eq("fecha", nueva)
      .not("hora_inicio", "is", null)
      .neq("estado", "temporal")
      .order("hora_inicio", { ascending: true });

    if (ultimaFecha.current !== nueva) return;
    setCargando(false);
    if (errorCarga) {
      setError("No se pudieron cargar las citas: " + errorCarga.message);
      return;
    }
    setCitas((data ?? []) as CitaDia[]);
  }

  const esHoy = fecha === hoyISOCR();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={fecha}
          onChange={(e) => cargar(e.target.value)}
          aria-label="Fecha de la agenda"
          className={inputCls}
        />
        {!esHoy && (
          <button
            type="button"
            onClick={() => cargar(hoyISOCR())}
            className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Volver a hoy
          </button>
        )}
        <span className="text-[13px] text-aventurea-ink-soft">
          {cargando
            ? "Cargando..."
            : `${citas.length} cita${citas.length === 1 ? "" : "s"}${esHoy ? " hoy" : ""}`}
        </span>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}

      {!cargando && citas.length === 0 && !error && (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
          {esHoy
            ? "Hoy no tenés citas agendadas."
            : "Ese día no hay citas agendadas."}
        </p>
      )}

      {citas.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {citas.map((cita) => (
            <div
              key={cita.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-aventurea-line px-4 py-3 last:border-none"
            >
              <div className="w-[92px] shrink-0">
                <p className="text-[14px] font-bold text-aventurea-ink">
                  {horaBonita(cita.hora_inicio.slice(0, 5))}
                </p>
                <p className="text-[11.5px] text-zinc-500">
                  {etiquetaMinutos(cita.duracion_minutos ?? 30)}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-aventurea-ink">
                  {cita.tipo_evento ?? "Servicio"}
                </p>
                <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                  {cita.nombre ?? "Cliente"}
                  {cita.miembro_id && (
                    <>
                      {" "}
                      · con{" "}
                      <span className="font-bold text-aventurea-navy">
                        {nombreMiembro.get(cita.miembro_id) ?? "alguien que ya no está en el equipo"}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-bold ${ESTADO_BADGE[cita.estado]}`}
              >
                {ESTADO_LABEL[cita.estado]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
