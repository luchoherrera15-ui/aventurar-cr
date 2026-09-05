"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, PildoraEstado } from "@/components/panel/piezas";
import { BOTON_PANEL, BOTON_PANEL_PRIMARIO, CAMPO_PANEL, ESTADO_AVISO, ROTULO_CAMPO } from "@/components/panel/sistema";
import SubirImagen from "@/components/subir-imagen";
import { fmtColones } from "@/lib/finanzas";
import type { MenuDelNegocio } from "@/lib/solutions/datos";
import {
  ALERGENO,
  ALERGENOS,
  IDIOMA,
  estaTraducido,
  type Alergeno,
  type IdiomaExtra,
  type Nutricion,
  type Traducciones,
} from "@/lib/solutions/idiomas";
import { TOPES, type ItemMenuSolutions } from "@/lib/solutions/tipos";
import {
  borrarPlatoSolutions,
  borrarSeccionSolutions,
  guardarPlatoSolutions,
  guardarSeccionSolutions,
  marcarAgotadoSolutions,
  ordenarSeccionesSolutions,
  traducirMenuSolutions,
} from "./actions";

/**
 * EL MENÚ — secciones y platos, en varios idiomas y con ficha nutricional.
 *
 * Cada cambio se guarda al momento (no hay un «Guardar todo»): un
 * restaurante edita un plato a la vez, entre servicio y servicio, y
 * tiene que ver el resultado ya. `router.refresh()` trae los datos
 * frescos del servidor después de cada action.
 *
 * ── LOS IDIOMAS (0235) ──────────────────────────────────────────────
 * Pedido del dueño (5 sep 2026): «que el menú se pueda ver en cinco
 * idiomas al mismo tiempo». El español es la base; los idiomas que el
 * negocio prende en Mi página aparecen acá como pestañas dentro de cada
 * plato y como campos debajo de cada sección. Y hay un botón que
 * traduce TODO de una vez con IA: treinta platos por cinco idiomas a
 * mano es lo que hace que nadie termine de traducir su menú.
 *
 * ── LA FICHA NUTRICIONAL: OPCIONAL ──────────────────────────────────
 * Un bloque plegado en el editor del plato. Vacío = el plato no la
 * muestra; el menú público solo la dibuja cuando hay algo.
 */

type Editando = Partial<ItemMenuSolutions> & { seccion_id: string | null };

export default function SeccionMenu({
  negocioId,
  menu,
  idiomas,
}: {
  negocioId: string;
  menu: MenuDelNegocio;
  /** Los idiomas que el negocio ofrece además del español. */
  idiomas: IdiomaExtra[];
}) {
  const router = useRouter();
  const [ocupado, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nuevaSeccion, setNuevaSeccion] = useState("");
  const [editando, setEditando] = useState<Editando | null>(null);
  const [idiomaActivo, setIdiomaActivo] = useState<IdiomaExtra | null>(idiomas[0] ?? null);
  const [verNutricion, setVerNutricion] = useState(false);

  const correr = (fn: () => Promise<{ ok: boolean; motivo?: string }>) => {
    setError(null);
    arrancar(async () => {
      const r = await fn();
      if (!r.ok) setError(r.motivo ?? "No se pudo guardar.");
      else router.refresh();
    });
  };

  const abrirPlato = (e: Editando) => {
    setEditando(e);
    setVerNutricion(Boolean(e.nutricion));
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
        traducciones: e.traducciones ?? {},
        nutricion: verNutricion ? (e.nutricion ?? null) : null,
      });
      if (r.ok) setEditando(null);
      return r;
    });
  };

  const traducirTodo = () => {
    setError(null);
    setAviso(null);
    arrancar(async () => {
      const r = await traducirMenuSolutions(negocioId);
      if (!r.ok) return setError(r.motivo);
      setAviso(`Listo: ${r.platos} platos y ${r.secciones} secciones traducidos a ${idiomas.map((i) => IDIOMA[i].nombre.toLowerCase()).join(", ")}. Revisá y corregí lo que quieras.`);
      router.refresh();
    });
  };

  /** Cuántos platos ya tienen nombre en ese idioma. */
  const traducidos = (i: IdiomaExtra) => menu.items.filter((it) => estaTraducido(it.traducciones, i)).length;

  const setTrad = (idioma: IdiomaExtra, parte: Partial<{ nombre: string; descripcion: string }>) => {
    if (!editando) return;
    const actuales: Traducciones = editando.traducciones ?? {};
    setEditando({ ...editando, traducciones: { ...actuales, [idioma]: { ...(actuales[idioma] ?? {}), ...parte } } });
  };
  const setNut = (parte: Partial<Nutricion>) => {
    if (!editando) return;
    setEditando({ ...editando, nutricion: { ...(editando.nutricion ?? {}), ...parte } });
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-xl bg-red-50 p-3 text-[13px] font-bold text-red-700">{error}</p>}
      {aviso && <p className={`rounded-xl p-3 text-[13px] font-bold ${ESTADO_AVISO.exito}`}>{aviso}</p>}

      {/* ── Idiomas ───────────────────────────────────────────── */}
      <Card
        eyebrow="En varios idiomas"
        titulo="Idiomas del menú"
        accion={
          idiomas.length > 0 ? (
            <button type="button" onClick={traducirTodo} disabled={ocupado || menu.items.length === 0} className={BOTON_PANEL_PRIMARIO}>
              {ocupado ? "Traduciendo…" : "Traducir todo con IA"}
            </button>
          ) : undefined
        }
      >
        {idiomas.length === 0 ? (
          <p className="text-[13px] leading-snug text-aventurea-ink-soft">
            Tu menú está solo en español. Prendé otros idiomas en{" "}
            <Link href="?tab=pagina" className="font-bold underline">Mi página → Menú y pedidos</Link> y tus clientes
            podrán cambiarlo con un toque.
          </p>
        ) : (
          <>
            <p className="text-[13px] leading-snug text-aventurea-ink-soft">
              Tus clientes eligen el idioma arriba del menú. Lo que no esté traducido se muestra en español, así que nunca
              falta un plato. «Traducir todo con IA» completa lo que falte en un par de segundos; después corregís lo que
              quieras plato por plato.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {idiomas.map((i) => (
                <li key={i}>
                  <PildoraEstado estado={traducidos(i) === menu.items.length && menu.items.length > 0 ? "exito" : "neutro"}>
                    {IDIOMA[i].nombre} · {traducidos(i)}/{menu.items.length}
                  </PildoraEstado>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* ── Secciones ─────────────────────────────────────────── */}
      <Card eyebrow="Cómo se ordena" titulo="Secciones" accion={<PildoraEstado estado="neutro">{menu.secciones.length} de {TOPES.secciones}</PildoraEstado>}>
        <ul className="flex flex-col gap-2">
          {menu.secciones.map((s, i) => (
            <li key={s.id} className="rounded-xl border border-aventurea-line p-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={s.nombre}
                  maxLength={TOPES.seccionNombre}
                  aria-label="Nombre de la sección"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.nombre) correr(() => guardarSeccionSolutions(negocioId, { id: s.id, nombre: v, traducciones: s.traducciones }));
                  }}
                  className={`min-w-0 flex-1 ${CAMPO_PANEL}`}
                />
                <span className="text-[11.5px] text-aventurea-ink-soft">{menu.items.filter((it) => it.seccion_id === s.id).length} platos</span>
                <button type="button" aria-label="Subir" disabled={i === 0 || ocupado} onClick={() => { const ids = menu.secciones.map((x) => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; correr(() => ordenarSeccionesSolutions(negocioId, ids)); }} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">↑</button>
                <button type="button" aria-label="Bajar" disabled={i === menu.secciones.length - 1 || ocupado} onClick={() => { const ids = menu.secciones.map((x) => x.id); [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]]; correr(() => ordenarSeccionesSolutions(negocioId, ids)); }} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px] disabled:opacity-40">↓</button>
                <button type="button" aria-label="Borrar sección" disabled={ocupado} onClick={() => { if (confirm(`¿Borrar la sección «${s.nombre}»? Los platos pasan a «Otros».`)) correr(() => borrarSeccionSolutions(negocioId, s.id)); }} className="presionable h-9 w-9 rounded-lg border border-aventurea-line text-[13px]">✕</button>
              </div>
              {idiomas.length > 0 && (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {idiomas.map((idioma) => (
                    <label key={idioma} className="flex items-center gap-2">
                      <span className="w-7 shrink-0 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">{IDIOMA[idioma].codigo}</span>
                      <input
                        type="text"
                        defaultValue={s.traducciones?.[idioma]?.nombre ?? ""}
                        maxLength={TOPES.seccionNombre}
                        placeholder={`${s.nombre} en ${IDIOMA[idioma].nombre.toLowerCase()}`}
                        aria-label={`Nombre en ${IDIOMA[idioma].nombre}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === (s.traducciones?.[idioma]?.nombre ?? "")) return;
                          correr(() => guardarSeccionSolutions(negocioId, { id: s.id, nombre: s.nombre, traducciones: { ...s.traducciones, [idioma]: { nombre: v } } }));
                        }}
                        className={`min-w-0 flex-1 ${CAMPO_PANEL} py-1.5 text-[13px]`}
                      />
                    </label>
                  ))}
                </div>
              )}
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
          <button type="button" onClick={() => abrirPlato({ seccion_id: menu.secciones[0]?.id ?? null, disponible: true })} className={BOTON_PANEL_PRIMARIO}>
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
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-aventurea-cream-2 text-[11px] font-extrabold text-aventurea-ink-soft">sin foto</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold text-aventurea-ink">{it.nombre}</p>
                      <p className="truncate text-[12px] text-aventurea-ink-soft">
                        {it.precio === null ? "Consultar" : fmtColones(it.precio)}
                        {!it.disponible && " · Oculto"}
                        {it.agotado_hoy && " · Agotado hoy"}
                        {it.nutricion && " · con ficha"}
                        {idiomas.length > 0 && ` · ${idiomas.filter((i) => estaTraducido(it.traducciones, i)).map((i) => IDIOMA[i].codigo).join(" ") || "sin traducir"}`}
                      </p>
                    </div>
                    <button type="button" disabled={ocupado} onClick={() => correr(() => marcarAgotadoSolutions(negocioId, it.id, !it.agotado_hoy))} className={BOTON_PANEL}>
                      {it.agotado_hoy ? "Hay de nuevo" : "Agotado hoy"}
                    </button>
                    <button type="button" onClick={() => abrirPlato({ ...it })} className={BOTON_PANEL}>Editar</button>
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
          <div role="dialog" aria-modal="true" aria-label="Plato" onClick={(e) => e.stopPropagation()} className="max-h-[92svh] w-full max-w-[600px] overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
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
                Visible en el menú
              </label>

              {/* ── Traducciones ────────────────────────────────── */}
              {idiomas.length > 0 && idiomaActivo && (
                <div className="rounded-xl border border-aventurea-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={ROTULO_CAMPO}>En otros idiomas</p>
                    <div className="flex flex-wrap gap-1">
                      {idiomas.map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setIdiomaActivo(i)}
                          aria-pressed={idiomaActivo === i}
                          className={`presionable rounded-lg border px-2.5 py-1 text-[11.5px] font-extrabold ${
                            idiomaActivo === i ? "border-aventurea-navy bg-aventurea-navy text-white" : "border-aventurea-line text-aventurea-ink-soft"
                          }`}
                        >
                          {IDIOMA[i].codigo}
                          {estaTraducido(editando.traducciones, i) && " ✓"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2">
                    <input
                      type="text"
                      value={editando.traducciones?.[idiomaActivo]?.nombre ?? ""}
                      maxLength={TOPES.itemNombre}
                      placeholder={`Nombre en ${IDIOMA[idiomaActivo].nombre.toLowerCase()}`}
                      onChange={(e) => setTrad(idiomaActivo, { nombre: e.target.value })}
                      className={CAMPO_PANEL}
                    />
                    <textarea
                      rows={2}
                      value={editando.traducciones?.[idiomaActivo]?.descripcion ?? ""}
                      maxLength={TOPES.itemDescripcion}
                      placeholder={`Descripción en ${IDIOMA[idiomaActivo].nombre.toLowerCase()}`}
                      onChange={(e) => setTrad(idiomaActivo, { descripcion: e.target.value })}
                      className={CAMPO_PANEL}
                    />
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-aventurea-ink-soft">Vacío = se muestra en español. «Traducir todo con IA» llena estos campos.</p>
                </div>
              )}

              {/* ── Ficha nutricional (opcional) ────────────────── */}
              <div className="rounded-xl border border-aventurea-line p-3">
                <label className="flex items-center gap-2.5 text-[13px] font-bold text-aventurea-ink">
                  <input type="checkbox" checked={verNutricion} onChange={(e) => setVerNutricion(e.target.checked)} className="h-4 w-4" />
                  Ficha nutricional (opcional)
                </label>
                {verNutricion && (
                  <div className="mt-3 grid gap-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <label className="col-span-2 sm:col-span-1">
                        <span className={ROTULO_CAMPO}>Porción</span>
                        <input type="text" value={editando.nutricion?.porcion ?? ""} maxLength={40} placeholder="300 g" onChange={(e) => setNut({ porcion: e.target.value })} className={`mt-1 ${CAMPO_PANEL}`} />
                      </label>
                      {(
                        [
                          ["calorias", "Calorías", "kcal"],
                          ["proteina", "Proteína", "g"],
                          ["carbohidratos", "Carbohidratos", "g"],
                          ["grasa", "Grasa", "g"],
                        ] as const
                      ).map(([k, rotulo, unidad]) => (
                        <label key={k}>
                          <span className={ROTULO_CAMPO}>{rotulo} ({unidad})</span>
                          <input
                            type="number"
                            min={0}
                            step={k === "calorias" ? 1 : 0.1}
                            value={editando.nutricion?.[k] ?? ""}
                            onChange={(e) => setNut({ [k]: e.target.value === "" ? undefined : Number(e.target.value) })}
                            className={`mt-1 ${CAMPO_PANEL}`}
                          />
                        </label>
                      ))}
                    </div>
                    <div>
                      <span className={ROTULO_CAMPO}>Alérgenos</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {ALERGENOS.map((a: Alergeno) => {
                          const activo = editando.nutricion?.alergenos?.includes(a) ?? false;
                          return (
                            <button
                              key={a}
                              type="button"
                              aria-pressed={activo}
                              onClick={() => {
                                const actuales = editando.nutricion?.alergenos ?? [];
                                setNut({ alergenos: activo ? actuales.filter((x) => x !== a) : [...actuales, a] });
                              }}
                              className={`presionable rounded-lg border px-2.5 py-1 text-[12px] font-bold ${
                                activo ? "border-aventurea-navy bg-aventurea-navy/5 text-aventurea-navy" : "border-aventurea-line text-aventurea-ink-soft"
                              }`}
                            >
                              {ALERGENO[a]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
