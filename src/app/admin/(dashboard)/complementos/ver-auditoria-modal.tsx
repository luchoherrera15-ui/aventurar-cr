"use client";

import { useEffect, useState } from "react";
import { TZ_CR, fmtHoraCR } from "@/lib/fechas";
import { auditoriaDeNegocio, type MiembroDeAuditoria } from "./ver-auditoria-actions";

/**
 * EL MODAL DE "AUDITORÍA", desde admin — SOLO LECTURA.
 *
 * Mismo overlay que ya usan "Ver pase" y "Ver clientes" al lado de este
 * archivo — no un modal nuevo. `max-w-2xl` y superficie clara, como
 * "Ver clientes": acá también va una tabla, no un teléfono.
 *
 * La lista principal es de MIEMBROS (con su saldo); el detalle de cada
 * movimiento —cuánto, por qué, quién y cuándo— se abre por miembro, en
 * el que un admin toca para ver. Con decenas de miembros, mostrar los
 * movimientos de todos a la vez de entrada sería una pared de filas sin
 * ninguna pregunta concreta contestada primero.
 */
export default function VerAuditoriaModal({
  ranchoId,
  nombre,
  onCerrar,
}: {
  ranchoId: string;
  nombre: string;
  onCerrar: () => void;
}) {
  const [estado, setEstado] = useState<
    | { tipo: "cargando" }
    | { tipo: "error"; motivo: string }
    | {
        tipo: "listo";
        miembros: MiembroDeAuditoria[];
        totalMiembros: number;
        miembrosTruncados: boolean;
        movimientosTruncados: boolean;
      }
  >({ tipo: "cargando" });
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    // Igual que "Ver clientes": el padre desmonta este modal al
    // cerrarlo (no lo reusa con otro `ranchoId`), así que el estado
    // inicial ya es "cargando" y no hace falta resetearlo acá.
    let vivo = true;
    auditoriaDeNegocio(ranchoId).then((res) => {
      if (!vivo) return;
      if (res.ok) {
        setEstado({
          tipo: "listo",
          miembros: res.miembros,
          totalMiembros: res.totalMiembros,
          miembrosTruncados: res.miembrosTruncados,
          movimientosTruncados: res.movimientosTruncados,
        });
      } else {
        setEstado({ tipo: "error", motivo: res.motivo });
      }
    });
    return () => {
      vivo = false;
    };
  }, [ranchoId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCerrar}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-aventurea-surface p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
              Auditoría de sellos
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-aventurea-ink">{nombre}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aventurea-cream-2 text-aventurea-ink"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          {estado.tipo === "cargando" && (
            <p className="text-center text-[12.5px] text-aventurea-ink-soft">
              Cargando la auditoría de {nombre}…
            </p>
          )}

          {estado.tipo === "error" && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
              {estado.motivo}
            </p>
          )}

          {estado.tipo === "listo" && estado.miembros.length === 0 && (
            <p className="text-center text-[12.5px] text-aventurea-ink-soft">
              Este negocio todavía no tiene ningún miembro inscrito.
            </p>
          )}

          {estado.tipo === "listo" && estado.miembros.length > 0 && (
            <>
              {estado.miembrosTruncados && (
                <p className="mb-3 rounded-xl bg-aventurea-sky-light px-3 py-2 text-[12px] font-bold text-aventurea-orange-dark">
                  Mostrando los {estado.miembros.length} miembros más nuevos de {estado.totalMiembros}.
                </p>
              )}
              {estado.movimientosTruncados && (
                <p className="mb-3 rounded-xl bg-aventurea-sky-light px-3 py-2 text-[12px] font-bold text-aventurea-orange-dark">
                  Hay más movimientos de los que se pueden traer de una vez: el saldo y el
                  historial de las cuentas más viejas o más activas pueden estar incompletos.
                </p>
              )}

              <ul className="divide-y divide-aventurea-line rounded-xl border border-aventurea-line bg-white">
                {estado.miembros.map((m) => (
                  <li key={m.miembroId}>
                    <button
                      type="button"
                      onClick={() => setAbierto((a) => (a === m.miembroId ? null : m.miembroId))}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] font-bold ${
                          m.sinNombre ? "italic text-aventurea-ink-soft" : "text-aventurea-ink"
                        }`}
                      >
                        {m.nombre}
                      </span>
                      <span className="shrink-0 text-[12.5px] font-bold text-aventurea-ink">
                        {m.saldo} pt{m.saldo === 1 ? "" : "s"}
                      </span>
                      <span className="hidden shrink-0 text-[11px] text-aventurea-ink-soft sm:inline">
                        {m.movimientos.length} movimiento{m.movimientos.length === 1 ? "" : "s"}
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-aventurea-ink-soft">
                        {abierto === m.miembroId ? "▲" : "▼"}
                      </span>
                    </button>

                    {abierto === m.miembroId && (
                      <div className="border-t border-aventurea-line bg-aventurea-cream-2/40 px-3.5 py-2.5">
                        {m.movimientos.length === 0 ? (
                          <p className="text-[12px] text-aventurea-ink-soft">
                            Sin movimientos registrados.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px] text-left text-[12px]">
                              <thead className="text-[10.5px] uppercase tracking-[0.08em] text-aventurea-ink-soft">
                                <tr>
                                  <th className="py-1 pr-3 font-bold">Cuándo</th>
                                  <th className="py-1 pr-3 font-bold">Puntos</th>
                                  <th className="py-1 pr-3 font-bold">Motivo</th>
                                  <th className="py-1 pr-3 font-bold">Quién</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.movimientos.map((mv) => (
                                  <tr key={mv.id} className="border-t border-aventurea-line/70">
                                    <td className="whitespace-nowrap py-1.5 pr-3 text-aventurea-ink-soft">
                                      {fechaHoraCR(mv.fecha)}
                                    </td>
                                    <td
                                      className={`py-1.5 pr-3 font-bold ${
                                        mv.puntos < 0 ? "text-red-700" : "text-aventurea-green"
                                      }`}
                                    >
                                      {mv.puntos > 0 ? `+${mv.puntos}` : mv.puntos}
                                    </td>
                                    <td className="py-1.5 pr-3 text-aventurea-ink">{mv.motivo}</td>
                                    <td className="py-1.5 pr-3 text-aventurea-ink-soft">
                                      {mv.porQuien ?? "sistema"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="presionable mt-5 w-full rounded-xl border border-aventurea-line bg-white px-4 py-2.5 text-[13px] font-bold text-aventurea-navy"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

/**
 * Fecha y hora exactas de un movimiento, en hora de Costa Rica —
 * `fmtHoraCR` para la hora, y `TZ_CR` (no un string a mano) para que la
 * fecha se lea desde la misma zona. Nunca `Date.toISOString()` directo:
 * ese fue justo el bug de zona horaria de esta misma noche.
 */
function fechaHoraCR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const fecha = d.toLocaleDateString("es-CR", {
    timeZone: TZ_CR,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${fecha} · ${fmtHoraCR(d)}`;
}
