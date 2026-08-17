"use client";

import { useState, useTransition } from "react";
import { abrirPortalDeFacturacion, iniciarPagoConTarjeta } from "./suscripcion-actions";

/**
 * LOS DOS BOTONES DE STRIPE: pagar y administrar.
 *
 * Los dos hacen lo mismo: le piden una URL al servidor y mandan el
 * navegador ahí. Ninguna pantalla de pago se dibuja de este lado —
 * Checkout y el Customer Portal son de Stripe, y esa es toda la
 * gracia: menos superficie donde algo pueda tocar una tarjeta, y 3-D
 * Secure, Apple Pay y Google Pay resueltos sin escribir una línea.
 *
 * Este archivo NO decide nada. Que quien toca sea el dueño, que el
 * paquete se pueda cobrar y cuál es el precio se resuelve en el
 * servidor (`suscripcion-actions.ts`): una petición armada a mano no
 * pasa por acá.
 *
 * `window.location.assign` y no `router.push`: Checkout es un sitio
 * ajeno, y el router de Next solo navega dentro de la app.
 */

/* El azul de acción para fondo oscuro, con su letra ya decidida: sobre
   este azul el blanco no llega, va navy. */
const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";

export type OpcionDePago = {
  periodo: string;
  /** Lo que dice el botón: «Pagar con tarjeta», «Pagar el año…». */
  etiqueta: string;
};

export function BotonesPagarConTarjeta({
  ranchoId,
  plan,
  opciones,
  destacado = false,
}: {
  ranchoId: string;
  plan: string;
  opciones: OpcionDePago[];
  destacado?: boolean;
}) {
  const [pendiente, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (opciones.length === 0) return null;

  const ir = (periodo: string) => {
    setError(null);
    arrancar(async () => {
      const r = await iniciarPagoConTarjeta({ ranchoId, plan, periodo });
      if (r.ok) window.location.assign(r.url);
      else setError(r.motivo);
    });
  };

  return (
    <div className="mt-2 space-y-1.5">
      {opciones.map((o, i) => (
        <button
          key={o.periodo}
          type="button"
          disabled={pendiente}
          onClick={() => ir(o.periodo)}
          className={`block w-full rounded-xl px-3 py-2.5 text-center text-[12.5px] font-bold disabled:opacity-60 ${
            i === 0 && destacado ? "" : "border border-aventurea-line text-aventurea-ink"
          }`}
          style={
            i === 0 && destacado ? { background: ACCION, color: ACCION_TINTA } : undefined
          }
        >
          {pendiente ? "Abriendo…" : o.etiqueta}
        </button>
      ))}
      {error && <p className="text-[11.5px] font-bold text-red-600">{error}</p>}
    </div>
  );
}

export function BotonPortalDeFacturacion({ ranchoId }: { ranchoId: string }) {
  const [pendiente, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          setError(null);
          arrancar(async () => {
            const r = await abrirPortalDeFacturacion(ranchoId);
            if (r.ok) window.location.assign(r.url);
            else setError(r.motivo);
          });
        }}
        className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink disabled:opacity-60"
      >
        {pendiente ? "Abriendo…" : "Administrar mi suscripción →"}
      </button>
      <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">
        Cambiar la tarjeta, ver las facturas, cambiar de paquete o cancelar.
      </p>
      {error && <p className="mt-1.5 text-[11.5px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
