"use client";

import { InvitacionHistorial } from "@/lib/tipos/invitaciones";

interface HistorialProps {
  invitaciones: InvitacionHistorial[];
  /** Recibe el SLUG (la ruta pública es /i/[slug], no /i/[id]). */
  onAbrir?: (slug: string) => void;
}

export default function Historial({ invitaciones, onAbrir }: HistorialProps) {
  if (!invitaciones || invitaciones.length === 0) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-6 text-center">
        <p className="text-[13px] text-aventurea-ink-soft">
          Aún no has generado ninguna invitación. ¡Comenzá ahora!
        </p>
      </div>
    );
  }

  function formatFecha(fecha: string): string {
    return new Date(fecha).toLocaleString("es-CR", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function estadoColor(estado: string | null): string {
    switch (estado) {
      case "completado":
        return "bg-green-100 text-green-700 border-green-200";
      case "generando":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "error":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  function estadoLabel(estado: string | null): string {
    switch (estado) {
      case "completado":
        return "✓ Completado";
      case "generando":
        return "⏳ Generando";
      case "error":
        return "✕ Error";
      case "pendiente":
        return "⊙ Pendiente";
      default:
        return "—";
    }
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-white overflow-hidden">
      <div className="border-b border-aventurea-line bg-aventurea-cream-2 px-5 py-3">
        <h3 className="text-[13px] font-bold text-aventurea-ink">📊 Historial de invitaciones</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-aventurea-line bg-aventurea-cream-2">
            <tr>
              <th className="px-5 py-3 font-bold text-aventurea-ink">Título</th>
              <th className="px-5 py-3 font-bold text-aventurea-ink">Modelo</th>
              <th className="px-5 py-3 font-bold text-aventurea-ink">Tokens</th>
              <th className="px-5 py-3 font-bold text-aventurea-ink text-right">Costo</th>
              <th className="px-5 py-3 font-bold text-aventurea-ink">Estado</th>
              <th className="px-5 py-3 font-bold text-aventurea-ink">Fecha</th>
              <th className="px-5 py-3 font-bold text-aventurea-ink">Acción</th>
            </tr>
          </thead>
          <tbody>
            {invitaciones.map((inv) => {
              const slug = inv.slug;
              return (
              <tr key={inv.id} className="border-b border-aventurea-line hover:bg-aventurea-cream-2">
                <td className="px-5 py-3 font-semibold text-aventurea-ink truncate max-w-xs">
                  {inv.titulo}
                </td>
                <td className="px-5 py-3 text-aventurea-ink-soft">
                  {inv.modelo_usado ? inv.modelo_usado.toUpperCase() : "—"}
                </td>
                <td className="px-5 py-3 text-aventurea-ink-soft">
                  {inv.costo_tokens_input
                    ? `${(inv.costo_tokens_input + (inv.costo_tokens_output || 0)).toLocaleString("es-CR")}`
                    : "—"}
                </td>
                <td className="px-5 py-3 text-right font-bold text-aventurea-ink">
                  {inv.costo_usd ? `$${inv.costo_usd.toFixed(4)}` : "—"}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${estadoColor(inv.estado_generacion)}`}
                  >
                    {estadoLabel(inv.estado_generacion)}
                  </span>
                </td>
                <td className="px-5 py-3 text-aventurea-ink-soft text-[11px]">
                  {formatFecha(inv.created_at)}
                </td>
                <td className="px-5 py-3">
                  {inv.estado_generacion === "completado" && slug && (
                    <button
                      onClick={() => onAbrir?.(slug)}
                      className="text-aventurea-navy font-semibold hover:underline text-[11px]"
                    >
                      Ver
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
