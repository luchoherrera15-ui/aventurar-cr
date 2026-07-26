"use client";

import { useMemo, useState, useTransition } from "react";
import { borrarRancho, setEstadoRancho } from "./actions";
import { CATEGORIA_LABEL, type EstadoRancho, type Rancho } from "@/app/mi-rancho/types";

export type RanchoConDueno = Rancho & { duenoEmail: string | null };

const ESTADO_LABEL: Record<EstadoRancho, string> = {
  pendiente: "Pendiente",
  aprobado: "Publicado",
  rechazado: "Rechazado",
};

const ESTADO_BADGE: Record<EstadoRancho, string> = {
  pendiente: "bg-aventurea-orange/15 text-aventurea-orange",
  aprobado: "bg-aventurea-green/15 text-aventurea-green",
  rechazado: "bg-red-50 text-red-700",
};

function fmtColones(n: number | null) {
  if (n === null) return "—";
  return "₡" + Number(n).toLocaleString("es-CR");
}

export default function RanchosTable({
  initialRanchos,
}: {
  initialRanchos: RanchoConDueno[];
}) {
  const [ranchos, setRanchos] = useState(initialRanchos);
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranchos
      .filter((r) =>
        !q
          ? true
          : r.nombre.toLowerCase().includes(q) ||
            (r.provincia ?? "").toLowerCase().includes(q) ||
            (r.duenoEmail ?? "").toLowerCase().includes(q),
      )
      .filter((r) => filtro === "todos" || r.estado === filtro);
  }, [ranchos, query, filtro]);

  function cambiarEstado(id: string, estado: EstadoRancho) {
    setError(null);
    startTransition(async () => {
      const res = await setEstadoRancho(id, estado);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRanchos((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado } : r)),
      );
    });
  }

  function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Borrar "${nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await borrarRancho(id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRanchos((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div>
      <div className="mb-4.5 flex flex-wrap gap-2.5">
        <input
          type="search"
          placeholder="Buscar por nombre, provincia o correo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-xs rounded-[10px] border border-aventurea-line bg-white px-3 py-2.5 text-[13px] text-aventurea-ink placeholder:text-zinc-500"
        />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="rounded-[10px] border border-aventurea-line bg-white px-3 py-2.5 text-[13px] text-aventurea-ink"
        >
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Publicados</option>
          <option value="rechazado">Rechazados</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-aventurea-cream-2/60">
              {[
                "Nombre",
                "Categoría",
                "Dueño",
                "Ubicación",
                "Capacidad",
                "Desde",
                "Estado",
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
                  colSpan={8}
                  className="px-4 py-10 text-center text-[13.5px] text-zinc-500"
                >
                  No hay salones que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {list.map((r) => (
              <tr
                key={r.id}
                className="border-b border-aventurea-line last:border-none hover:bg-aventurea-cream-2/40"
              >
                <td className="px-4 py-3.5">
                  <div className="font-bold text-aventurea-ink">{r.nombre}</div>
                  {r.contacto_whatsapp && (
                    <div className="text-xs text-zinc-500">
                      {r.contacto_whatsapp}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {CATEGORIA_LABEL[r.categoria] ?? r.categoria}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {r.duenoEmail ?? "—"}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {r.provincia ?? "—"}
                  {r.canton ? ` · ${r.canton}` : ""}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-aventurea-ink-soft">
                  {r.capacidad_min ?? "?"}–{r.capacidad_max ?? "?"}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-[13px] font-bold text-aventurea-orange">
                  {fmtColones(r.precio_desde)}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO_BADGE[r.estado]}`}
                  >
                    {ESTADO_LABEL[r.estado]}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {r.estado !== "aprobado" && (
                      <button
                        disabled={pending}
                        onClick={() => cambiarEstado(r.id, "aprobado")}
                        className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-green hover:border-aventurea-green disabled:opacity-50"
                      >
                        Publicar
                      </button>
                    )}
                    {r.estado !== "rechazado" && (
                      <button
                        disabled={pending}
                        onClick={() => cambiarEstado(r.id, "rechazado")}
                        className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-400 disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    )}
                    <button
                      disabled={pending}
                      onClick={() => eliminar(r.id, r.nombre)}
                      className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink-soft hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                    >
                      Borrar
                    </button>
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
