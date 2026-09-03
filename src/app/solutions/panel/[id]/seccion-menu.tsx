"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ROTULO_CAMPO } from "@/components/panel/sistema";
import SubirImagen from "@/components/subir-imagen";
import { fmtColones } from "@/lib/finanzas";
import type { MenuDelNegocio } from "@/lib/solutions/datos";
import { TOPES, type ItemMenuSolutions } from "@/lib/solutions/tipos";
import {
  borrarPlatoSolutions,
  borrarSeccionSolutions,
  guardarPlatoSolutions,
  guardarSeccionSolutions,
  marcarAgotadoSolutions,
  ordenarSeccionesSolutions,
} from "./actions";

/**
 * LA CARTA — secciones y platos.
 *
 * Cada cambio se guarda al momento (no hay un «Guardar todo»): un
 * restaurante edita un plato a la vez, entre servicio y servicio, y
 * tiene que ver el resultado ya. `router.refresh()` trae los datos
 * frescos del servidor después de cada action.
 */
export default function SeccionMenu({ negocioId, menu }: { negocioId: string; menu: MenuDelNegocio }) {
  const router = useRouter();
  const [ocupado, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nuevaSeccion, setNuevaSeccion] = useState("");
  const [editando, setEditando] = useState<Partial<ItemMenuSolutions> & { seccion_id: string | null } | null>(null);

  const correr = (fn: () => Promise<{ ok: boolean; motivo?: string }>) => {
    setError(null);
    arrancar(async () => {
      const r = await fn();
      if (!r.ok) setError(r.motivo ?? "No se pudo guardar.");
      else router.refresh();
    });
  };

  const guardarPlato = () => {
    if (!editando) return;
    const e = editando;
    correr(async () => {
      const r = await guardarPlatoSolutions(negocioId, {
        id: e.id ?? null,
        seccionId: e.seccion_id ?? null,
        nombre: e.nombre ?? "",
        descripcion: e.descripcion ?? "",
        precio: e.precio === undefined || e.precio === null || Number.isNaN(Number(e.precio)) ? null : Number(e.precio),
        fotoUrl: e.foto_url ?? "",
        disponible: e.disponible !== false,
      });
      if (r.ok) setEditando(null);
      return r;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-xl bg-red-50 p-3 text-[13px] font-bold text-red-700">{error}</p>}

      {/* ── Secciones ─────────────────────────────────────────── */}
      <Card eyebrow="Cómo se ordena" titulo="Secciones" accion={<PildoraEstado estado="neutro">{menu.secciones.length} de {TOPES.secciones}</PildoraEstado>}>
        <ul className="flex flex-col gap-2">
          {menu.secciones.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 rounded-xl border border-aventurea-line p-2">
              <input
                type="text"
                defaultValue={s.nombre}
                maxLength={TOPES.seccionNombre}
                aria-label="Nombre de la sección"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== s.nombre) correr(() => guardarSeccionSolutions(negocioId, { id: s.id, nombre: v }));
                }}
                className={`min-w-0 flex-1 ${CAMPO_PANEL}`}
              />
              <span className="text-[11.5px] text-aventurea-ink-soft">{menu.items.filter((it) => it.seccion_id === s.id).length} platos</span>
              <button type="button" aria-label="Subir" disabled={i === 0 || ocupado} onClick={() => { const ids = menu.secciones.map((x) => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; correr(() => ordenarSeccionesSolutions(negocioId, ids)); }} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">↑</button>
              <button type="button" aria-label="Bajar" disabled={i === menu.secciones.length - 1 || ocupado} onClick={() => { const ids = menu.secciones.map((x) => x.id); [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]]; correr(() => ordenarSeccionesSolutions(negocioId, ids)); }} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">↓</button>
              <button type="button" aria-label="Borrar sección" disabled={ocupado} onClick={() => { if (confirm(`¿Borrar la sección «${s.nombre}»? Los platos pasan a «Otros».`)) correr(() => borrarSeccionSolutions(negocioId, s.id)); }} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px]">✕</button>
            </li>
          ))}
        </ul>
        {menu.secciones.length < TOPES.secciones && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); const v = nuevaSeccion.trim(); if (!v) return; correr(async () => { const r = await guardarSeccionSolutions(negocioId, { id: null, nombre: v }); if (r.ok) setNuevaSeccion(""); return r; }); }}
          >
            <input type="text" value={nuevaSeccion} maxLength={TOPES.seccionNombre} placeholder="Entradas, Platos fuertes, Bebidas…" onChange={(e) => setNuevaSeccion(e.target.value)} className={`min-w-0 flex-1 ${CAMPO_PANEL}`} />
            <button type="submit" disabled={ocupado || !nuevaSeccion.trim()} className={BOTON_PANEL}>+ Sección</button>
          </form>
        )}
      </Card>

      {/* ── Platos ────────────────────────────────────────────── */}
      <Card
        eyebrow="Lo que se vende"
        titulo="Platos"
        accion={
          <button type="button" onClick={() => setEditando({ seccion_id: menu.secciones[0]?.id ?? null, disponible: true })} className={BOTON_PANEL_PRIMARIO}>
            + Nuevo plato
          </button>
        }
      >
        {menu.agrupado.length === 0 && <p className="text-[13px] text-aventurea-ink-soft">Todavía no hay platos. Creá una sección y agregá el primero.</p>}
        <div className="flex flex-col gap-5">
          {menu.agrupado.map((g) => (
            <div key={g.seccion?.id ?? "otros"}>
              <p className={ROTULO_CAMPO}>{g.seccion?.nombre ?? "Otros"}</p>
              <ul className="mt-1.5 flex flex-col divide-y divide-aventurea-line">
                {g.items.map((it) => (
                  <li key={it.id} className={`flex items-center gap-3 py-2.5 ${!it.disponible || it.agotado_hoy ? "opacity-60" : ""}`}>
                    {it.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.foto_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-aventurea-cream-2 text-[16px]">🍽</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-aventurea-ink">{it.nombre}</p>
                      <p className="truncate text-[12px] text-aventurea-ink-soft">
                        {it.precio === null ? "Consultar" : fmtColones(it.precio)}
                        {!it.disponible && " · Oculto"}
                        {it.agotado_hoy && " · Agotado hoy"}
                      </p>
                    </div>
                    <button type="button" disabled={ocupado} onClick={() => correr(() => marcarAgotadoSolutions(negocioId, it.id, !it.agotado_hoy))} className={BOTON_PANEL}>
                      {it.agotado_hoy ? "Hay de nuevo" : "Agotado hoy"}
                    </button>
                    <button type="button" onClick={() => setEditando({ ...it })} className={BOTON_PANEL}>Editar</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Editor de plato ───────────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onClick={() => setEditando(null)}>
          <div role="dialog" aria-modal="true" aria-label="Plato" onClick={(e) => e.stopPropagation()} className="max-h-[92svh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <h3 className="text-[18px] font-extrabold text-aventurea-navy">{editando.id ? "Editar plato" : "Nuevo plato"}</h3>
            <div className="mt-4 grid gap-3">
              <div>
                <label className={ROTULO_CAMPO}>Nombre</label>
                <input type="text" value={editando.nombre ?? ""} maxLength={TOPES.itemNombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={`mt-1.5 ${CAMPO_PANEL}`} autoFocus />
              </div>
              <div>
                <label className={ROTULO_CAMPO}>Descripción</label>
                <textarea rows={2} value={editando.descripcion ?? ""} maxLength={TOPES.itemDescripcion} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} className={`mt-1.5 ${CAMPO_PANEL}`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={ROTULO_CAMPO}>Precio en colones (vacío = consultar)</label>
                  <input type="number" min={0} step={100} value={editando.precio ?? ""} onChange={(e) => setEditando({ ...editando, precio: e.target.value === "" ? null : Number(e.target.value) })} className={`mt-1.5 ${CAMPO_PANEL}`} />
                </div>
                <div>
                  <label className={ROTULO_CAMPO}>Sección</label>
                  <select value={editando.seccion_id ?? ""} onChange={(e) => setEditando({ ...editando, seccion_id: e.target.value || null })} className={`mt-1.5 ${CAMPO_PANEL}`}>
                    <option value="">Otros</option>
                    {menu.secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              <SubirImagen valor={editando.foto_url ?? ""} alCambiar={(u) => setEditando({ ...editando, foto_url: u })} destino="banner" etiqueta="Foto del plato" carpeta="solutions/platos" bucket="solutions-fotos" />
              <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
                <input type="checkbox" checked={editando.disponible !== false} onChange={(e) => setEditando({ ...editando, disponible: e.target.checked })} className="h-4 w-4" />
                Visible en la carta
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={guardarPlato} disabled={ocupado} className={BOTON_PANEL_PRIMARIO}>{ocupado ? "Guardando…" : "Guardar plato"}</button>
              <button type="button" onClick={() => setEditando(null)} className={BOTON_PANEL}>Cancelar</button>
              {editando.id && (
                <button type="button" disabled={ocupado} onClick={() => { if (confirm("¿Borrar este plato?")) correr(async () => { const r = await borrarPlatoSolutions(negocioId, editando.id as string); if (r.ok) setEditando(null); return r; }); }} className="ml-auto text-[13px] font-bold text-red-700 underline">
                  Borrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
