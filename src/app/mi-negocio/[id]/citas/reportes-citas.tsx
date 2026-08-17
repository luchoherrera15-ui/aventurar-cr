"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtColones } from "@/lib/finanzas";
import { hoyISOCR, sumarDiasISO } from "@/lib/fechas";
import { reporteCitas, type CitaReporte, type ReporteCitas } from "@/lib/metricas-citas";
import type { Vocabulario } from "@/lib/business/identidad";

/**
 * Los números del negocio de citas: cuántas citas, quién las atendió,
 * la tasa de no-shows, los servicios más pedidos y las horas pico.
 * Todo derivado de las reservas (lib metricas-citas, probada sin
 * React); las barras van a mano en divs, como el gráfico de Finanzas.
 *
 * Las palabras y el color los pone el tipo de negocio: el mismo reporte
 * cuenta CONSULTAS en un consultorio y SESIONES en un gimnasio.
 */

type Rango = "30" | "90" | "365";

const RANGO_LABEL: Record<Rango, string> = {
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  "365": "Último año",
};

export default function ReportesCitas({
  ranchoId,
  equipo,
  vocabulario,
}: {
  ranchoId: string;
  equipo: { id: string; nombre: string }[];
  vocabulario: Vocabulario;
}) {
  const { visita } = vocabulario;
  const [rango, setRango] = useState<Rango>("30");
  const [reporte, setReporte] = useState<ReporteCitas | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));

  useEffect(() => {
    let vigente = true;
    const hoy = hoyISOCR();
    const desde = sumarDiasISO(hoy, -Number(rango));
    const supabase = createClient();
    supabase
      .from("reservas")
      .select("fecha, hora_inicio, estado, miembro_id, monto_total, tipo_evento")
      .eq("rancho_id", ranchoId)
      .gte("fecha", desde)
      .lte("fecha", hoy)
      .not("hora_inicio", "is", null)
      .limit(5000)
      .then(({ data, error: errorCarga }) => {
        if (!vigente) return;
        if (errorCarga) {
          setError("No se pudieron cargar los números: " + errorCarga.message);
          return;
        }
        setError(null);
        setReporte(reporteCitas((data ?? []) as CitaReporte[], hoy));
      });
    return () => {
      vigente = false;
    };
  }, [ranchoId, rango]);

  const stat = (etiqueta: string, valor: string, alerta?: boolean) => (
    <div
      className={`min-w-[140px] flex-1 rounded-2xl border px-5 py-3.5 sm:flex-none ${
        alerta ? "border-red-300 bg-red-50" : "border-aventurea-line bg-white"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {etiqueta}
      </p>
      <p
        className={`text-[18px] font-extrabold tabular-nums ${alerta ? "text-red-700" : "text-aventurea-ink"}`}
      >
        {valor}
      </p>
    </div>
  );

  const maxHora = Math.max(1, ...(reporte?.horasPico.map((h) => h.veces) ?? [1]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGO_LABEL) as Rango[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRango(r)}
            aria-pressed={rango === r}
            // El rango activo lleva el acento del tipo de negocio.
            style={
              rango === r
                ? {
                    backgroundColor: "var(--acento-solido)",
                    borderColor: "var(--acento-solido)",
                    color: "var(--acento-sobre)",
                  }
                : undefined
            }
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
              rango === r
                ? ""
                : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-sky"
            }`}
          >
            {RANGO_LABEL[r]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}

      {!reporte ? (
        <p className="text-[13px] text-aventurea-ink-soft">Cargando...</p>
      ) : reporte.total === 0 ? (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
          Sin {visita.plural} en ese rango todavía.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            {stat(visita.Plural, String(reporte.total))}
            {stat("Atendidas", String(reporte.cumplidas))}
            {stat(
              "No-shows",
              reporte.tasaNoShow === null
                ? String(reporte.noShows)
                : `${reporte.noShows} (${Math.round(reporte.tasaNoShow * 100)}%)`,
              reporte.tasaNoShow !== null && reporte.tasaNoShow >= 0.15,
            )}
            {stat("Ingresos (atendidas)", fmtColones(reporte.ingresos))}
          </div>

          {reporte.sinMarcar > 0 && (
            <p className="rounded-xl bg-aventurea-sky-light p-3 text-[12.5px] text-aventurea-ink">
              {reporte.sinMarcar} {reporte.sinMarcar === 1 ? visita.singular : visita.plural} de
              días pasados sin marcar (¿vino o no vino?) — los números de asistencia
              quedan incompletos hasta marcarlas en la Agenda del día.
            </p>
          )}

          {reporte.porMiembro.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
              <p className="border-b border-aventurea-line px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                Por persona
              </p>
              {reporte.porMiembro.map((m) => (
                <div
                  key={m.miembroId ?? "sin"}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-aventurea-line px-4 py-2.5 last:border-none"
                >
                  <p className="min-w-0 flex-1 text-[13.5px] font-bold text-aventurea-ink">
                    {m.miembroId
                      ? (nombreMiembro.get(m.miembroId) ?? "Alguien que ya no está")
                      : "Sin asignar"}
                  </p>
                  <p className="text-[12.5px] tabular-nums text-aventurea-ink-soft">
                    {m.citas} {m.citas === 1 ? visita.singular : visita.plural}
                    {" · "}
                    {m.cumplidas} atendida{m.cumplidas === 1 ? "" : "s"}
                    {m.noShows > 0 && ` · ${m.noShows} no-show${m.noShows === 1 ? "" : "s"}`}
                  </p>
                  <p className="w-[90px] text-right text-[13px] font-extrabold tabular-nums text-aventurea-ink">
                    {fmtColones(m.ingresos)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reporte.topServicios.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
                <p className="border-b border-aventurea-line px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Servicios más pedidos
                </p>
                {reporte.topServicios.map((s) => (
                  <div
                    key={s.nombre}
                    className="flex items-center gap-3 border-b border-aventurea-line px-4 py-2.5 last:border-none"
                  >
                    <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-aventurea-ink">
                      {s.nombre}
                    </p>
                    <p className="text-[12.5px] tabular-nums text-aventurea-ink-soft">
                      {s.veces}×
                    </p>
                    <p className="w-[84px] text-right text-[12.5px] font-bold tabular-nums text-aventurea-ink">
                      {fmtColones(s.ingresos)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {reporte.horasPico.length > 0 && (
              <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-4">
                <p className="mb-3 text-[11.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Horas pico
                </p>
                <div className="flex flex-col gap-1.5">
                  {reporte.horasPico.map((h) => (
                    <div key={h.hora} className="flex items-center gap-2">
                      <span className="w-[42px] text-[11.5px] font-bold tabular-nums text-aventurea-ink-soft">
                        {String(h.hora).padStart(2, "0")}:00
                      </span>
                      <div className="h-[10px] flex-1 overflow-hidden rounded bg-aventurea-cream-2">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${Math.round((h.veces / maxHora) * 100)}%`,
                            backgroundColor: "var(--acento-solido)",
                          }}
                        />
                      </div>
                      <span className="w-[26px] text-right text-[11.5px] tabular-nums text-aventurea-ink-soft">
                        {h.veces}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
