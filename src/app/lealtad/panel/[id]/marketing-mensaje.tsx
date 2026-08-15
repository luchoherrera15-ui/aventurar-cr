"use client";

import { useState, useTransition } from "react";
import { enviarNotificacionPromocional } from "./marketing-actions";

const NARANJA = "#ee7420";
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
    <div className="rounded-2xl border border-white/12 p-4" style={{ background: "rgba(255,255,255,.03)" }}>
      <p className="text-[13px] font-extrabold text-white">Mandar un aviso a todos</p>
      <p className="mt-0.5 text-[12px] text-white/50">
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
            className="w-full rounded-xl border bg-white/[0.06] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/35"
            style={{ borderColor: "rgba(255,255,255,.15)" }}
          />
          <p className="mt-1 text-right text-[10.5px] text-white/35">
            {mensaje.length}/{TOPE}
          </p>
        </div>
        <button
          type="button"
          onClick={enviar}
          disabled={ocupado || mensaje.trim().length < 3}
          className="shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white transition-colors disabled:opacity-50"
          style={{ background: NARANJA }}
        >
          {ocupado ? "Enviando…" : "Enviar a todos"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2.5 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-200">
          {error}
        </p>
      )}
      {resultado && (
        <p className="mt-2.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white/80" style={{ background: "rgba(52,199,89,.12)" }}>
          {resultado}
        </p>
      )}
    </div>
  );
}
