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

      {/* Cancelar es lo que más se busca y estaba escondido en la lista
          de arriba, en cuarto lugar. Va con su propio botón: quien viene
          a dar de baja no debería tener que deducir que «Administrar»
          también sirve para eso. Los dos abren el MISMO portal. */}
      <BotonCancelarSuscripcion ranchoId={ranchoId} className="mt-3" />
    </div>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════
 *  CANCELAR LA SUSCRIPCIÓN
 * ════════════════════════════════════════════════════════════════════
 *
 * ── NO CANCELA ACÁ, Y ESO ES EL DISEÑO ──────────────────────────────
 *
 * Abre el Customer Portal de Stripe, que es donde la cancelación ya
 * vive. No se construye una pantalla propia por lo mismo que explica
 * `abrirPortalDeFacturacion`: la de Stripe es gratis, está mejor
 * mantenida que cualquier cosa que escribamos, y cada pantalla nuestra
 * que toque plata es un lugar más donde un error cuesta dinero de
 * verdad.
 *
 * Ahí además la baja queda con `cancel_at_period_end`: el negocio SIGUE
 * OPERANDO hasta que termina el mes que ya pagó, y recién entonces el
 * webhook lo corta (ver `src/lib/pagos/corte.ts`). Cancelar no le apaga
 * el programa en el acto a nadie, que es lo que un botón nuestro mal
 * hecho sí podría hacer.
 *
 * ── EL COLOR NO ES ROJO ─────────────────────────────────────────────
 *
 * Cancelar no es destructivo en el acto —no borra nada, y el programa
 * sigue hasta fin de período—, así que un botón rojo asustaría más de
 * lo que informa. Va como acción secundaria: legible, sin gritar.
 */
export function BotonCancelarSuscripcion({
  ranchoId,
  className = "",
}: {
  ranchoId: string;
  className?: string;
}) {
  const [pendiente, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
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
        className="text-[12.5px] font-bold text-aventurea-ink-soft underline underline-offset-2 transition-colors hover:text-aventurea-ink disabled:opacity-60"
      >
        {pendiente ? "Abriendo…" : "Cancelar suscripción"}
      </button>
      {error && <p className="mt-1.5 text-[11.5px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
