"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type NegocioComplementos = {
  id: string;
  nombre: string;
  slug: string | null;
  categoria: string | null;
  estado: string;
  addons: {
    addon: string;
    activo: boolean;
    venceEn: string | null;
    concepto: string | null;
  }[];
};

type Catalogo = { id: string; nombre: string; resumen: string }[];

/**
 * ════════════════════════════════════════════════════════════════════
 *  QUÉ NEGOCIO TIENE ENCENDIDO CADA COMPLEMENTO
 * ════════════════════════════════════════════════════════════════════
 *
 * La tabla que quedó en `/admin/complementos` después de mudar todo lo
 * de Lealtad a su propia sección (27 ago 2026).
 *
 * ── ES DE LECTURA, Y ESO ES A PROPÓSITO ─────────────────────────────
 *
 * Prender y apagar un complemento sigue viviendo en el panel de cada
 * negocio, que es donde está el contexto para decidirlo: su plan, lo
 * que paga y desde cuándo. Una fila de una tabla de cincuenta negocios
 * no tiene ninguna de esas tres cosas a la vista, y un interruptor sin
 * contexto se toca por error.
 *
 * Lo que ESTA pantalla contesta —y ninguna otra contestaba— es la
 * pregunta al revés: «¿quiénes tienen el Asistente IA?». Antes había
 * que abrir negocio por negocio.
 */
export default function ComplementosTabla({
  negocios,
  catalogo,
}: {
  negocios: NegocioComplementos[];
  catalogo: Catalogo;
}) {
  const [soloCon, setSoloCon] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return negocios.filter((n) => {
      if (q && !n.nombre.toLowerCase().includes(q)) return false;
      if (soloCon) {
        const a = n.addons.find((x) => x.addon === soloCon);
        if (!a || !a.activo) return false;
      }
      return true;
    });
  }, [negocios, busqueda, soloCon]);

  /** Cuántos negocios tienen cada complemento encendido. */
  const conteo = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of catalogo) {
      m[c.id] = negocios.filter(
        (n) => n.addons.find((a) => a.addon === c.id)?.activo,
      ).length;
    }
    return m;
  }, [negocios, catalogo]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar negocio"
          className="h-10 w-full max-w-[280px] rounded-xl border border-aventurea-line bg-white px-3 text-[13.5px]"
        />
        <button
          type="button"
          onClick={() => setSoloCon(null)}
          className={`rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
            soloCon === null
              ? "bg-aventurea-navy text-white"
              : "border border-aventurea-line text-aventurea-ink-soft"
          }`}
        >
          Todos ({negocios.length})
        </button>
        {catalogo.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSoloCon(soloCon === c.id ? null : c.id)}
            className={`rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
              soloCon === c.id
                ? "bg-aventurea-navy text-white"
                : "border border-aventurea-line text-aventurea-ink-soft"
            }`}
          >
            {c.nombre} ({conteo[c.id] ?? 0})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-aventurea-line bg-aventurea-surface">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-aventurea-line bg-aventurea-cream-2/50 text-left text-[11px] uppercase tracking-[0.1em] text-aventurea-ink-soft">
              <th className="px-3 py-2.5 font-bold">Negocio</th>
              {catalogo.map((c) => (
                <th key={c.id} className="px-3 py-2.5 font-bold" title={c.resumen}>
                  {c.nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((n) => (
              <tr key={n.id} className="border-b border-aventurea-line/60 last:border-0">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/mi-negocio/${n.id}`}
                    className="font-bold text-aventurea-ink hover:underline"
                  >
                    {n.nombre}
                  </Link>
                  <span className="ml-2 text-[11.5px] text-aventurea-ink-soft">
                    {n.estado}
                  </span>
                </td>
                {catalogo.map((c) => {
                  const a = n.addons.find((x) => x.addon === c.id);
                  const on = Boolean(a?.activo);
                  return (
                    <td key={c.id} className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase tracking-wide ring-1 ring-inset ${
                          on
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                            : "bg-slate-100 text-slate-500 ring-slate-500/20"
                        }`}
                      >
                        {on ? "Encendido" : "Apagado"}
                      </span>
                      {/* El «por qué» solo cuando lo hay: una cortesía o
                          una prueba explican una fila que si no parece
                          un error de cobro. */}
                      {on && a?.concepto && (
                        <span className="ml-2 text-[11.5px] text-aventurea-ink-soft">
                          {a.concepto}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibles.length === 0 && (
        <p className="mt-4 rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-6 text-center text-[13.5px] text-aventurea-ink-soft">
          Ningún negocio calza con ese filtro.
        </p>
      )}
    </div>
  );
}
