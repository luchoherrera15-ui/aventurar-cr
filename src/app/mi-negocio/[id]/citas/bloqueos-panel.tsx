"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sumarDiasISO, hoyISOCR } from "@/lib/fechas";
import { instanteEnZona } from "@/lib/agenda/disponibilidad";
import { minutosAHora, horaBonita } from "@/app/citas/tipos";
import { fmtFechaCorta } from "@/lib/fechas";
import {
  crearBloqueoAgenda,
  eliminarBloqueoAgenda,
  type BloqueoAgenda,
} from "./actions";

const inputCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

/**
 * Vacaciones, ausencias y cierres largos (bloqueos_agenda, 0061): un
 * rango de fechas para el negocio entero o para una persona. Nadie
 * puede reservar dentro de un bloqueo — el motor y el RPC lo respetan
 * desde la 0081. Los bloqueos cortos del día a día (almuerzo) se
 * crean más rápido desde la Agenda del día.
 */
export default function BloqueosPanel({
  ranchoId,
  zona,
  equipo,
  initialBloqueos,
}: {
  ranchoId: string;
  zona: string;
  equipo: { id: string; nombre: string; activo: boolean }[];
  initialBloqueos: BloqueoAgenda[];
}) {
  const [bloqueos, setBloqueos] = useState(initialBloqueos);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const VACIO = {
    miembroId: "",
    fechaInicio: "",
    fechaFin: "",
    desde: "",
    hasta: "",
    diasEnteros: true,
    motivo: "",
  };
  const [borrador, setBorrador] = useState(VACIO);

  const nombreMiembro = new Map(equipo.map((m) => [m.id, m.nombre]));

  // Después de cada cambio la lista se relee de la base (y no se
  // parcha a mano): así este panel y la Agenda del día — que crean
  // bloqueos cada uno por su lado — nunca se quedan contando historias
  // distintas. El evento avisa al otro panel.
  async function refrescar() {
    const supabase = createClient();
    const { data } = await supabase
      .from("bloqueos_agenda")
      .select("id, rancho_id, miembro_id, inicio, fin, motivo")
      .eq("rancho_id", ranchoId)
      .gte("fin", `${sumarDiasISO(hoyISOCR(), -1)}T00:00:00-06:00`)
      .order("inicio", { ascending: true });
    if (data) setBloqueos(data as BloqueoAgenda[]);
  }

  useEffect(() => {
    const porEvento = (e: Event) => {
      if ((e as CustomEvent).detail === "panel") return;
      void refrescar();
    };
    window.addEventListener("bookea:bloqueos", porEvento);
    return () => window.removeEventListener("bookea:bloqueos", porEvento);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refrescar solo depende de ranchoId
  }, [ranchoId]);

  function etiqueta(b: BloqueoAgenda): string {
    const ini = instanteEnZona(b.inicio, zona);
    const fin = instanteEnZona(b.fin, zona);
    const diaEntero = ini.minutos === 0 && fin.minutos >= 23 * 60 + 59;
    if (ini.fecha === fin.fecha) {
      return diaEntero
        ? `${fmtFechaCorta(ini.fecha)} (todo el día)`
        : `${fmtFechaCorta(ini.fecha)} · ${horaBonita(minutosAHora(ini.minutos))} – ${horaBonita(minutosAHora(Math.min(fin.minutos, 1439)))}`;
    }
    return `${fmtFechaCorta(ini.fecha)} → ${fmtFechaCorta(fin.fecha)}`;
  }

  function crear() {
    setError(null);
    const fechaFin = borrador.fechaFin || borrador.fechaInicio;
    startTransition(async () => {
      const res = await crearBloqueoAgenda(ranchoId, {
        miembroId: borrador.miembroId || null,
        fechaInicio: borrador.fechaInicio,
        horaInicio: borrador.diasEnteros ? "00:00" : borrador.desde,
        fechaFin,
        horaFin: borrador.diasEnteros ? "23:59" : borrador.hasta,
        motivo: borrador.motivo,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setBorrador(VACIO);
      await refrescar();
      window.dispatchEvent(new CustomEvent("bookea:bloqueos", { detail: "panel" }));
    });
  }

  function quitar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarBloqueoAgenda(ranchoId, id);
      if (res.error) {
        setError(res.error);
        return;
      }
      await refrescar();
      window.dispatchEvent(new CustomEvent("bookea:bloqueos", { detail: "panel" }));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {bloqueos.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {bloqueos
            .slice()
            .sort((a, b) => a.inicio.localeCompare(b.inicio))
            .map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-aventurea-line px-4 py-3 last:border-none"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-aventurea-ink">
                    {b.miembro_id
                      ? (nombreMiembro.get(b.miembro_id) ?? "Alguien que ya no está")
                      : "Todo el negocio"}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                    {etiqueta(b)}
                    {b.motivo ? ` · ${b.motivo}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => quitar(b.id)}
                  className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-300 disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
        <h3 className="text-[15px] font-bold text-aventurea-ink">
          Bloquear días u horas
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          {equipo.filter((m) => m.activo).length > 0 && (
            <div className="min-w-0 max-w-full">
              <label className={labelCls}>Aplica a</label>
              <select
                value={borrador.miembroId}
                onChange={(e) => setBorrador({ ...borrador, miembroId: e.target.value })}
                className={`${inputCls} max-w-full`}
              >
                <option value="">Todo el negocio</option>
                {equipo
                  .filter((m) => m.activo)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      Solo {m.nombre}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Desde</label>
            <input
              type="date"
              value={borrador.fechaInicio}
              onChange={(e) => setBorrador({ ...borrador, fechaInicio: e.target.value })}
              className={`${inputCls} min-w-[150px]`}
            />
          </div>
          <div>
            <label className={labelCls}>Hasta (vacío = solo ese día)</label>
            <input
              type="date"
              value={borrador.fechaFin}
              onChange={(e) => setBorrador({ ...borrador, fechaFin: e.target.value })}
              className={`${inputCls} min-w-[150px]`}
            />
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-[13px] text-aventurea-ink">
            <input
              type="checkbox"
              checked={borrador.diasEnteros}
              onChange={(e) => setBorrador({ ...borrador, diasEnteros: e.target.checked })}
            />
            Días enteros
          </label>
          {!borrador.diasEnteros && (
            <>
              <div>
                <label className={labelCls}>De</label>
                <input
                  type="time"
                  value={borrador.desde}
                  onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
                  className={`${inputCls} min-w-[110px]`}
                />
              </div>
              <div>
                <label className={labelCls}>A</label>
                <input
                  type="time"
                  value={borrador.hasta}
                  onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
                  className={`${inputCls} min-w-[110px]`}
                />
              </div>
            </>
          )}
          <div className="min-w-[160px] flex-1">
            <label className={labelCls}>Motivo (solo lo ves vos)</label>
            <input
              type="text"
              value={borrador.motivo}
              onChange={(e) => setBorrador({ ...borrador, motivo: e.target.value })}
              placeholder="Ej. Vacaciones"
              className={`${inputCls} w-full`}
            />
          </div>
          <button
            type="button"
            disabled={
              pending ||
              !borrador.fechaInicio ||
              (!borrador.diasEnteros && (!borrador.desde || !borrador.hasta))
            }
            onClick={crear}
            className="h-[42px] rounded-xl bg-aventurea-navy px-5 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            Bloquear
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}
    </div>
  );
}
