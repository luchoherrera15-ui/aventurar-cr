"use client";

import { useState } from "react";
import { fmtColones } from "@/lib/finanzas";
import type { ActividadItem } from "./metricas";

const ESTADO_LABEL: Record<ActividadItem["estado"], string> = {
  pendiente: "En aprobación",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
};

const ESTADO_CLASE: Record<ActividadItem["estado"], string> = {
  pendiente: "text-aventurea-orange",
  confirmada: "text-aventurea-green",
  rechazada: "text-red-600",
};

/** Cuántas filas se ven antes de tocar "Ver más". */
const VISIBLES = 5;

function fmtFechaHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtFechaEvento(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
  });
}

/**
 * La auditoría de Inicio: cada reserva con cuándo se hizo, cuánto se
 * depositó y cuánto queda pendiente — no solo el total, que por sí solo
 * no dice si la plata entró.
 *
 * Las notas no se muestran en la fila (son largas y desalinean todo):
 * quedan como un asterisco al final que abre la nota en una tarjetita.
 * Y se listan 5 a la vez, con un botón para extender: el feed completo
 * en Inicio tapaba el resto del tablero.
 */
export default function ActividadReciente({ items }: { items: ActividadItem[] }) {
  const [expandido, setExpandido] = useState(false);
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] text-aventurea-ink-soft">
        Todavía no tenés actividad para mostrar acá.
      </p>
    );
  }

  const visibles = expandido ? items : items.slice(0, VISIBLES);
  const restantes = items.length - VISIBLES;

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      {/* Encabezado: solo en pantallas anchas — en celular cada fila se
          lee sola, con sus rótulos al lado de cada monto. */}
      <div className="hidden items-center gap-3 border-b border-aventurea-line bg-aventurea-cream-2/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-aventurea-ink-soft sm:flex">
        <span className="min-w-0 flex-1">Cliente</span>
        <span className="w-[92px] text-right">Se reservó</span>
        <span className="w-[92px] text-right">Evento</span>
        <span className="w-[96px] text-right">Adelanto</span>
        <span className="w-[96px] text-right">Pendiente</span>
        <span className="w-6" />
      </div>

      {visibles.map((it, i) => (
        <div key={it.id} className={i > 0 ? "border-t border-aventurea-line/60" : ""}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-aventurea-ink">
                {it.nombre ?? "Sin nombre"}
              </p>
              <p className={`text-[11.5px] font-bold ${ESTADO_CLASE[it.estado]}`}>
                {ESTADO_LABEL[it.estado]}
                {it.monto !== null && (
                  <span className="ml-2 font-normal text-aventurea-ink-soft">
                    Total {fmtColones(it.monto)}
                  </span>
                )}
              </p>
            </div>

            <span className="w-[92px] text-right text-[12px] text-aventurea-ink-soft">
              <span className="sm:hidden">Se reservó </span>
              {fmtFechaHora(it.creadoEn)}
            </span>
            <span className="w-[92px] text-right text-[12px] text-aventurea-ink-soft">
              <span className="sm:hidden">Evento </span>
              {fmtFechaEvento(it.fechaEvento)}
            </span>
            <span className="w-[96px] text-right text-[12.5px] font-bold text-aventurea-green">
              <span className="font-normal text-aventurea-ink-soft sm:hidden">Adelanto </span>
              {fmtColones(it.adelanto)}
            </span>
            <span
              className={`w-[96px] text-right text-[12.5px] font-bold ${
                it.pendiente > 0 ? "text-aventurea-ink" : "text-aventurea-ink-soft"
              }`}
            >
              <span className="font-normal text-aventurea-ink-soft sm:hidden">Pendiente </span>
              {fmtColones(it.pendiente)}
            </span>

            <span className="flex w-6 justify-end">
              {it.nota && (
                <button
                  type="button"
                  onClick={() => setNotaAbierta(notaAbierta === it.id ? null : it.id)}
                  aria-expanded={notaAbierta === it.id}
                  aria-label={`Ver la nota de ${it.nombre ?? "esta reserva"}`}
                  className={`flex h-6 w-6 items-center justify-center rounded-lg text-[15px] font-bold leading-none transition-colors ${
                    notaAbierta === it.id
                      ? "bg-aventurea-sky text-white"
                      : "bg-aventurea-cream-2 text-aventurea-sky hover:bg-aventurea-sky-light"
                  }`}
                >
                  *
                </button>
              )}
            </span>
          </div>

          {notaAbierta === it.id && it.nota && (
            <div className="px-4 pb-3">
              <p className="rounded-xl border border-aventurea-sky/30 bg-aventurea-sky-light px-3.5 py-2.5 text-[12.5px] leading-relaxed text-aventurea-ink">
                <span className="mr-1.5 font-bold">Nota:</span>
                {it.nota}
              </p>
            </div>
          )}
        </div>
      ))}

      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="w-full border-t border-aventurea-line py-2.5 text-[12.5px] font-bold text-aventurea-navy hover:bg-aventurea-cream-2/60"
        >
          {expandido ? "Ver menos" : `Ver las ${restantes} restantes`}
        </button>
      )}
    </div>
  );
}
