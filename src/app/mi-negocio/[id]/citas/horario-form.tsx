"use client";

import { useState, useTransition } from "react";
import { DIAS_SEMANA_LABEL, type HorarioSemana } from "@/app/citas/tipos";
import { guardarHorarioCitas } from "./actions";
import { Card, CardVacia } from "@/components/panel/piezas";
import {
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  CUERPO_SUAVE,
  DETALLE,
  ESTADO_AVISO,
  RADIO_PILDORA,
  RADIO_TILE,
} from "@/components/panel/sistema";
import { LISTA_FICHAS } from "../fila-ficha";

/** El campo de hora: el campo del panel, sin el `w-full` — en una fila
 *  de "de 9 a 6" cada input se mide por su contenido. */
const inputTimeCls = `${CAMPO_PANEL} w-auto px-2.5 py-2`;

/** El interruptor de un día. Abierto lleva el par de ÉXITO del sistema
 *  (verde #1f7a4d sobre #e1f0e6 = 4,51:1 ✅ AA) y cerrado el NEUTRO
 *  (gris #585858 sobre #f6f6f6 = 6,58:1 ✅). Antes el abierto era
 *  `bg-aventurea-green/10`, un alfa: el mismo estado se veía de dos
 *  colores según la fila sobre la que cayera. */
const diaBase = `w-[92px] shrink-0 border ${RADIO_PILDORA} px-3 py-1.5 text-[12.5px] font-bold transition-colors`;
const diaAbierto = `${diaBase} border-transparent bg-aventurea-green-light text-aventurea-green`;
const diaCerrado = `${diaBase} border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft`;

type DiaBorrador = { abierto: boolean; abre: string; cierra: string };

/**
 * El estado inicial del editor. Sin horario guardado se sugiere lunes
 * a sábado de 9 a 6 — el dueño lo ajusta y lo guarda; hasta entonces
 * las citas se aceptan a cualquier hora (así lo trata el RPC).
 */
function estadoInicial(horario: HorarioSemana | null): DiaBorrador[] {
  return Array.from({ length: 7 }, (_, dow) => {
    const dia = horario?.[String(dow)];
    if (dia) return { abierto: true, abre: dia.abre, cierra: dia.cierra };
    return {
      abierto: horario === null ? dow !== 0 : false,
      abre: "09:00",
      cierra: "18:00",
    };
  });
}

/**
 * El horario semanal del negocio de citas: qué días abre y de qué hora
 * a qué hora. Es lo que limita las horas que el cliente puede elegir
 * al reservar y lo que se muestra en la página pública.
 *
 * La forma es la del panel: una tarjeta con su kicker, la cuenta de
 * días abiertos a la derecha —que se calcula, no se escribe— y los
 * siete días como filas de una sola lista.
 */
export default function HorarioForm({
  ranchoId,
  initialHorario,
}: {
  ranchoId: string;
  initialHorario: HorarioSemana | null;
}) {
  const [dias, setDias] = useState<DiaBorrador[]>(() => estadoInicial(initialHorario));
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cambiar(dow: number, cambio: Partial<DiaBorrador>) {
    setDias((prev) => prev.map((d, i) => (i === dow ? { ...d, ...cambio } : d)));
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const horario: HorarioSemana = {};
      dias.forEach((d, dow) => {
        horario[String(dow)] = d.abierto ? { abre: d.abre, cierra: d.cierra } : null;
      });
      const res = await guardarHorarioCitas(ranchoId, horario);
      if (res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  const abiertos = dias.filter((d) => d.abierto).length;

  return (
    <Card
      eyebrow="Cuándo abrís"
      titulo="Horario semanal"
      accion={
        <span className={DETALLE}>
          {abiertos} día{abiertos === 1 ? "" : "s"} abierto{abiertos === 1 ? "" : "s"}
        </span>
      }
    >
      <div className="flex flex-col gap-3.5">
        {initialHorario === null && (
          <CardVacia>
            Todavía no guardaste tu horario: mientras tanto se aceptan citas a{" "}
            <strong>cualquier hora</strong>. Revisá la sugerencia de abajo, ajustala a tu
            realidad y guardala.
          </CardVacia>
        )}

        <div className={LISTA_FICHAS}>
          {DIAS_SEMANA_LABEL.map((etiqueta, dow) => {
            const dia = dias[dow];
            return (
              <div
                key={etiqueta}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-aventurea-line px-3.5 py-3 last:border-none sm:px-4"
              >
                <span className="w-[88px] text-[13.5px] font-bold text-aventurea-ink">
                  {etiqueta}
                </span>
                <button
                  type="button"
                  onClick={() => cambiar(dow, { abierto: !dia.abierto })}
                  aria-pressed={dia.abierto}
                  className={dia.abierto ? diaAbierto : diaCerrado}
                >
                  {dia.abierto ? "Abierto" : "Cerrado"}
                </button>
                {dia.abierto ? (
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-aventurea-ink-soft">
                    <input
                      type="time"
                      value={dia.abre}
                      onChange={(e) => cambiar(dow, { abre: e.target.value })}
                      aria-label={`Hora de apertura del ${etiqueta.toLowerCase()}`}
                      className={inputTimeCls}
                    />
                    a
                    <input
                      type="time"
                      value={dia.cierra}
                      onChange={(e) => cambiar(dow, { cierra: e.target.value })}
                      aria-label={`Hora de cierre del ${etiqueta.toLowerCase()}`}
                      className={inputTimeCls}
                    />
                  </span>
                ) : (
                  <span className={CUERPO_SUAVE}>Ese día no se toman citas.</span>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p className={`${RADIO_TILE} p-3 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
            {error}
          </p>
        )}
        {guardado && (
          <p
            role="status"
            className={`${RADIO_TILE} p-3 text-[13px] font-bold ${ESTADO_AVISO.exito}`}
          >
            ✓ Horario guardado.
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className={BOTON_PANEL_PRIMARIO}
          >
            {pending ? "Guardando..." : "Guardar horario"}
          </button>
        </div>
      </div>
    </Card>
  );
}
