"use client";

import { useState, useTransition } from "react";
import { marcarCanjeEnPos } from "./lealtad-operar-actions";

/**
 * LAS PIEZAS DE CLIENTE DE `lealtad-secciones.tsx`.
 *
 * Acá vivían también el libro de movimientos (`ActividadFiltrable`) y su
 * fila (`FilaActividad`). Se fueron el 7 sep 2026: el libro entero, con
 * filtros por fecha, tipo, canal y colaborador, es ahora la pantalla
 * Estadísticas (`estadisticas-lealtad.tsx`). Queda solo lo que sigue
 * teniendo dueño: el canje pendiente de pasar a la caja.
 */

/** Un canje entregado que todavía no se marcó en el POS (modo manual). */
export function CanjePendientePos({
  ranchoId,
  canje,
  primera,
}: {
  ranchoId: string;
  canje: {
    id: string;
    miembro_id: string;
    nombre: string;
    recompensa: string;
    sku: string | null;
    fecha: string;
  };
  primera: boolean;
}) {
  const [factura, setFactura] = useState("");
  const [estado, setEstado] = useState<"pendiente" | "hecho" | string>("pendiente");
  const [ocupado, iniciar] = useTransition();

  function marcar() {
    iniciar(async () => {
      const res = await marcarCanjeEnPos(ranchoId, canje.miembro_id, canje.id, factura);
      setEstado(res.ok ? "hecho" : res.motivo);
    });
  }

  if (estado === "hecho") {
    return (
      <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
        <p className="text-[12.5px] font-bold text-aventurea-green">
          {canje.recompensa} de {canje.nombre} — registrado en tu caja.
        </p>
      </div>
    );
  }

  return (
    <div className={`px-4 py-3 ${primera ? "" : "border-t border-aventurea-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-aventurea-ink">
          {canje.recompensa} · {canje.nombre}
        </span>
        {canje.sku && (
          <span className="rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
            SKU {canje.sku}
          </span>
        )}
        <span className="text-[11.5px] text-aventurea-ink-soft">{canje.fecha}</span>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={factura}
          onChange={(e) => setFactura(e.target.value)}
          placeholder="Nº de factura (opcional)"
          maxLength={60}
          className="flex-1 rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2 text-[12.5px] text-aventurea-ink placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={marcar}
          disabled={ocupado}
          className="shrink-0 rounded-[10px] bg-aventurea-navy px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
        >
          Ya lo pasé a la caja
        </button>
      </div>
      {estado !== "pendiente" && (
        <p className="mt-1 text-[12px] font-bold text-red-700">{estado}</p>
      )}
    </div>
  );
}
