"use client";

import { useState, useTransition } from "react";
import { fmtColones } from "@/lib/finanzas";
import { guardarDepositoCitas } from "./deposito-actions";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  CUERPO,
  ESTADO_AVISO,
  RADIO_PILDORA,
  RADIO_TILE,
} from "@/components/panel/sistema";

const inputCls = `${CAMPO_PANEL} w-[130px]`;

/** El interruptor de encendido/apagado del depósito: el par de ÉXITO
 *  del sistema cuando está activo (4,51:1) y el NEUTRO cuando no
 *  (6,58:1). Antes el activo era `bg-aventurea-green/10` — un alfa
 *  marcando estado. */
const toggleBase = `shrink-0 border ${RADIO_PILDORA} px-3 py-1.5 text-[12.5px] font-bold transition-colors`;
const toggleActivo = `${toggleBase} border-transparent bg-aventurea-green-light text-aventurea-green`;
const toggleApagado = `${toggleBase} border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft`;

/**
 * El depósito para asegurar la cita: apagado por defecto (la cita se
 * paga en el local, como siempre); encendido, el cliente ve el monto
 * al reservar y las instrucciones de SINPE al confirmar. La cita
 * igual queda confirmada al instante — el depósito se valida después
 * en Finanzas, con la misma maquinaria de los eventos.
 */
export default function DepositoCitasForm({
  ranchoId,
  initialDeposito,
  tieneSinpe,
}: {
  ranchoId: string;
  initialDeposito: number | null;
  /** Sin cuenta SINPE configurada no hay cómo cobrar el depósito. */
  tieneSinpe: boolean;
}) {
  const [activo, setActivo] = useState(initialDeposito !== null && initialDeposito > 0);
  const [monto, setMonto] = useState(
    initialDeposito && initialDeposito > 0 ? String(initialDeposito) : "",
  );
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function guardar() {
    setError(null);
    setGuardado(false);
    const n = Number(monto);
    if (activo && (!Number.isFinite(n) || n <= 0)) {
      setError("Poné el monto del depósito (en colones).");
      return;
    }
    startTransition(async () => {
      const res = await guardarDepositoCitas(ranchoId, activo ? n : null);
      if (res.error) setError(res.error);
      else setGuardado(true);
    });
  }

  return (
    <Card
      eyebrow="Contra los no-shows"
      titulo="Depósito para asegurar la cita"
      // El estado del módulo, a la derecha del título: es el dato que
      // se viene a buscar acá («¿lo tengo prendido o no?»).
      accion={
        <PildoraEstado estado={activo ? "exito" : "neutro"}>
          {activo ? "Activo" : "Apagado"}
        </PildoraEstado>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setActivo(!activo);
              setGuardado(false);
            }}
            aria-pressed={activo}
            className={activo ? toggleActivo : toggleApagado}
          >
            {activo ? "Con depósito" : "Sin depósito"}
          </button>
          {activo && (
            <label className="flex items-center gap-2 text-[13px] text-aventurea-ink-soft">
              ₡
              <input
                type="number"
                min={0}
                step={500}
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value);
                  setGuardado(false);
                }}
                placeholder="Ej. 5000"
                aria-label="Monto del depósito en colones"
                className={inputCls}
              />
            </label>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            className={BOTON_PANEL_PRIMARIO}
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
          {guardado && (
            <span role="status" className="text-[12.5px] font-bold text-aventurea-green">
              ✓ Guardado
            </span>
          )}
        </div>

        <p className={CUERPO}>
          {activo
            ? `Al reservar, el cliente ve que la cita lleva un depósito${monto && Number(monto) > 0 ? ` de ${fmtColones(Number(monto))}` : ""} por SINPE. La cita queda confirmada al instante y el comprobante te llega por el chat — lo validás en Finanzas, como los depósitos de eventos.`
            : "La cita se paga completa en el local (el flujo de siempre). Activá el depósito si los no-shows te están costando plata."}
        </p>

        {activo && !tieneSinpe && (
          <p className={`${RADIO_TILE} p-3 text-[12.5px] leading-relaxed ${ESTADO_AVISO.aviso}`}>
            Ojo: todavía no configuraste tu cuenta SINPE en Configuración → Cuentas de
            cobro — sin ella el cliente no sabe a dónde depositar.
          </p>
        )}
        {error && (
          <p className={`${RADIO_TILE} p-3 text-[13px] leading-relaxed ${ESTADO_AVISO.alerta}`}>
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
