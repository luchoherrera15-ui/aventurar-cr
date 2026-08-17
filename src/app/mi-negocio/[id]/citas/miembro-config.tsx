"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { DIAS_SEMANA_LABEL, esDiaLibre } from "@/app/citas/tipos";
import {
  ACCION_ACENTO,
  BOTON_PANEL_PRIMARIO,
  DETALLE,
  ESTADO_AVISO,
  ESTADO_PILDORA,
  ROTULO_CAMPO,
  SUPERFICIE_HUNDIDA,
} from "@/components/panel/sistema";
import { BOTON_FILA } from "../fila-ficha";
import {
  guardarHorarioMiembro,
  guardarServiciosMiembro,
  type RangoHorarioMiembro,
} from "./actions";

/** La hora de un turno. Es un campo, pero angosto: no tiene sentido que
 *  un `<input type="time">` ocupe el ancho de la fila. */
const CAMPO_HORA =
  "rounded-xl border border-aventurea-line bg-aventurea-surface px-2.5 py-1.5 text-[12.5px] text-aventurea-ink";

/** El botón que puede quedar "apretado": prendido toma el acento sólido
 *  del tipo de negocio (`sobreSolido` sobre `solido`, ≥5,18:1 en los
 *  ocho acentos del catálogo), apagado es el botón chico de siempre.
 *  Sin alfas: el mismo estado se ve igual sobre cualquier fondo. */
const BOTON_ELEGIDO =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-transparent px-2.5 text-[12px] font-bold";

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
 *
 * Se abre DENTRO de la fila de esa persona, así que es una superficie
 * hundida —un escalón por debajo de la tarjeta del equipo— y no otra
 * tarjeta: dos tarjetas anidadas se leen como dos bloques distintos y
 * esto es el detalle de uno solo.
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

  /** El botón que alterna entre dos opciones excluyentes. */
  const alterna = (elegido: boolean) => ({
    className: elegido ? BOTON_ELEGIDO : BOTON_FILA,
    style: elegido ? (ACCION_ACENTO as CSSProperties) : undefined,
  });

  return (
    <div className={`flex flex-col gap-5 rounded-2xl p-3.5 sm:p-4 ${SUPERFICIE_HUNDIDA}`}>
      {/* ---------- Horario propio ---------- */}
      <div>
        <p className={`mb-1.5 ${ROTULO_CAMPO}`}>Horario de esta persona</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setHorarioPropio(false);
              setGuardado(null);
            }}
            aria-pressed={!horarioPropio}
            {...alterna(!horarioPropio)}
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
            {...alterna(horarioPropio)}
          >
            Horario propio
          </button>
        </div>

        {horarioPropio && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
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
                  {/* Trabaja / Libre con los colores de estado del
                      sistema, no con un verde al 10 % sobre lo que
                      haya: verde #1f7a4d sobre #e1f0e6 = 4,51:1 y gris
                      #585858 sobre #f6f6f6 = 6,58:1, los dos AA. */}
                  <button
                    type="button"
                    onClick={() => cambiarDia(dow, { abierto: !dia.abierto })}
                    aria-pressed={dia.abierto}
                    className={`inline-flex h-8 w-[82px] items-center justify-center rounded-lg px-2.5 text-[12px] font-bold ${
                      dia.abierto ? ESTADO_PILDORA.exito : ESTADO_PILDORA.neutro
                    }`}
                  >
                    {dia.abierto ? "Trabaja" : "Libre"}
                  </button>
                  {dia.abierto && (
                    <span className={`flex flex-wrap items-center gap-2 ${DETALLE}`}>
                      {dia.turnos.map((t, idx) => (
                        <span key={idx} className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {idx > 0 && <span>y</span>}
                          <input
                            type="time"
                            value={t.abre}
                            onChange={(e) => cambiarTurno(dow, idx, { abre: e.target.value })}
                            aria-label={`Entrada del ${etiqueta.toLowerCase()}`}
                            className={CAMPO_HORA}
                          />
                          a
                          <input
                            type="time"
                            value={t.cierra}
                            onChange={(e) => cambiarTurno(dow, idx, { cierra: e.target.value })}
                            aria-label={`Salida del ${etiqueta.toLowerCase()}`}
                            className={CAMPO_HORA}
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
                          className="text-[12px] font-bold text-aventurea-navy underline"
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

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={guardarHorario}
            disabled={pending}
            className={BOTON_PANEL_PRIMARIO}
          >
            {pending ? "Guardando..." : "Guardar horario"}
          </button>
          {guardado === "horario" && (
            <span className="text-[12.5px] font-bold text-aventurea-green">✓ Guardado</span>
          )}
        </div>
      </div>

      {/* ---------- Servicios que da ---------- */}
      {serviciosCita.length > 0 && (
        <div>
          <p className={`mb-1.5 ${ROTULO_CAMPO}`}>Servicios que da</p>
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
                  style={activo ? (ACCION_ACENTO as CSSProperties) : undefined}
                  // Un nombre de servicio largo tiene que poder partirse
                  // en dos renglones en 390px: por eso el alto es
                  // mínimo, no fijo.
                  className={`h-auto min-h-8 max-w-full break-words py-1.5 ${
                    activo ? BOTON_ELEGIDO : BOTON_FILA
                  }`}
                >
                  {s.nombre}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={guardarServicios}
              disabled={pending}
              className={BOTON_PANEL_PRIMARIO}
            >
              {pending ? "Guardando..." : "Guardar servicios"}
            </button>
            {guardado === "servicios" && (
              <span className="text-[12.5px] font-bold text-aventurea-green">✓ Guardado</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.alerta}`}>
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className={`rounded-xl p-3 text-[13px] ${ESTADO_AVISO.info}`}>
          {aviso}
        </p>
      )}
    </div>
  );
}
