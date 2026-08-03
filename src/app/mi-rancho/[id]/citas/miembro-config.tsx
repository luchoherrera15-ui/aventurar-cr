"use client";

import { useState, useTransition } from "react";
import { DIAS_SEMANA_LABEL, esDiaLibre } from "@/app/citas/tipos";
import {
  guardarHorarioMiembro,
  guardarServiciosMiembro,
  type RangoHorarioMiembro,
} from "./actions";

const inputTimeCls =
  "rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-2 text-[13px] text-aventurea-ink";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

type Turno = { abre: string; cierra: string };
type DiaBorrador = { abierto: boolean; turnos: Turno[] };

export type ServicioCita = { id: string; nombre: string };
export type Asignacion = { item_id: string; miembro_id: string };

function estadoInicial(rangos: RangoHorarioMiembro[]): DiaBorrador[] {
  return Array.from({ length: 7 }, (_, dow) => {
    const delDia = rangos
      .filter((r) => r.dow === dow)
      .sort((a, b) => a.abre.localeCompare(b.abre))
      .map((r) => ({ abre: r.abre.slice(0, 5), cierra: r.cierra.slice(0, 5) }));
    // El rango centinela (00:00–00:01) significa "ese día no trabaja"
    // — no es un turno de verdad y no se muestra como tal.
    if (delDia.length > 0 && !esDiaLibre(delDia)) {
      return { abierto: true, turnos: delDia };
    }
    return { abierto: false, turnos: [{ abre: "09:00", cierra: "18:00" }] };
  });
}

/**
 * La configuración fina de una persona del equipo: su horario propio
 * (sustituye al del negocio — el motor de disponibilidad y el RPC ya
 * lo respetan desde la 0061) y qué servicios da (servicios_recurso).
 */
export default function MiembroConfig({
  ranchoId,
  miembroId,
  horarioInicial,
  serviciosCita,
  asignaciones,
}: {
  ranchoId: string;
  miembroId: string;
  horarioInicial: RangoHorarioMiembro[];
  serviciosCita: ServicioCita[];
  asignaciones: Asignacion[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<"horario" | "servicios" | null>(null);

  // --- Horario propio ---
  const [horarioPropio, setHorarioPropio] = useState(horarioInicial.length > 0);
  const [dias, setDias] = useState<DiaBorrador[]>(() => estadoInicial(horarioInicial));

  // --- Servicios ---
  // Un servicio sin filas lo dan todos; con filas, solo los listados.
  const restringidos = new Set(asignaciones.map((a) => a.item_id));
  const propios = new Set(
    asignaciones.filter((a) => a.miembro_id === miembroId).map((a) => a.item_id),
  );
  const [marcados, setMarcados] = useState<Set<string>>(
    () =>
      new Set(
        serviciosCita
          .filter((s) => !restringidos.has(s.id) || propios.has(s.id))
          .map((s) => s.id),
      ),
  );

  function cambiarDia(dow: number, cambio: Partial<DiaBorrador>) {
    setDias((prev) => prev.map((d, i) => (i === dow ? { ...d, ...cambio } : d)));
    setGuardado(null);
  }

  function cambiarTurno(dow: number, idx: number, cambio: Partial<Turno>) {
    setDias((prev) =>
      prev.map((d, i) =>
        i === dow
          ? { ...d, turnos: d.turnos.map((t, j) => (j === idx ? { ...t, ...cambio } : t)) }
          : d,
      ),
    );
    setGuardado(null);
  }

  function guardarHorario() {
    setError(null);
    setGuardado(null);
    startTransition(async () => {
      const rangos: RangoHorarioMiembro[] | null = horarioPropio
        ? dias.flatMap((d, dow) =>
            d.abierto ? d.turnos.map((t) => ({ dow, abre: t.abre, cierra: t.cierra })) : [],
          )
        : null;
      // Los días desmarcados van como "libres" explícitos: si no, esos
      // días heredarían el horario del negocio y la persona seguiría
      // apareciendo como reservable.
      const diasLibres = horarioPropio
        ? dias.flatMap((d, dow) => (d.abierto ? [] : [dow]))
        : [];
      const res = await guardarHorarioMiembro(ranchoId, miembroId, rangos, diasLibres);
      if (res.error) setError(res.error);
      else setGuardado("horario");
    });
  }

  function guardarServicios() {
    setError(null);
    setAviso(null);
    setGuardado(null);
    startTransition(async () => {
      const res = await guardarServiciosMiembro(ranchoId, miembroId, [...marcados]);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.advertencia) setAviso(res.advertencia);
      setGuardado("servicios");
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-aventurea-line bg-aventurea-cream-2/60 p-4">
      {/* ---------- Horario propio ---------- */}
      <div>
        <p className={labelCls}>Horario de esta persona</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setHorarioPropio(false);
              setGuardado(null);
            }}
            aria-pressed={!horarioPropio}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
              !horarioPropio
                ? "border-aventurea-navy bg-aventurea-navy text-white"
                : "border-aventurea-line bg-white text-aventurea-ink-soft"
            }`}
          >
            El del negocio
          </button>
          <button
            type="button"
            onClick={() => {
              setHorarioPropio(true);
              setGuardado(null);
            }}
            aria-pressed={horarioPropio}
            className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
              horarioPropio
                ? "border-aventurea-navy bg-aventurea-navy text-white"
                : "border-aventurea-line bg-white text-aventurea-ink-soft"
            }`}
          >
            Horario propio
          </button>
        </div>

        {horarioPropio && (
          <div className="mt-3 overflow-hidden rounded-xl border border-aventurea-line bg-white">
            {DIAS_SEMANA_LABEL.map((etiqueta, dow) => {
              const dia = dias[dow];
              return (
                <div
                  key={etiqueta}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-aventurea-line px-3 py-2.5 last:border-none"
                >
                  <span className="w-[80px] text-[13px] font-bold text-aventurea-ink">
                    {etiqueta}
                  </span>
                  <button
                    type="button"
                    onClick={() => cambiarDia(dow, { abierto: !dia.abierto })}
                    aria-pressed={dia.abierto}
                    className={`w-[82px] rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
                      dia.abierto
                        ? "border-aventurea-green bg-aventurea-green/10 text-aventurea-green"
                        : "border-aventurea-line bg-aventurea-cream-2 text-zinc-500"
                    }`}
                  >
                    {dia.abierto ? "Trabaja" : "Libre"}
                  </button>
                  {dia.abierto && (
                    <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-aventurea-ink-soft">
                      {dia.turnos.map((t, idx) => (
                        <span key={idx} className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {idx > 0 && <span className="text-zinc-400">y</span>}
                          <input
                            type="time"
                            value={t.abre}
                            onChange={(e) => cambiarTurno(dow, idx, { abre: e.target.value })}
                            aria-label={`Entrada del ${etiqueta.toLowerCase()}`}
                            className={inputTimeCls}
                          />
                          a
                          <input
                            type="time"
                            value={t.cierra}
                            onChange={(e) => cambiarTurno(dow, idx, { cierra: e.target.value })}
                            aria-label={`Salida del ${etiqueta.toLowerCase()}`}
                            className={inputTimeCls}
                          />
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                cambiarDia(dow, { turnos: dia.turnos.slice(0, idx) })
                              }
                              aria-label="Quitar segundo turno"
                              className="font-bold text-red-700"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                      {dia.turnos.length < 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            cambiarDia(dow, {
                              turnos: [...dia.turnos, { abre: "14:00", cierra: "18:00" }],
                            })
                          }
                          className="text-[11.5px] font-bold text-aventurea-navy underline"
                        >
                          + turno partido
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={guardarHorario}
          disabled={pending}
          className="mt-3 rounded-xl bg-aventurea-orange px-4 py-2 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar horario"}
        </button>
        {guardado === "horario" && (
          <span className="ml-3 text-[12.5px] font-bold text-aventurea-green">✓ Guardado</span>
        )}
      </div>

      {/* ---------- Servicios que da ---------- */}
      {serviciosCita.length > 0 && (
        <div>
          <p className={labelCls}>Servicios que da</p>
          <div className="flex flex-wrap gap-2">
            {serviciosCita.map((s) => {
              const activo = marcados.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const nuevo = new Set(marcados);
                    if (activo) nuevo.delete(s.id);
                    else nuevo.add(s.id);
                    setMarcados(nuevo);
                    setGuardado(null);
                  }}
                  aria-pressed={activo}
                  className={`max-w-full break-words rounded-lg border px-3 py-1.5 text-[12.5px] font-bold ${
                    activo
                      ? "border-aventurea-navy bg-aventurea-navy text-white"
                      : "border-aventurea-line bg-white text-aventurea-ink-soft"
                  }`}
                >
                  {s.nombre}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={guardarServicios}
            disabled={pending}
            className="mt-3 rounded-xl bg-aventurea-orange px-4 py-2 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar servicios"}
          </button>
          {guardado === "servicios" && (
            <span className="ml-3 text-[12.5px] font-bold text-aventurea-green">✓ Guardado</span>
          )}
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}
      {aviso && (
        <p className="rounded-xl bg-aventurea-orange-light p-3 text-[13px] text-aventurea-ink">
          {aviso}
        </p>
      )}
    </div>
  );
}
