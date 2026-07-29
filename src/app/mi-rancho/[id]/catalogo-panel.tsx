"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RanchoItem } from "../types";
import { etiquetaDuracion } from "@/lib/catalogo";
import {
  actualizarItemCatalogo,
  crearItemCatalogo,
  duplicarItemCatalogo,
  eliminarItemCatalogo,
  reordenarCatalogo,
  type ItemInput,
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

function nombreSeguro(nombre: string) {
  return nombre.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

type Borrador = {
  nombre: string;
  descripcion: string;
  precio: string;
  unidad: string;
  tipo: "paquete" | "producto";
  grupo: string;
  duracionHoras: string;
  fotoUrl: string | null;
  minPorReserva: string;
  maxPorReserva: string;
  capacidadDia: string;
};

const VACIO: Borrador = {
  nombre: "",
  descripcion: "",
  precio: "",
  unidad: "",
  tipo: "paquete",
  grupo: "",
  duracionHoras: "",
  fotoUrl: null,
  minPorReserva: "1",
  maxPorReserva: "",
  capacidadDia: "",
};

function num(v: string): number | null {
  const limpio = v.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function aInput(b: Borrador, activo: boolean): ItemInput {
  return {
    nombre: b.nombre,
    descripcion: b.descripcion,
    precio: num(b.precio),
    unidad: b.unidad,
    tipo: b.tipo,
    grupo: b.grupo,
    duracionHoras: num(b.duracionHoras),
    fotoUrl: b.fotoUrl,
    minPorReserva: num(b.minPorReserva) ?? 1,
    maxPorReserva: num(b.maxPorReserva),
    capacidadDia: num(b.capacidadDia),
    activo,
  };
}

function deItem(item: RanchoItem): Borrador {
  return {
    nombre: item.nombre,
    descripcion: item.descripcion ?? "",
    precio: item.precio === null ? "" : String(item.precio),
    unidad: item.unidad ?? "",
    tipo: item.tipo,
    grupo: item.grupo ?? "",
    duracionHoras: item.duracion_horas === null ? "" : String(item.duracion_horas),
    fotoUrl: item.foto_url,
    minPorReserva: String(item.min_por_reserva),
    maxPorReserva: item.max_por_reserva === null ? "" : String(item.max_por_reserva),
    capacidadDia: item.capacidad_dia === null ? "" : String(item.capacidad_dia),
  };
}

/**
 * El catálogo del negocio: lo que el cliente puede reservar directo
 * desde tu página, sin pasar por el chat. Un "paquete" es la unidad
 * grande (una estación de fotos, un combo DJ de 5 horas); un
 * "producto" es lo que se pide por cantidad (un plato, una silla).
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
  const [items, setItems] = useState(
    [...initialItems].sort((a, b) => a.orden - b.orden),
  );
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [pending, startTransition] = useTransition();

  const grupos = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => i.grupo?.trim()).filter(Boolean)),
      ) as string[],
    [items],
  );

  async function subirFoto(file: File) {
    setError(null);
    setSubiendoFoto(true);
    // Mismo bucket público que las fotos del negocio; el catálogo va en
    // su propia carpeta para no mezclarse con la galería.
    const supabase = createClient();
    const path = `${ranchoId}/catalogo/${Date.now()}-${nombreSeguro(file.name)}`;
    const { error: errorSubida } = await supabase.storage
      .from("ranchos-fotos")
      .upload(path, file, { upsert: true });
    setSubiendoFoto(false);
    if (errorSubida) {
      setError("No se pudo subir la foto: " + errorSubida.message);
      return;
    }
    const { data } = supabase.storage.from("ranchos-fotos").getPublicUrl(path);
    setBorrador((b) => ({ ...b, fotoUrl: data.publicUrl }));
  }

  function guardarNuevo() {
    setError(null);
    startTransition(async () => {
      const res = await crearItemCatalogo(ranchoId, aInput(borrador, true));
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
      const res = await actualizarItemCatalogo(
        ranchoId,
        item.id,
        aInput(borrador, item.activo),
      );
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
        ...aInput(deItem(item), !item.activo),
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

  function duplicar(item: RanchoItem) {
    setError(null);
    startTransition(async () => {
      const res = await duplicarItemCatalogo(ranchoId, item.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.item) setItems((prev) => [...prev, res.item!]);
    });
  }

  function mover(item: RanchoItem, direccion: -1 | 1) {
    const idx = items.findIndex((i) => i.id === item.id);
    const destino = idx + direccion;
    if (idx < 0 || destino < 0 || destino >= items.length) return;

    const nuevo = [...items];
    [nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]];
    setItems(nuevo);
    setError(null);
    startTransition(async () => {
      const res = await reordenarCatalogo(
        ranchoId,
        nuevo.map((i) => i.id),
      );
      if (res.error) setError(res.error);
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

  const formulario = (
    onGuardar: () => void,
    textoBoton: string,
    onCancelar?: () => void,
  ) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls}>Tipo</label>
        <div className="flex gap-2">
          {(
            [
              ["paquete", "Paquete (con foto, ej. Estación de fotos 5 horas)"],
              ["producto", "Producto por cantidad (ej. un plato, una silla)"],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setBorrador({ ...borrador, tipo: valor })}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-bold ${
                borrador.tipo === valor
                  ? "border-aventurea-orange bg-aventurea-orange/10 text-aventurea-orange"
                  : "border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="sm:col-span-2">
        <label className={labelCls}>Nombre</label>
        <input
          type="text"
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          placeholder="Ej. Estación 1 de fotos, Menú buffet clásico, Silla tiffany"
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

      <div className="sm:col-span-2">
        <label className={labelCls}>Foto (opcional, recomendado para paquetes)</label>
        <div className="flex items-center gap-3">
          {borrador.fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={borrador.fotoUrl}
              alt=""
              className="h-16 w-16 rounded-xl border border-aventurea-line object-cover"
            />
          )}
          <label className="cursor-pointer rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange">
            {subiendoFoto
              ? "Subiendo..."
              : borrador.fotoUrl
                ? "Cambiar foto"
                : "Subir foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={subiendoFoto}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) subirFoto(file);
                e.target.value = "";
              }}
            />
          </label>
          {borrador.fotoUrl && (
            <button
              type="button"
              onClick={() => setBorrador({ ...borrador, fotoUrl: null })}
              className="text-[12.5px] font-bold text-red-700 underline"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Precio en ₡ (vacío = a cotizar)</label>
        <input
          type="number"
          min={0}
          value={borrador.precio}
          onChange={(e) => setBorrador({ ...borrador, precio: e.target.value })}
          placeholder="Ej. 85000"
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

      <div>
        <label className={labelCls}>Horas que incluye (opcional)</label>
        <input
          type="number"
          min={0}
          step="0.5"
          value={borrador.duracionHoras}
          onChange={(e) => setBorrador({ ...borrador, duracionHoras: e.target.value })}
          placeholder="Ej. 5"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Sección (opcional)</label>
        <input
          type="text"
          list={`grupos-${ranchoId}`}
          value={borrador.grupo}
          onChange={(e) => setBorrador({ ...borrador, grupo: e.target.value })}
          placeholder="Ej. Estaciones, Extras, Bebidas"
          className={inputCls}
        />
        <datalist id={`grupos-${ranchoId}`}>
          {grupos.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      <div>
        <label className={labelCls}>Mínimo por reserva</label>
        <input
          type="number"
          min={1}
          value={borrador.minPorReserva}
          onChange={(e) => setBorrador({ ...borrador, minPorReserva: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Máximo por reserva (vacío = sin tope)</label>
        <input
          type="number"
          min={1}
          value={borrador.maxPorReserva}
          onChange={(e) => setBorrador({ ...borrador, maxPorReserva: e.target.value })}
          className={inputCls}
        />
      </div>

      <div className="sm:col-span-2">
        <label className={labelCls}>
          ¿Cuántos podés atender por día? (vacío = sin límite)
        </label>
        <input
          type="number"
          min={1}
          value={borrador.capacidadDia}
          onChange={(e) => setBorrador({ ...borrador, capacidadDia: e.target.value })}
          placeholder="Ej. 2 — si tenés 2 estaciones, cada día se pueden reservar hasta 2"
          className={inputCls}
        />
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onGuardar}
          disabled={pending || subiendoFoto || !borrador.nombre.trim()}
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
          acá se puede <strong>reservar directo</strong> desde tu página pública
          — el cliente elige fecha, arma su pedido y paga el depósito sin tener
          que preguntarte nada por chat.
        </p>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
          {items.map((item, idx) =>
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
                {item.foto_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.foto_url}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl border border-aventurea-line object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-aventurea-ink">
                    {item.nombre}
                    {item.grupo && (
                      <span className="ml-2 rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft">
                        {item.grupo}
                      </span>
                    )}
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
                    {etiquetaDuracion(item.duracion_horas) && (
                      <span className="font-normal text-aventurea-ink-soft">
                        {" "}
                        · {etiquetaDuracion(item.duracion_horas)}
                      </span>
                    )}
                    {item.capacidad_dia !== null && (
                      <span className="font-normal text-aventurea-ink-soft">
                        {" "}
                        · hasta {item.capacidad_dia}/día
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pending || idx === 0}
                    onClick={() => mover(item, -1)}
                    aria-label="Subir"
                    className="h-[30px] w-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending || idx === items.length - 1}
                    onClick={() => mover(item, 1)}
                    aria-label="Bajar"
                    className="h-[30px] w-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setEditando(item.id);
                      setBorrador(deItem(item));
                    }}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-40"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => duplicar(item)}
                    className="h-[30px] rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 text-xs font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange disabled:opacity-40"
                  >
                    Duplicar
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
