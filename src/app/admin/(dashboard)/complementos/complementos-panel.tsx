"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ADDONS,
  DURACIONES,
  estadoDeAddon,
  type AddonId,
  type EstadoAddon,
} from "@/lib/addons";
import { activarAddon, desactivarAddon } from "./actions";
import { asignarPlanLealtad } from "./plan-actions";
import { estadoDelLimite, PLANES, PLANES_ID } from "@/lib/lealtad/planes";

export type FilaAddon = {
  rancho_id: string;
  addon: string;
  activo: boolean;
  vence_en: string | null;
  notas: string | null;
  activado_en: string | null;
};

export type NegocioConAddons = {
  id: string;
  nombre: string;
  slug: string | null;
  vertical: string | null;
  estado: string | null;
  addons: FilaAddon[];
  /** Plan de la plataforma de lealtad (0124). null = sin plan. */
  planLealtad: string | null;
  /** Miembros afiliados, para comparar contra el tope del plan. */
  miembros: number;
};

const CHIP: Record<EstadoAddon, string> = {
  activo: "bg-aventurea-green-light text-aventurea-green",
  vencido: "bg-aventurea-sky-light text-aventurea-orange-dark",
  apagado: "bg-aventurea-cream-2 text-aventurea-ink-soft",
};

const ETIQUETA: Record<EstadoAddon, string> = {
  activo: "Activo",
  vencido: "Vencido",
  apagado: "Sin contratar",
};

/** "2026-12-31T…" → "31/12/2026". */
function fechaCorta(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("es-CR");
}

/** Cuántos días faltan para que venza (negativo = ya venció). */
function diasPara(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

/**
 * La tabla de complementos por negocio.
 *
 * Por defecto muestra solo los negocios que tienen algo contratado
 * (activo o vencido) — que es la pregunta de todos los días: quién lo
 * tiene y a quién se le vence. Para darle uno a un negocio nuevo se
 * busca por nombre y aparece aunque no tenga nada.
 */
export default function ComplementosPanel({
  negocios,
}: {
  negocios: NegocioConAddons[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [soloConAlgo, setSoloConAlgo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  // La duración y la nota elegidas por celda (negocio+complemento).
  const [duracion, setDuracion] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<Record<string, string>>({});

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return negocios.filter((n) => {
      if (q) return n.nombre.toLowerCase().includes(q) || (n.slug ?? "").includes(q);
      if (!soloConAlgo) return true;
      return n.addons.some((a) => estadoDeAddon(a) !== "apagado");
    });
  }, [negocios, busqueda, soloConAlgo]);

  function clave(ranchoId: string, addon: string) {
    return `${ranchoId}:${addon}`;
  }

  function activar(negocio: NegocioConAddons, addon: AddonId) {
    const k = clave(negocio.id, addon);
    const elegida = DURACIONES.find((d) => d.id === (duracion[k] ?? "1"));
    setError(null);
    startTransition(async () => {
      const res = await activarAddon({
        ranchoId: negocio.id,
        addon,
        meses: elegida?.meses ?? 1,
        notas: nota[k] ?? "",
      });
      if (res.error) setError(res.error);
      else setNota((prev) => ({ ...prev, [k]: "" }));
    });
  }

  function quitar(negocio: NegocioConAddons, addon: AddonId) {
    if (
      !window.confirm(
        `¿Quitarle "${addon}" a ${negocio.nombre}? Deja de funcionarle de inmediato.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await desactivarAddon(negocio.id, addon);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3.5 text-[13px] text-red-700">{error}</p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar un negocio por nombre…"
          className="min-w-[260px] flex-1 rounded-[10px] border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400"
        />
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-aventurea-ink-soft">
          <input
            type="checkbox"
            checked={soloConAlgo}
            onChange={(e) => setSoloConAlgo(e.target.checked)}
            className="h-4 w-4 accent-aventurea-navy"
          />
          Solo los que tienen algo
        </label>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border border-aventurea-line bg-white p-8 text-center text-[13.5px] text-aventurea-ink-soft">
          {busqueda
            ? "Ningún negocio con ese nombre."
            : "Todavía ningún negocio tiene complementos. Buscá uno por nombre para darle el primero."}
        </p>
      ) : (
        <div className="space-y-3">
          {visibles.map((negocio) => (
            <div
              key={negocio.id}
              className="rounded-2xl border border-aventurea-line bg-white p-5"
            >
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <h3 className="text-[15px] font-bold text-aventurea-ink">
                  {negocio.nombre}
                </h3>
                {negocio.estado !== "aprobado" && (
                  <span className="rounded-full bg-aventurea-cream-2 px-2.5 py-0.5 text-[11px] font-bold text-aventurea-ink-soft">
                    {negocio.estado ?? "sin estado"}
                  </span>
                )}
              </div>

              <PlanDeLealtad negocio={negocio} />

              <div className="mt-3.5 grid gap-3 lg:grid-cols-3">
                {ADDONS.map((def) => {
                  const fila =
                    negocio.addons.find((a) => a.addon === def.id) ?? null;
                  const estado = estadoDeAddon(fila);
                  const k = clave(negocio.id, def.id);
                  const vence = fechaCorta(fila?.vence_en ?? null);
                  const dias = diasPara(fila?.vence_en ?? null);

                  return (
                    <div
                      key={def.id}
                      className="rounded-xl border border-aventurea-line bg-aventurea-cream-2/40 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-aventurea-ink">
                          {def.nombre}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${CHIP[estado]}`}
                        >
                          {ETIQUETA[estado]}
                        </span>
                      </div>

                      {/* Vigencia: lo que de verdad se consulta a diario. */}
                      {estado !== "apagado" && (
                        <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
                          {vence
                            ? estado === "vencido"
                              ? `Venció el ${vence}`
                              : `Vence el ${vence}${dias !== null && dias <= 15 ? ` · faltan ${dias} día${dias === 1 ? "" : "s"}` : ""}`
                            : "Sin vencimiento"}
                        </p>
                      )}
                      {fila?.notas && (
                        <p className="mt-1 text-[12px] italic text-aventurea-ink-soft">
                          {fila.notas}
                        </p>
                      )}

                      {/* Activar / renovar */}
                      <div className="mt-3 space-y-2">
                        <select
                          value={duracion[k] ?? "1"}
                          onChange={(e) =>
                            setDuracion((prev) => ({ ...prev, [k]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink"
                        >
                          {DURACIONES.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={nota[k] ?? ""}
                          onChange={(e) =>
                            setNota((prev) => ({ ...prev, [k]: e.target.value }))
                          }
                          placeholder="Nota (ej. pagó SINPE 2/8)"
                          className="w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink placeholder:text-zinc-400"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={pendiente}
                            onClick={() => activar(negocio, def.id)}
                            className="flex-1 rounded-lg bg-aventurea-navy px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-aventurea-navy-2 disabled:opacity-50"
                          >
                            {estado === "apagado" ? "Activar" : "Renovar"}
                          </button>
                          {estado !== "apagado" && (
                            <button
                              type="button"
                              disabled={pendiente}
                              onClick={() => quitar(negocio, def.id)}
                              className="rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * El plan de la plataforma de lealtad de un negocio (0124).
 *
 * Va junto a los complementos porque es lo mismo: qué contrató. La
 * diferencia es que el plan trae un paquete de capacidades y un tope de
 * miembros, mientras que un complemento abre una sola cosa.
 *
 * El tope NO se guarda en la base: sale de la definición del plan y se
 * compara contra los miembros contados. Por eso acá se ve al instante
 * si un negocio se está quedando corto.
 */
function PlanDeLealtad({ negocio }: { negocio: NegocioConAddons }) {
  const [plan, setPlan] = useState(negocio.planLealtad);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const limite = estadoDelLimite(plan, negocio.miembros);

  function cambiar(nuevo: string) {
    const valor = nuevo || null;
    const anterior = plan;
    setPlan(valor);
    setError(null);
    iniciar(async () => {
      const res = await asignarPlanLealtad({ ranchoId: negocio.id, plan: valor });
      if (res.error) {
        setError(res.error);
        setPlan(anterior); // se devuelve a lo que de verdad está guardado
      }
    });
  }

  return (
    <div className="mt-3.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Programa de lealtad
        </span>

        <select
          value={plan ?? ""}
          onChange={(e) => cambiar(e.target.value)}
          disabled={pendiente}
          className="rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] font-bold text-aventurea-ink"
        >
          <option value="">Sin plan</option>
          {PLANES_ID.map((id) => (
            <option key={id} value={id}>
              {PLANES[id].nombre} · {PLANES[id].limiteMiembros?.toLocaleString("es-CR")} miembros
            </option>
          ))}
        </select>

        {plan && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              limite.lleno
                ? "bg-red-50 text-red-700"
                : limite.cerca
                  ? "bg-aventurea-sky-light text-aventurea-orange-dark"
                  : "bg-aventurea-cream-2 text-aventurea-ink-soft"
            }`}
          >
            {negocio.miembros.toLocaleString("es-CR")} de{" "}
            {limite.limite?.toLocaleString("es-CR")} miembros
            {limite.lleno ? " · lleno" : limite.cerca ? " · casi lleno" : ""}
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-[12px] font-bold text-red-700">{error}</p>}

      {plan && limite.cerca && !limite.lleno && (
        <p className="mt-2 text-[12px] leading-snug text-aventurea-ink-soft">
          Le queda poco espacio. Conviene ofrecerle el plan siguiente antes de que se tope:
          al llenarse, un cliente nuevo no se puede afiliar.
        </p>
      )}
    </div>
  );
}
