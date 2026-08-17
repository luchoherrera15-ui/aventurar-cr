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
import { Card, CardVacia } from "@/components/panel/piezas";
import {
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  DETALLE,
  ESTADO_AVISO,
  RADIO_TILE,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
  TITULO_CARD,
} from "@/components/panel/sistema";
import { ACCIONES_FILA, BOTON_FILA_PELIGRO, FilaFicha, LISTA_FICHAS } from "../fila-ficha";

const inputCls = CAMPO_PANEL;
const labelCls = `mb-1.5 block ${ROTULO_CAMPO}`;

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

  const ordenados = bloqueos.slice().sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <Card
      eyebrow="Vacaciones y ausencias"
      titulo="Cuándo NO se puede reservar"
      accion={
        ordenados.length > 0 ? (
          <span className={DETALLE}>
            {ordenados.length} bloqueo{ordenados.length === 1 ? "" : "s"} vigente
            {ordenados.length === 1 ? "" : "s"}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* Un bloqueo es una ficha administrable: la barrita NEUTRA de
            la izquierda es la misma que lleva en la grilla de la agenda
            del día, así el dueño reconoce lo mismo en las dos pantallas. */}
        {ordenados.length === 0 ? (
          <CardVacia>
            No tenés días ni horas bloqueadas. Agregá acá las vacaciones, un feriado o
            la tarde que cerrás: nadie va a poder reservar dentro de ese rango.
          </CardVacia>
        ) : (
          <div className={LISTA_FICHAS}>
            {ordenados.map((b, idx) => (
              <FilaFicha
                key={b.id}
                separador={idx < ordenados.length - 1}
                marca="neutro"
                titulo={
                  b.miembro_id
                    ? (nombreMiembro.get(b.miembro_id) ?? "Alguien que ya no está")
                    : "Todo el negocio"
                }
                detalle={
                  <span>
                    {etiqueta(b)}
                    {b.motivo ? ` · ${b.motivo}` : ""}
                  </span>
                }
                acciones={
                  <div className={ACCIONES_FILA}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => quitar(b.id)}
                      className={BOTON_FILA_PELIGRO}
                    >
                      Quitar
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}

        <div className={`flex flex-col gap-3.5 ${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-4`}>
          <h3 className={TITULO_CARD}>Bloquear días u horas</h3>
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
              className={inputCls}
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
            className={BOTON_PANEL_PRIMARIO}
          >
            Bloquear
          </button>
          </div>
        </div>

        {error && (
          <p className={`${RADIO_TILE} p-3 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
