"use client";

import { useMemo, useState, useTransition } from "react";
import { CRC, type FoodPedidoEstado } from "@/lib/food/tipos";
import { TarjetaPanel, InsigniaEstado } from "@/components/food/panel";
import { useToastFood } from "@/components/food/panel/toast";
import { avanzarPedido, cancelarPedidoNegocio } from "./actions";

export type FilaPedidoPanel = {
  id: string;
  codigo: string;
  estado: FoodPedidoEstado;
  horaRetiro: string | null;
  notas: string | null;
  total: number;
  createdAt: string;
  /** "2× Casado con pollo · 1× Tres leches" — vacío si no hay platos. */
  resumenPlatos: string;
};

type Tab = "activos" | "anteriores" | "cancelados";

const SIGUIENTE_LABEL: Partial<Record<FoodPedidoEstado, string>> = {
  pendiente: "Confirmar",
  confirmado: "Marcar listo",
  listo: "Marcar entregado",
};

function formatoHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * PEDIDOS — la cola real de "To Go" (0207): Activos (pendiente,
 * confirmado, listo) primero porque son los que requieren acción
 * AHORA, Anteriores (entregado) y Cancelados aparte, mismo criterio de
 * tres grupos que ReservasTabsFood.
 */
export default function PedidosCliente({ negocioId, pedidos }: { negocioId: string; pedidos: FilaPedidoPanel[] }) {
  const { avisar, toast } = useToastFood();
  const [pendiente, iniciar] = useTransition();
  const [enProceso, setEnProceso] = useState<string | null>(null);
  const [sobreescritos, setSobreescritos] = useState<Record<string, FoodPedidoEstado>>({});
  const [tab, setTab] = useState<Tab>("activos");

  const filas = useMemo(
    () => pedidos.map((p) => (sobreescritos[p.id] ? { ...p, estado: sobreescritos[p.id] } : p)),
    [pedidos, sobreescritos],
  );

  const grupos = useMemo(() => {
    const activos = filas.filter((f) => f.estado === "pendiente" || f.estado === "confirmado" || f.estado === "listo");
    const anteriores = filas.filter((f) => f.estado === "entregado");
    const cancelados = filas.filter((f) => f.estado === "cancelado");
    return { activos, anteriores, cancelados };
  }, [filas]);

  const visibles = grupos[tab];

  function avanzar(fila: FilaPedidoPanel) {
    const siguiente = fila.estado === "pendiente" ? "confirmado" : fila.estado === "confirmado" ? "listo" : "entregado";
    setEnProceso(fila.id);
    iniciar(async () => {
      const r = await avanzarPedido(negocioId, fila.id);
      setEnProceso(null);
      if (!r.ok) {
        avisar("error", r.error);
        return;
      }
      setSobreescritos((prev) => ({ ...prev, [fila.id]: siguiente as FoodPedidoEstado }));
      avisar("exito", `Pedido ${fila.codigo} → ${SIGUIENTE_LABEL[fila.estado] ?? siguiente}.`);
    });
  }

  function cancelar(fila: FilaPedidoPanel) {
    setEnProceso(fila.id);
    iniciar(async () => {
      const r = await cancelarPedidoNegocio(negocioId, fila.id);
      setEnProceso(null);
      if (!r.ok) {
        avisar("error", r.error);
        return;
      }
      setSobreescritos((prev) => ({ ...prev, [fila.id]: "cancelado" }));
      avisar("exito", `Pedido ${fila.codigo} cancelado.`);
    });
  }

  const TABS: { id: Tab; label: string; n: number }[] = [
    { id: "activos", label: "Activos", n: grupos.activos.length },
    { id: "anteriores", label: "Anteriores", n: grupos.anteriores.length },
    { id: "cancelados", label: "Cancelados", n: grupos.cancelados.length },
  ];

  return (
    <TarjetaPanel kicker="To Go" titulo="Pedidos para llevar">
      <div
        role="tablist"
        aria-label="Filtrar pedidos"
        className="inline-flex w-fit gap-1 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${
              tab === t.id ? "bg-white text-aventurea-navy shadow-sm" : "text-aventurea-ink-soft hover:text-aventurea-navy"
            }`}
          >
            {t.label} <span className="opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="mt-4 rounded-xl bg-aventurea-cream-2 px-6 py-8 text-center text-[13px] text-aventurea-ink-soft">
          {tab === "activos"
            ? "No hay pedidos activos. Cuando alguien pida por la app, aparece acá al instante."
            : tab === "anteriores"
              ? "Todavía no tenés pedidos entregados."
              : "No tenés pedidos cancelados."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {visibles.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-aventurea-line bg-white p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-extrabold text-aventurea-navy">{f.codigo}</span>
                  <InsigniaEstado estado={f.estado} />
                </div>
                <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                  {formatoHora(f.createdAt)} · {CRC.format(f.total)}
                  {f.horaRetiro ? ` · Retiro: ${f.horaRetiro}` : ""}
                </p>
                {f.resumenPlatos && (
                  <p className="mt-0.5 truncate text-[12.5px] text-aventurea-ink" title={f.resumenPlatos}>
                    {f.resumenPlatos}
                  </p>
                )}
                {f.notas && <p className="mt-0.5 text-[12px] italic text-aventurea-ink-soft">“{f.notas}”</p>}
              </div>

              {(f.estado === "pendiente" || f.estado === "confirmado" || f.estado === "listo") && (
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => avanzar(f)}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-aventurea-navy px-4 text-[13px] font-bold text-white transition-colors hover:bg-aventurea-navy-2 disabled:opacity-50"
                  >
                    {enProceso === f.id ? "Guardando…" : SIGUIENTE_LABEL[f.estado]}
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => cancelar(f)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-aventurea-line px-3 text-[12.5px] font-bold text-aventurea-ink-soft transition-colors hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {toast}
    </TarjetaPanel>
  );
}
