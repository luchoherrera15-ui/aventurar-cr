"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ROTULO_CAMPO } from "@/components/panel/sistema";
import { IconCamera } from "@/components/icons";
import type { EscanerLealtad } from "@/lib/solutions/lealtad-puente";

/**
 * EL ESCÁNER DE PASES, EN EL PANEL DE SOLUTIONS.
 *
 * Pedido del dueño (5 sep 2026): «un escaneador de códigos para
 * asignar puntos en los pases de lealtad, cuando lo tenga adquirido».
 *
 * No es un escáner nuevo: es `EscanerPanel`, el mismo de Lealtad
 * (jsQR + cámara + `sumarSelloEscaneado`), montado acá con los props
 * que calcula `lealtad-puente.ts`. Un segundo escáner sería una
 * segunda copia de la regla que mueve saldo, que es el error que este
 * repo ya sabe que no hay que repetir (ver escaner-actions.ts).
 *
 * Se carga con `ssr:false` y solo al abrirlo, por lo mismo que en
 * Lealtad: que un fallo de la librería pierda el escáner, no la
 * página; y que la cámara se pida al tocar el botón, no al entrar.
 *
 * Los tokens de color de Lealtad (`ACCION`, `BOTON_LEALTAD`) resuelven
 * porque /solutions entero va dentro de `.lealtad` (ver layout.tsx).
 */

const EscanerPanel = dynamic(() => import("@/app/lealtad/panel/[id]/escaner-panel"), {
  ssr: false,
  loading: () => (
    <div className="mt-3 rounded-2xl border border-aventurea-line bg-white p-5">
      <p className="text-[13px] font-bold text-aventurea-ink-soft">Preparando el escáner…</p>
    </div>
  ),
});

export default function EscanerSolutions({
  opciones,
  abierto: abiertoInicial = false,
}: {
  /** Un escáner por negocio de Lealtad de la cuenta. */
  opciones: EscanerLealtad[];
  abierto?: boolean;
}) {
  const [indice, setIndice] = useState(0);
  const [abierto, setAbierto] = useState(abiertoInicial);
  const op = opciones[indice] ?? opciones[0];
  if (!op) return null;

  return (
    <div>
      {/* Solo cuando la cuenta tiene más de un negocio con tarjeta:
          con uno, elegir sería un paso de más. */}
      {opciones.length > 1 && (
        <div className="mb-3">
          <label htmlFor="escaner-negocio" className={ROTULO_CAMPO}>
            Tarjeta de
          </label>
          <select
            id="escaner-negocio"
            value={indice}
            onChange={(e) => setIndice(Number(e.target.value))}
            className={`mt-1.5 max-w-[360px] ${CAMPO_PANEL}`}
          >
            {opciones.map((o, i) => (
              <option key={o.ranchoId} value={i}>
                {o.negocio} · {o.tarjeta}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className={`${abierto ? BOTON_PANEL : BOTON_PANEL_PRIMARIO} inline-flex items-center gap-2`}
        >
          <IconCamera className="h-[18px] w-[18px]" />
          {abierto ? "Cerrar el escáner" : "Escanear un pase"}
        </button>
        <span className="text-[12.5px] text-aventurea-ink-soft">
          {op.tarjeta} · {op.pideMonto ? "pide el monto de la compra" : "suma un sello por visita"}
        </span>
      </div>

      {abierto && (
        <div className="mt-3">
          {/* `key` por negocio: cambiar de tarjeta reinicia el escáner
              entero (cámara incluida) en vez de dejarle el estado del
              cliente anterior. */}
          <EscanerPanel
            key={op.ranchoId}
            ranchoId={op.ranchoId}
            pideMonto={op.pideMonto}
            recompensa={op.recompensa}
            productos={op.productos}
          />
        </div>
      )}
    </div>
  );
}
