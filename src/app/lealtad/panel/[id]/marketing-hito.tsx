"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/panel/piezas";
import {
  CAMPO_PANEL,
  CUERPO_SUAVE,
  ESTADO_AVISO,
  RADIO_TILE,
} from "@/components/panel/sistema";
import { ACCION, ACCION_TINTA, BOTON_ACCION } from "../sistema-lealtad";
import { guardarMensajeHito, obtenerMensajeHito } from "./marketing-actions";

const TOPE = 120;

/**
 * EL MENSAJE DE HITO (0205) — configuración, no envío.
 *
 * Distinto de <MarketingMensaje> (que manda un aviso YA, a todos, y
 * cuenta contra el cupo del mes): esto se GUARDA una vez y de ahí en
 * adelante se manda SOLO, automático, en los mismos 3 momentos que ya
 * usa el correo de hitos — primer sello, penúltimo, meta alcanzada
 * (`hitoDelSaldo()`, src/lib/correo/sello-acreditado.ts). Nunca en cada
 * sello: ese camino ya se apagó una vez por spam.
 *
 * No cuenta contra el cupo mensual de notificaciones — es un mensaje
 * transaccional del propio progreso del cliente, no una campaña.
 */
export default function MarketingHito({
  ranchoId,
  programaId,
}: {
  ranchoId: string;
  programaId: string;
}) {
  const [mensaje, setMensaje] = useState("");
  const [cargado, setCargado] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    obtenerMensajeHito(ranchoId, programaId).then((res) => {
      if (!vivo) return;
      if (res.ok) setMensaje(res.datos);
      setCargado(true);
    });
    return () => {
      vivo = false;
    };
  }, [ranchoId, programaId]);

  function guardar() {
    setError(null);
    setGuardado(false);
    iniciar(async () => {
      const res = await guardarMensajeHito(ranchoId, programaId, mensaje);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setMensaje(res.datos);
      setGuardado(true);
    });
  }

  return (
    <Card
      eyebrow="Automático, en cada hito"
      titulo="Mensaje de progreso"
      nivel="h3"
    >
      <p className={CUERPO_SUAVE}>
        Se manda SOLO en tres momentos de cada cliente: su primer sello, cuando
        le falta uno y cuando completa la meta — nunca en cada visita. Dejalo
        vacío para no mandar nada.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <input
            type="text"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            maxLength={TOPE}
            disabled={!cargado}
            placeholder="Ej.: ¡Gracias por volver! Seguí sellando."
            className={CAMPO_PANEL}
          />
          <p className="mt-1 text-right text-[10.5px] text-aventurea-ink-soft">
            {mensaje.length}/{TOPE}
          </p>
        </div>
        <button
          type="button"
          onClick={guardar}
          disabled={ocupado || !cargado}
          className={BOTON_ACCION}
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {ocupado ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.alerta}`}
        >
          {error}
        </p>
      )}
      {guardado && !error && (
        <p
          className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.exito}`}
        >
          {mensaje
            ? "Guardado — se va a mandar en el próximo hito de cada cliente."
            : "Guardado — no se manda nada en los hitos."}
        </p>
      )}
    </Card>
  );
}
