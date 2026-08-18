"use client";

import { useEffect, useState } from "react";
import { haceCuanto } from "@/lib/fechas";
import { verClientesDeNegocio, type ClienteDeAdmin } from "./ver-clientes-actions";

/**
 * EL MODAL DE "VER CLIENTES", desde admin — SOLO LECTURA.
 *
 * Mismo overlay que ya usa `ranchos-table.tsx` (y que reusa también
 * `ver-pase-modal.tsx` al lado de este archivo) — no un modal nuevo.
 * `max-w-2xl`: acá adentro va una tabla, no un teléfono, así que usa la
 * superficie clara de siempre en vez de la navy oscura del pase.
 */
export default function VerClientesModal({
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
    | { tipo: "listo"; clientes: ClienteDeAdmin[]; total: number; truncado: boolean }
  >({ tipo: "cargando" });

  useEffect(() => {
    // Igual que en "Ver pase": el padre desmonta este modal al
    // cerrarlo (no lo reusa con otro `ranchoId`), así que el estado
    // inicial ya es "cargando" y no hace falta resetearlo acá.
    let vivo = true;
    verClientesDeNegocio(ranchoId).then((res) => {
      if (!vivo) return;
      if (res.ok) {
        setEstado({ tipo: "listo", clientes: res.clientes, total: res.total, truncado: res.truncado });
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
              Clientes inscritos
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
              Cargando los clientes de {nombre}…
            </p>
          )}

          {estado.tipo === "error" && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
              {estado.motivo}
            </p>
          )}

          {estado.tipo === "listo" && estado.clientes.length === 0 && (
            <p className="text-center text-[12.5px] text-aventurea-ink-soft">
              Este negocio todavía no tiene ningún cliente inscrito.
            </p>
          )}

          {estado.tipo === "listo" && estado.clientes.length > 0 && (
            <>
              {estado.truncado && (
                <p className="mb-3 rounded-xl bg-aventurea-sky-light px-3 py-2 text-[12px] font-bold text-aventurea-orange-dark">
                  Mostrando los primeros {estado.clientes.length} de {estado.total} clientes.
                </p>
              )}

              <div className="overflow-x-auto rounded-xl border border-aventurea-line">
                <table className="w-full min-w-[560px] text-left text-[12.5px]">
                  <thead className="bg-aventurea-cream-2 text-[10.5px] uppercase tracking-[0.1em] text-aventurea-ink-soft">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">Nombre</th>
                      <th className="px-3 py-2.5 font-bold">Contacto</th>
                      <th className="px-3 py-2.5 font-bold">Saldo</th>
                      <th className="px-3 py-2.5 font-bold">Pase</th>
                      <th className="px-3 py-2.5 font-bold">Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estado.clientes.map((c) => (
                      <tr key={c.miembroId} className="border-t border-aventurea-line">
                        <td className={`px-3 py-2.5 ${c.sinNombre ? "italic text-aventurea-ink-soft" : "font-bold text-aventurea-ink"}`}>
                          {c.nombre}
                        </td>
                        <td className="px-3 py-2.5 text-aventurea-ink-soft">
                          {c.contacto.length > 0 ? c.contacto.join(" · ") : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-aventurea-ink">{c.saldo}</td>
                        <td className="px-3 py-2.5">
                          {c.conPase ? (
                            <span className="rounded-full bg-aventurea-green-light px-2 py-0.5 text-[11px] font-bold text-aventurea-green">
                              En el teléfono
                            </span>
                          ) : (
                            <span className="text-aventurea-ink-soft">—</span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2.5 text-aventurea-ink-soft"
                          title={c.altaEn ? fechaExacta(c.altaEn) : undefined}
                        >
                          {c.altaEn ? (haceCuanto(c.altaEn) ?? fechaExacta(c.altaEn)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
 * Fecha exacta para el `title=`, local a este modal a propósito: no
 * importa nada de `complementos-panel.tsx` (que no exporta ningún
 * formateador para consumo externo), y las funciones de fecha CORTA de
 * `@/lib/fechas` (`fmtFechaCorta`, `fechaLargaCR`) esperan un ISO de
 * solo fecha ("YYYY-MM-DD") — `miembros.created_at` es un timestamp
 * completo, y partirlo con esas funciones da NaN.
 */
function fechaExacta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });
}
