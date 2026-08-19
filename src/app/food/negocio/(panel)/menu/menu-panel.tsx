"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import SubirImagen from "@/components/subir-imagen";
import { IconUtensils } from "@/components/icons";
import { CRC, type FoodMenuCategory, type FoodMenuItem } from "@/lib/food/tipos";
import { alternarItem, borrarCategoria, borrarItem, crearCategoria, crearItem, type EstadoMenu } from "./actions";

const INICIAL: EstadoMenu = { error: null };
const campo =
  "w-full rounded-xl border border-aventurea-line bg-white px-3.5 py-2.5 text-[14px] " +
  "text-aventurea-ink outline-none focus:border-aventurea-navy";
const etiqueta = "mb-1.5 block text-[12.5px] font-bold text-aventurea-ink";

export default function MenuPanel({
  negocioId,
  categorias,
  items,
}: {
  negocioId: string;
  categorias: Pick<FoodMenuCategory, "id" | "nombre" | "orden">[];
  items: Omit<FoodMenuItem, "business_id">[];
}) {
  const [creandoCategoria, setCreandoCategoria] = useState(false);

  const itemsPorCategoria = new Map<string, typeof items>();
  for (const it of items) {
    const lista = itemsPorCategoria.get(it.category_id) ?? [];
    lista.push(it);
    itemsPorCategoria.set(it.category_id, lista);
  }

  return (
    <div className="flex flex-col gap-6">
      {!creandoCategoria ? (
        <button
          type="button"
          onClick={() => setCreandoCategoria(true)}
          className="self-start rounded-xl bg-aventurea-navy px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-aventurea-navy-2"
        >
          Nueva categoría
        </button>
      ) : (
        <FormularioCategoria negocioId={negocioId} alCerrar={() => setCreandoCategoria(false)} />
      )}

      {categorias.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aventurea-line-fuerte bg-white px-6 py-10 text-center text-[13.5px] text-aventurea-ink-soft">
          Creá una categoría (ej. &quot;Entradas&quot;) para empezar a cargar tu menú.
        </p>
      ) : (
        categorias.map((cat) => (
          <CategoriaBloque
            key={cat.id}
            negocioId={negocioId}
            categoria={cat}
            items={itemsPorCategoria.get(cat.id) ?? []}
          />
        ))
      )}
    </div>
  );
}

function FormularioCategoria({ negocioId, alCerrar }: { negocioId: string; alCerrar: () => void }) {
  const accion = crearCategoria.bind(null, negocioId);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  if (estado.ok) alCerrar();

  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3 rounded-2xl border border-aventurea-line bg-white p-4">
      <label className="block flex-1 min-w-[200px]">
        <span className={etiqueta}>Nombre de la categoría</span>
        <input name="nombre" required maxLength={60} placeholder="Entradas" className={campo} />
      </label>
      <button type="submit" disabled={pendiente} className="rounded-xl bg-aventurea-navy px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50">
        {pendiente ? "…" : "Crear"}
      </button>
      <button type="button" onClick={alCerrar} className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[13.5px] font-bold text-aventurea-ink">
        Cancelar
      </button>
      {estado.error && <p className="w-full text-[12.5px] font-bold text-red-700">{estado.error}</p>}
    </form>
  );
}

function CategoriaBloque({
  negocioId,
  categoria,
  items,
}: {
  negocioId: string;
  categoria: Pick<FoodMenuCategory, "id" | "nombre">;
  items: Omit<FoodMenuItem, "business_id">[];
}) {
  const [creandoItem, setCreandoItem] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-bold uppercase tracking-wide text-aventurea-ink-soft">{categoria.nombre}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreandoItem((v) => !v)}
            className="text-[12.5px] font-bold text-aventurea-navy hover:underline"
          >
            + Agregar plato
          </button>
          {confirmando ? (
            <span className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-red-700">
                {items.length > 0
                  ? `Esto borra la categoría y sus ${items.length} plato${items.length === 1 ? "" : "s"} —`
                  : "¿Borrar la categoría?"}
              </span>
              <button
                type="button"
                disabled={pendiente}
                onClick={() =>
                  iniciar(async () => {
                    const r = await borrarCategoria(negocioId, categoria.id);
                    setError(r?.error ?? null);
                  })
                }
                className="text-[12px] font-bold text-red-600"
              >
                Confirmar borrado
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className="text-[12px] text-aventurea-ink-soft">
                No
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className="text-[12px] text-red-700 hover:underline">
              Borrar categoría
            </button>
          )}
        </div>
      </div>
      {error && <p className="mb-2 text-[12px] font-bold text-red-700">{error}</p>}

      {creandoItem && (
        <div className="mb-3">
          <FormularioItem negocioId={negocioId} categoryId={categoria.id} alCerrar={() => setCreandoItem(false)} />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-[12.5px] text-aventurea-ink-soft">Sin platos todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <ItemFila key={it.id} negocioId={negocioId} item={it} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FormularioItem({
  negocioId,
  categoryId,
  alCerrar,
}: {
  negocioId: string;
  categoryId: string;
  alCerrar: () => void;
}) {
  const accion = crearItem.bind(null, negocioId);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [foto, setFoto] = useState("");
  if (estado.ok) alCerrar();

  return (
    <form action={enviar} className="flex flex-col gap-3 rounded-2xl border border-aventurea-line bg-white p-4">
      <input type="hidden" name="category_id" value={categoryId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Nombre del plato</span>
          <input name="nombre" required maxLength={80} className={campo} />
        </label>
        <label className="block">
          <span className={etiqueta}>Precio (₡)</span>
          <input name="precio" type="number" min={0} required className={campo} />
        </label>
      </div>
      <label className="block">
        <span className={etiqueta}>Descripción (opcional)</span>
        <textarea name="descripcion" rows={2} maxLength={280} className={campo} />
      </label>
      <SubirImagen valor={foto} alCambiar={setFoto} etiqueta="Foto (opcional)" carpeta="food" />
      <input type="hidden" name="foto_url" value={foto} />

      {estado.error && <p className="text-[12.5px] font-bold text-red-700">{estado.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pendiente} className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
          {pendiente ? "Guardando…" : "Agregar"}
        </button>
        <button type="button" onClick={alCerrar} className="rounded-xl border border-aventurea-line px-4 py-2 text-[13px] font-bold text-aventurea-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ItemFila({ negocioId, item }: { negocioId: string; item: Omit<FoodMenuItem, "business_id"> }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-aventurea-line bg-white p-3">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-aventurea-blue-light">
        {item.foto_url ? (
          <Image src={item.foto_url} alt={item.nombre} fill sizes="44px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-aventurea-navy/40">
            <IconUtensils className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-aventurea-ink">
          {item.nombre} {!item.activo && <span className="ml-1 text-[11px] font-bold text-aventurea-ink-soft">(apagado)</span>}
        </p>
        {error && <p className="text-[12px] font-bold text-red-700">{error}</p>}
      </div>
      <span className="shrink-0 text-[13.5px] font-bold text-aventurea-ink">{CRC.format(item.precio)}</span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await alternarItem(negocioId, item.id, !item.activo);
              setError(r?.error ?? null);
            })
          }
          className="rounded-lg border border-aventurea-line px-2.5 py-1 text-[11.5px] font-bold text-aventurea-ink hover:border-aventurea-navy"
        >
          {item.activo ? "Apagar" : "Prender"}
        </button>
        {confirmando ? (
          <>
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await borrarItem(negocioId, item.id);
                  setError(r?.error ?? null);
                })
              }
              className="rounded-lg bg-red-600 px-2.5 py-1 text-[11.5px] font-bold text-white"
            >
              Sí
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="text-[11.5px] text-aventurea-ink-soft">
              No
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className="text-[11.5px] font-bold text-red-700 hover:underline">
            Borrar
          </button>
        )}
      </div>
    </li>
  );
}
