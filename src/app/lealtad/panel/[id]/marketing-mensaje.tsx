"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/panel/piezas";
import {
  CAMPO_PANEL,
  CUERPO_SUAVE,
  ESTADO_AVISO,
  RADIO_TILE,
} from "@/components/panel/sistema";
import { ACCION, ACCION_TINTA, BOTON_ACCION } from "../sistema-lealtad";
import { enviarNotificacionPromocional } from "./marketing-actions";

const TOPE = 120;

/**
 * "MIÉRCOLES MATCHAS 2X1" — el mensaje real, a todos los clientes con
 * el pase. Un campo, un botón: el envío en sí (dos plataformas, por
 * tandas) lo resuelve enviarMensajePromocional (mensaje-promocional.ts).
 *
 * Separado de <TablaMarketing> (que es por-cliente, "probar el aviso
 * de este pase") porque esto es lo opuesto: un solo mensaje, a todos a
 * la vez. Mezclarlos en un mismo componente confundía las dos acciones.
 */
export default function MarketingMensaje({
  ranchoId,
  programaId,
}: {
  ranchoId: string;
  programaId: string;
}) {
  const [mensaje, setMensaje] = useState("");
  const [ocupado, iniciar] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function enviar() {
    setError(null);
    setResultado(null);
    iniciar(async () => {
      const res = await enviarNotificacionPromocional(ranchoId, programaId, mensaje);
      if (!res.ok) {
        setError(res.motivo);
        return;
      }
      setMensaje("");
      const { apple, googleEnviados, googleFallidos } = res.datos;
      const parteApple = apple
        ? apple.fallidos === 0
          ? `En Apple: salió para ${apple.avisados} pase${apple.avisados === 1 ? "" : "s"}.`
          : `En Apple: ${apple.avisados} de ${apple.avisados + apple.fallidos} pase${apple.avisados + apple.fallidos === 1 ? "" : "s"}.`
        : null;
      const parteGoogle =
        googleEnviados + googleFallidos > 0
          ? `En Google: ${googleEnviados} de ${googleEnviados + googleFallidos} entregado${googleEnviados === 1 ? "" : "s"}.`
          : null;
      setResultado(
        [parteApple, parteGoogle].filter(Boolean).join(" ") ||
          "Guardado — todavía no hay ningún pase instalado para avisar.",
      );
    });
  }

  return (
    <Card eyebrow="A todos a la vez" titulo="Mandar un aviso" nivel="h3">
      <p className={CUERPO_SUAVE}>
        Ej.: &quot;MIÉRCOLES MATCHAS 2X1&quot;. Le llega como notificación en el teléfono a
        todos los que tienen tu tarjeta instalada.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <input
            type="text"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            maxLength={TOPE}
            placeholder="MIÉRCOLES MATCHAS 2X1"
            className={CAMPO_PANEL}
          />
          <p className="mt-1 text-right text-[10.5px] text-aventurea-ink-soft">
            {mensaje.length}/{TOPE}
          </p>
        </div>
        <button
          type="button"
          onClick={enviar}
          disabled={ocupado || mensaje.trim().length < 3}
          className={BOTON_ACCION}
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {ocupado ? "Enviando…" : "Enviar a todos"}
        </button>
      </div>

      {/* Error y resultado usan los estados del sistema. Antes eran un
          rojo y un verde propios de este archivo —`red-200` sobre
          `red-500/10`, `white/80` sobre un verde al 12 %—: dos colores
          más que ninguna otra pantalla del panel conocía. */}
      {error && (
        <p
          role="alert"
          className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.alerta}`}
        >
          {error}
        </p>
      )}
      {resultado && (
        <p className={`mt-2.5 ${RADIO_TILE} px-3 py-2 text-[12px] font-bold ${ESTADO_AVISO.exito}`}>
          {resultado}
        </p>
      )}
    </Card>
  );
}
