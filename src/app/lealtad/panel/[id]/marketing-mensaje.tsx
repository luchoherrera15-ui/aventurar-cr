"use client";

import { useEffect, useState, useTransition } from "react";
import { Card } from "@/components/panel/piezas";
import {
  CAMPO_PANEL,
  CUERPO_SUAVE,
  ESTADO_AVISO,
  RADIO_TILE,
} from "@/components/panel/sistema";
import type { EstadoLimite } from "@/lib/lealtad/planes";
import { ACCION, ACCION_TINTA, BOTON_ACCION } from "../sistema-lealtad";
import Medidor from "./medidor";
import { enviarNotificacionPromocional, obtenerCupoNotificaciones } from "./marketing-actions";

const TOPE = 120;

/**
 * "MIÉRCOLES MATCHAS 2X1" — el mensaje real, a todos los clientes con
 * el pase. Un campo, un botón: el envío en sí (dos plataformas, por
 * tandas) lo resuelve enviarMensajePromocional (mensaje-promocional.ts).
 *
 * Separado de <TablaMarketing> (que es por-cliente, "probar el aviso
 * de este pase") porque esto es lo opuesto: un solo mensaje, a todos a
 * la vez. Mezclarlos en un mismo componente confundía las dos acciones.
 *
 * DESDE LA 0183, el envío tiene cupo por mes según el paquete (1/1/20/50
 * — Prueba, Starter, Impulso, Ilimitado). El cupo se pide acá, aparte de
 * `enviarNotificacionPromocional`, para no forzar a `marketing-lealtad.tsx`
 * (el padre) a cargar con un prop nuevo — mismo criterio que ya separa
 * `listarPasesDelPrograma` (lectura) de `enviarAvisoDePrueba` (acción).
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
  const [cupo, setCupo] = useState<EstadoLimite | null>(null);

  function cargarCupo() {
    obtenerCupoNotificaciones(ranchoId, programaId).then((res) => {
      if (res.ok) setCupo(res.datos);
    });
  }

  // Al montar, con el mismo resguardo de "componente ya se fue" que ya
  // usa `seccion-tarjeta-digital.tsx` para este mismo patrón: la
  // promesa puede resolver después de que el panel cambió de tarjeta.
  useEffect(() => {
    let vivo = true;
    obtenerCupoNotificaciones(ranchoId, programaId).then((res) => {
      if (vivo && res.ok) setCupo(res.datos);
    });
    return () => {
      vivo = false;
    };
  }, [ranchoId, programaId]);

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
      cargarCupo();
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
          disabled={ocupado || mensaje.trim().length < 3 || (cupo?.lleno ?? false)}
          className={BOTON_ACCION}
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          {ocupado ? "Enviando…" : "Enviar a todos"}
        </button>
      </div>

      {/* El cupo del mes (0183). `cupo.limite === null` es "sin plan
          conocido": no se muestra nada en vez de un aviso mentiroso.
          <Medidor> es el MISMO medidor que ya usa el resto del panel
          (Inicio, Plan y facturación) para un tope mensual — no hace
          falta inventar una barra ni una paleta nueva, y el pedido del
          dueño era justo esto: que se vea "cómo se va llenando".
          El texto sigue debajo, con el mismo tono ya validado, y
          conserva `role="alert"` cuando se llena para no perder la
          accesibilidad que tenía antes de que hubiera barra. */}
      {cupo && cupo.limite !== null && (
        <div className="mt-3">
          <Medidor
            icono="campana"
            etiqueta="Notificaciones este mes"
            usado={cupo.usado}
            tope={cupo.limite}
            alerta={cupo.lleno}
            aviso={cupo.cerca}
          />
          <p className={`mt-1.5 ${CUERPO_SUAVE}`} role={cupo.lleno ? "alert" : undefined}>
            {cupo.lleno
              ? `Ya usaste ${cupo.limite === 1 ? "tu 1 notificación" : `tus ${cupo.limite} notificaciones`} de este mes.`
              : `Te quedan ${cupo.disponibles} de ${cupo.limite} notificaci${cupo.limite === 1 ? "ón" : "ones"} este mes.`}
          </p>
        </div>
      )}

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
