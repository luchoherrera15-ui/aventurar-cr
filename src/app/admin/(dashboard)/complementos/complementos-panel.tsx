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
import { perteneceASeccion, SECCION_CORTA, SECCION_LABEL, type SeccionAdmin } from "../vertical";

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
 * Qué tiene contratado cada negocio, agrupado por su categoría.
 *
 * Es una lista compacta y no una pila de tarjetas grandes: con veinte
 * negocios abiertos a la vez no se encuentra a nadie. Se elige uno y
 * ahí se le configura todo — plan y complementos en la misma vista.
 *
 * Salen TODOS los negocios, tengan o no algo contratado. La versión
 * anterior escondía por defecto a los que no tenían nada, que son
 * justo a los que hay que venderles el primer plan: un negocio nuevo
 * quedaba invisible en la única pantalla desde donde se le puede
 * activar algo.
 */
export default function ComplementosPanel({
  negocios,
  seccion,
}: {
  negocios: NegocioConAddons[];
  /** Sección activa del panel (cookie admin_seccion). */
  seccion: SeccionAdmin;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [soloSeccion, setSoloSeccion] = useState(seccion !== "todas");
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [duracion, setDuracion] = useState<Record<string, string>>({});
  const [nota, setNota] = useState<Record<string, string>>({});

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    // Buscar IGNORA la sección: si alguien escribe el nombre de un
    // negocio, lo está buscando, no filtrando. Que no aparezca por
    // culpa de una cookie de otra pantalla es el peor resultado
    // posible — parece que el negocio no existe.
    if (q) {
      return negocios.filter(
        (n) => n.nombre.toLowerCase().includes(q) || (n.slug ?? "").includes(q),
      );
    }
    if (!soloSeccion || seccion === "todas") return negocios;
    return negocios.filter((n) => perteneceASeccion(n.vertical, seccion));
  }, [negocios, busqueda, soloSeccion, seccion]);

  const ocultos = negocios.length - filtrados.length;

  // Agrupados por categoría, con la categoría en orden alfabético para
  // que la lista no baile entre cargas.
  const porCategoria = useMemo(() => {
    const mapa = new Map<string, NegocioConAddons[]>();
    for (const n of filtrados) {
      const cat = SECCION_CORTA[n.vertical ?? ""] ?? "Sin categoría";
      mapa.set(cat, [...(mapa.get(cat) ?? []), n]);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtrados]);

  const negocio = negocios.find((n) => n.id === elegido) ?? null;

  function clave(ranchoId: string, addon: string) {
    return `${ranchoId}:${addon}`;
  }

  function activar(n: NegocioConAddons, addon: AddonId) {
    const k = clave(n.id, addon);
    const elegida = DURACIONES.find((d) => d.id === (duracion[k] ?? "1"));
    setError(null);
    startTransition(async () => {
      const res = await activarAddon({
        ranchoId: n.id,
        addon,
        meses: elegida?.meses ?? 1,
        notas: nota[k] ?? "",
      });
      if (res.error) setError(res.error);
      else setNota((prev) => ({ ...prev, [k]: "" }));
    });
  }

  function quitar(n: NegocioConAddons, addon: AddonId) {
    if (
      !window.confirm(`¿Quitarle "${addon}" a ${n.nombre}? Deja de funcionarle de inmediato.`)
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await desactivarAddon(n.id, addon);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3.5 text-[13px] text-red-700">{error}</p>
      )}

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar un negocio por nombre… (busca en todas las secciones)"
        className="w-full rounded-[10px] border border-aventurea-line bg-white px-3.5 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400"
      />

      {/* Qué se está ocultando y cómo verlo. Un filtro que esconde sin
          decirlo hace creer que el negocio no existe. */}
      <div className="mb-5 mt-2 flex flex-wrap items-center gap-3 text-[12.5px]">
        {!busqueda.trim() && seccion !== "todas" && (
          <label className="flex cursor-pointer items-center gap-2 font-bold text-aventurea-ink-soft">
            <input
              type="checkbox"
              checked={soloSeccion}
              onChange={(e) => setSoloSeccion(e.target.checked)}
              className="h-4 w-4 accent-aventurea-navy"
            />
            Solo {SECCION_LABEL[seccion]}
            {soloSeccion && ocultos > 0 && (
              <span className="font-normal text-aventurea-ink-soft">
                — {ocultos} negocio{ocultos === 1 ? "" : "s"} de otras secciones oculto
                {ocultos === 1 ? "" : "s"}
              </span>
            )}
          </label>
        )}
        <span className="text-aventurea-ink-soft">
          {filtrados.length} negocio{filtrados.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* ── La lista, por categoría ─────────────────────────── */}
        <div className="space-y-4">
          {porCategoria.length === 0 ? (
            <p className="rounded-2xl border border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
              Ningún negocio con ese nombre.
            </p>
          ) : (
            porCategoria.map(([categoria, lista]) => (
              <div key={categoria}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft">
                  {categoria} · {lista.length}
                </p>
                <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-white">
                  {lista.map((n, i) => {
                    const activos = n.addons.filter(
                      (a) => estadoDeAddon(a) === "activo",
                    ).length;
                    const plan = PLANES_ID.includes(n.planLealtad as never)
                      ? PLANES[n.planLealtad as keyof typeof PLANES]
                      : null;

                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setElegido(n.id)}
                        className={`flex w-full items-center gap-2 px-4 py-3 text-left ${
                          i > 0 ? "border-t border-aventurea-line" : ""
                        } ${
                          elegido === n.id
                            ? "bg-aventurea-navy text-white"
                            : "hover:bg-aventurea-cream-2"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-[13.5px] font-bold ${
                              elegido === n.id ? "text-white" : "text-aventurea-ink"
                            }`}
                          >
                            {n.nombre}
                          </span>
                          <span
                            className={`block text-[11.5px] ${
                              elegido === n.id ? "text-white/70" : "text-aventurea-ink-soft"
                            }`}
                          >
                            {plan ? plan.nombre : "Sin plan"}
                            {activos > 0 ? ` · ${activos} complemento${activos === 1 ? "" : "s"}` : ""}
                          </span>
                        </span>
                        {(plan || activos > 0) && (
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              elegido === n.id ? "bg-white" : "bg-aventurea-green"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── El detalle del elegido ──────────────────────────── */}
        {!negocio ? (
          <div className="rounded-2xl border border-dashed border-aventurea-line bg-white p-10 text-center">
            <p className="text-[13.5px] text-aventurea-ink-soft">
              Elegí un negocio de la lista para ver y cambiar lo que tiene contratado.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-aventurea-line bg-white p-5">
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <h3 className="text-[17px] font-bold text-aventurea-ink">{negocio.nombre}</h3>
              <span className="rounded-full bg-aventurea-cream-2 px-2.5 py-0.5 text-[11px] font-bold text-aventurea-ink-soft">
                {SECCION_CORTA[negocio.vertical ?? ""] ?? "sin categoría"}
              </span>
              {negocio.estado !== "aprobado" && (
                <span className="rounded-full bg-aventurea-sky-light px-2.5 py-0.5 text-[11px] font-bold text-aventurea-orange-dark">
                  {negocio.estado ?? "sin estado"}
                </span>
              )}
            </div>

            <PlanDeLealtad negocio={negocio} />

            <p className="mt-5 mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft">
              Complementos sueltos
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {ADDONS.map((def) => {
                const fila = negocio.addons.find((a) => a.addon === def.id) ?? null;
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

                    <p className="mt-1 text-[11.5px] leading-snug text-aventurea-ink-soft">
                      {def.resumen}
                    </p>

                    {estado !== "apagado" && (
                      <p className="mt-1.5 text-[12px] text-aventurea-ink-soft">
                        {vence
                          ? estado === "vencido"
                            ? `Venció el ${vence}`
                            : `Vence el ${vence}${dias !== null && dias <= 15 ? ` · faltan ${dias} días` : ""}`
                          : "Sin vencimiento"}
                      </p>
                    )}
                    {fila?.notas && (
                      <p className="mt-1 text-[11.5px] italic text-aventurea-ink-soft">
                        {fila.notas}
                      </p>
                    )}

                    <select
                      value={duracion[k] ?? "1"}
                      onChange={(e) =>
                        setDuracion((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                      className="mt-2.5 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink"
                    >
                      {DURACIONES.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>

                    <input
                      value={nota[k] ?? ""}
                      onChange={(e) => setNota((prev) => ({ ...prev, [k]: e.target.value }))}
                      placeholder="Nota (ej. pagó SINPE 2/8)"
                      className="mt-2 w-full rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[12.5px] text-aventurea-ink placeholder:text-zinc-400"
                    />

                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => activar(negocio, def.id)}
                        disabled={pendiente}
                        className="flex-1 rounded-lg bg-aventurea-navy px-3 py-2 text-[12.5px] font-bold text-white disabled:opacity-40"
                      >
                        {estado === "apagado" ? "Activar" : "Renovar"}
                      </button>
                      {estado !== "apagado" && (
                        <button
                          type="button"
                          onClick={() => quitar(negocio, def.id)}
                          disabled={pendiente}
                          className="rounded-lg border border-aventurea-line bg-white px-3 py-2 text-[12.5px] font-bold text-aventurea-ink-soft disabled:opacity-40"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * El plan de la plataforma de lealtad de un negocio (0124).
 *
 * Va PRIMERO en el detalle y separado de los complementos porque no es
 * uno más: trae un paquete de capacidades y un tope de miembros,
 * mientras que un complemento abre una sola cosa. Mezclarlo entre las
 * tarjetas hacía parecer que se compraba igual que los otros.
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
    <div className="mt-4 rounded-xl border border-aventurea-navy/25 bg-aventurea-navy/[0.04] px-4 py-3.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-aventurea-navy">
        Programa de lealtad
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <select
          value={plan ?? ""}
          onChange={(e) => cambiar(e.target.value)}
          disabled={pendiente}
          className="rounded-lg border border-aventurea-line bg-white px-2.5 py-1.5 text-[13px] font-bold text-aventurea-ink"
        >
          <option value="">Sin plan</option>
          {PLANES_ID.map((id) => (
            <option key={id} value={id}>
              {PLANES[id].nombre} · hasta{" "}
              {PLANES[id].limiteMiembros?.toLocaleString("es-CR")} miembros
            </option>
          ))}
        </select>

        {plan && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
              limite.lleno
                ? "bg-red-50 text-red-700"
                : limite.cerca
                  ? "bg-aventurea-sky-light text-aventurea-orange-dark"
                  : "bg-white text-aventurea-ink-soft"
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
