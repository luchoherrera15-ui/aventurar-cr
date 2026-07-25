"use client";

import { useMemo, useState, useTransition } from "react";
import {
  marcarDepositoValidado,
  obtenerUrlComprobante,
  setEstadoReserva,
} from "./actions";
import type { Reserva } from "./types";

const ESTADO_LABEL: Record<Reserva["estado"], string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  rechazada: "Rechazada",
  bloqueada: "Bloqueada",
};

const ESTADO_BADGE: Record<Reserva["estado"], string> = {
  pendiente: "bg-aventurea-orange-light text-aventurea-orange-dark",
  confirmada: "bg-aventurea-navy text-white",
  rechazada: "bg-aventurea-cream-2 text-aventurea-ink",
  bloqueada: "bg-aventurea-ink text-white",
};

function fmtMoney(n: number | null) {
  return "₡" + Number(n || 0).toLocaleString("es-CR");
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ReservasTable({
  initialReservas,
}: {
  initialReservas: Reserva[];
}) {
  const [reservas, setReservas] = useState(initialReservas);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservas
      .filter((r) => (!q ? true : r.nombre.toLowerCase().includes(q)))
      .filter((r) => filtro === "todas" || r.estado === filtro)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [reservas, query, filtro]);

  function cambiarEstado(id: string, estado: Reserva["estado"]) {
    setActionError(null);
    startTransition(async () => {
      const res = await setEstadoReserva(id, estado);
      if (res?.error) {
        setActionError(
          estado === "confirmada"
            ? "No se pudo confirmar: ya hay otra reserva confirmada para esa misma fecha."
            : res.error,
        );
        return;
      }
      setReservas((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado } : r)),
      );
    });
  }

  async function verComprobante(path: string) {
    const res = await obtenerUrlComprobante(path);
    if (res.url) {
      window.open(res.url, "_blank");
    } else {
      setActionError(res.error ?? "No se pudo abrir el comprobante.");
    }
  }

  function marcarValidado(id: string) {
    setActionError(null);
    startTransition(async () => {
      const res = await marcarDepositoValidado(id, true);
      if (res?.error) {
        setActionError(res.error);
        return;
      }
      setReservas((prev) =>
        prev.map((r) => (r.id === id ? { ...r, deposito_validado: true } : r)),
      );
    });
  }

  return (
    <div>
      <div className="mb-4.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          <input
            type="search"
            placeholder="Buscar cliente..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-[10px] border-[1.5px] border-aventurea-line bg-white px-3 py-2.5 text-[13px]"
          />
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="rounded-[10px] border-[1.5px] border-aventurea-line bg-white px-3 py-2.5 text-[13px]"
          >
            <option value="todas">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            <option value="rechazada">Rechazada</option>
            <option value="bloqueada">Bloqueada</option>
          </select>
        </div>
      </div>

      {actionError && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {actionError}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-aventurea-cream">
              {[
                "Fecha",
                "Cliente",
                "Evento",
                "Invitados",
                "Estado",
                "Depósito",
                "Acciones",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-aventurea-line px-4 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-[13.5px] text-aventurea-ink-soft"
                >
                  No hay reservas que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {list.map((r) => (
              <tr key={r.id} className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream">
                <td className="px-4 py-3.5 text-[13.5px]">{fmtDate(r.fecha)}</td>
                <td className="px-4 py-3.5">
                  <div className="font-bold text-aventurea-navy">{r.nombre}</div>
                  <div className="text-xs text-aventurea-ink-soft">{r.contacto}</div>
                </td>
                <td className="px-4 py-3.5 text-[13.5px]">{r.tipo_evento}</td>
                <td className="px-4 py-3.5 text-[13.5px]">{r.invitados ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_BADGE[r.estado]}`}
                  >
                    {ESTADO_LABEL[r.estado]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col items-start gap-1">
                    {r.deposito_validado ? (
                      <span className="inline-flex items-center rounded-full bg-aventurea-green-light px-2.5 py-1 text-[11px] font-bold text-aventurea-green">
                        ✓ Validado · {fmtMoney(r.deposito_monto)}
                      </span>
                    ) : r.deposito_comprobante_url ? (
                      <span className="inline-flex items-center rounded-full bg-aventurea-orange-light px-2.5 py-1 text-[11px] font-bold text-aventurea-orange-dark">
                        Por validar · {fmtMoney(r.deposito_monto)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-aventurea-cream-2 px-2.5 py-1 text-[11px] font-bold text-aventurea-ink-soft">
                        Sin comprobante
                      </span>
                    )}
                    {r.deposito_comprobante_url && (
                      <div className="flex gap-2.5">
                        <button
                          onClick={() => verComprobante(r.deposito_comprobante_url!)}
                          className="text-[11px] font-bold text-aventurea-navy underline hover:text-aventurea-orange-dark"
                        >
                          Ver comprobante
                        </button>
                        {!r.deposito_validado && (
                          <button
                            disabled={pending}
                            onClick={() => marcarValidado(r.id)}
                            className="text-[11px] font-bold text-aventurea-green underline hover:text-aventurea-navy disabled:opacity-50"
                          >
                            Marcar validado
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {r.estado === "pendiente" && (
                      <>
                        <button
                          disabled={pending}
                          onClick={() => cambiarEstado(r.id, "confirmada")}
                          className="h-[30px] rounded-lg border border-aventurea-line bg-white px-2.5 text-xs font-bold text-aventurea-green hover:border-aventurea-green disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => cambiarEstado(r.id, "rechazada")}
                          className="h-[30px] rounded-lg border border-aventurea-line bg-white px-2.5 text-xs font-bold text-red-700 hover:border-red-400 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
