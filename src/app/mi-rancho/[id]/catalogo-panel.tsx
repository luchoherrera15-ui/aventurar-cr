"use client";

import { useState, useTransition } from "react";
import type { RanchoItem } from "../types";
import {
  actualizarItemCatalogo,
  crearItemCatalogo,
  eliminarItemCatalogo,
} from "./catalogo-actions";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

const UNIDADES = ["por persona", "por unidad", "por hora", "por evento", "por día"];

function fmtColones(n: number | null) {
  if (n === null) return "A cotizar";
  return "₡" + Number(n).toLocaleString("es-CR");
}

type Borrador = {
  nombre: string;
  descripcion: string;
  precio: string;
  unidad: string;
};

const VACIO: Borrador = { nombre: "", descripcion: "", precio: "", unidad: "" };

/**
 * El catálogo del negocio (menú, paquetes, productos): lo que el
 * cliente va a poder elegir al armar su reserva. Alta, edición,
 * activar/pausar y borrado, todo en la misma pantalla.
 */
export default function CatalogoPanel({
  ranchoId,
  initialItems,
  etiqueta,
}: {
  ranchoId: string;
  initialItems: RanchoItem[];
  etiqueta: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function precioDe(b: Borrador): number | null {
    const limpio = b.precio.trim();
    if (!limpio) return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  }

  function guardarNuevo() {
    setError(null);
    startTransition(async () => {
      const res = await crearItemCatalogo(ranchoId, {
        nombre: borrador.nombre,
        descripcion: borrador.descripcion,
        precio: precioDe(borrador),
        unidad: borrador.unidad,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.item) setItems((prev) => [...prev, res.item!]);
      setBorrador(VACIO);
    });
  }

  function guardarEdicion(item: RanchoItem) {
    setError(null);
    startTransition(async () => {
      const res = await actualizarItemCatalogo(ranchoId, item.id, {
        nombre: borrador.nombre,
        descripcion: borrador.descripcion,
        precio: precioDe(borrador),
        unidad: borrador.unidad,
        activo: item.activo,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.item) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.item! : i)));
      }
      setEditando(null);
      setBorrador(VACIO);
    });
  }

  function alternarActivo(item: RanchoItem) {
    setError(null);
    startTransition(async () => {
      const res = await actualizarItemCatalogo(ranchoId, item.id, {
        nombre: item.nombre,
        descripcion: item.descripcion ?? "",
        precio: item.precio,
        unidad: item.unidad ?? "",
        activo: !item.activo,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.item) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.item! : i)));
      }
    });
  }

  function borrar(item: RanchoItem) {
    if (!confirm(`¿Borrar "${item.nombre}" del catálogo?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarItemCatalogo(ranchoId, item.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    });
  }

  const formulario = (onGuardar: () => void, textoBoton: string, onCancelar?: () => void) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls}>Nombre</label>
        <input
          type="text"
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          placeholder="Ej. Menú buffet clásico, Paquete DJ 4 horas, Silla tiffany"
          className={inputCls}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Descripción (opcional)</label>
        <textarea
          value={borrador.descripcion}
          onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
          placeholder="Qué incluye exactamente."
          rows={2}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Precio en ₡ (vacío = a cotizar)</label>
        <input
          type="number"
          min={0}
          value={borrador.precio}
          onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })}
          placeholder="Ej. 4500"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Se cobra</label>
        <select
          value={borrador.unidad}
          onChange={(e) => setBorrador({ ...borrador, unidad: e.target.value })}
          className={inputCls}
        >
          <option value="">Sin especificar</option>
          {UNIDADES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onGuardar}
          disabled={pending || !borrador.nombre.trim()}
          className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : textoBoton}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            disabled={pending}
            className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13px] font-bold text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{error}</p>
      )}

      {items.length === 0 && (
        <p className="rounded-2xl border border-aventurea-line bg-aventurea-cream-2 p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
          Todavía no agregaste nada a tu {etiqueta.toLowerCase()}. Lo que cargués
          acá se muestra en tu página pública, y el cliente lo puede elegir al
          armar su reserva — así no tenés que explicar lo mismo por chat cada
          vez.
        </p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {items.map((item) =>
            editando === item.id ? (
              <div key={item.id} className="border-b border-aventurea-line p-4 last:border-none">
                {formulario(
                  () => guardarEdicion(item),
                  "Guardar cambios",
                  () => {
                    setEditando(null);
                    setBorrador(VACIO);
                  },
                )}
              </div>
            ) : (
              <div
                key={item.id}
                className={`flex flex-wrap items-center gap-3 border-b border-aventurea-line px-4 py-3 last:border-none ${
                  item.activo ? "" : "opacity-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-aventurea-ink">
                    {item.nombre}
                    {!item.activo && (
                      <span className="ml-2 rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-zinc-500">
                        Pausado
                      </span>
                    )}
                  </p>
                  {item.descripcion && (
                    <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                      {item.descripcion}
                    </p>
                  )}
                  <p className="mt-0.5 text-[13px] font-bold text-aventurea-navy">
                    {fmtColones(item.precio)}
                    {item.precio !== null && item.unidad ? ` ${item.unidad}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEditando(item.id);
                      setBorrador({
                        nombre: item.nombre,
                        descripcion: item.descripcion ?? "",
                        precio: item.precio === null ? "" : String(item.precio),
                        unidad: item.unidad ?? "",
                      });
                    }}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-40"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => alternarActivo(item)}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-40"
                  >
                    {item.activo ? "Pausar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => borrar(item)}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-red-700 hover:border-red-300 disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {editando === null && (
        <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
          <h3 className="mb-4 text-[15px] font-bold text-aventurea-ink">
            Agregar a tu {etiqueta.toLowerCase()}
          </h3>
          {formulario(guardarNuevo, "Agregar")}
        </div>
      )}
    </div>
  );
}
