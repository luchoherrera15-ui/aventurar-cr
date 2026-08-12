"use client";

import { useState, useTransition } from "react";
import {
  crearCategoria,
  eliminarCategoria,
  renombrarCategoria,
  reordenarCategorias,
  type CategoriaNegocio,
} from "./categorias-actions";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:text-zinc-500";

/**
 * El orden de las secciones del catálogo (categorias_negocio, 0119).
 *
 * Lo que se administra acá es SOLO el orden: el servicio sigue
 * apuntando a su sección por nombre, desde el formulario de arriba.
 * Por eso una sección puede existir en el catálogo sin estar en esta
 * lista — funciona igual, solo que se acomoda sola al final.
 */
export default function CategoriasPanel({
  ranchoId,
  iniciales,
  detectadas,
}: {
  ranchoId: string;
  iniciales: CategoriaNegocio[];
  /** Los `grupo` que ya aparecen en los servicios cargados. */
  detectadas: string[];
}) {
  const [categorias, setCategorias] = useState(
    [...iniciales].sort((a, b) => a.orden - b.orden),
  );
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [borradorNombre, setBorradorNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const guardadas = new Set(categorias.map((c) => c.nombre.trim().toLowerCase()));
  const sinOrdenar = detectadas.filter((g) => !guardadas.has(g.trim().toLowerCase()));

  function agregar(nombre: string) {
    const limpio = nombre.trim();
    if (!limpio) return;
    setError(null);
    startTransition(async () => {
      const res = await crearCategoria(ranchoId, limpio);
      if (res.error) setError(res.error);
      else if (res.categoria) {
        setCategorias((prev) => [...prev, res.categoria!]);
        setNueva("");
      }
    });
  }

  function renombrar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await renombrarCategoria(ranchoId, id, borradorNombre);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.categoria) {
        setCategorias((prev) => prev.map((c) => (c.id === id ? res.categoria! : c)));
      }
      setEditando(null);
    });
  }

  function eliminar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarCategoria(ranchoId, id);
      if (res.error) setError(res.error);
      else setCategorias((prev) => prev.filter((c) => c.id !== id));
    });
  }

  function mover(indice: number, direccion: -1 | 1) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= categorias.length) return;
    const copia = [...categorias];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setCategorias(copia);
    setError(null);
    startTransition(async () => {
      const res = await reordenarCategorias(
        ranchoId,
        copia.map((c) => c.id),
      );
      if (res.error) {
        setError(res.error);
        setCategorias(categorias); // se devuelve al orden que se veía
      }
    });
  }

  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
      <h3 className="text-[15px] font-bold text-aventurea-ink">
        Orden de las secciones
      </h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        El orden en que el cliente ve tus secciones al reservar. Las que no
        pongás acá salen después, en el orden en que aparecen tus servicios.
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">
          {error}
        </p>
      )}

      {categorias.length > 0 && (
        <ul className="mt-4 space-y-2">
          {categorias.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-3 py-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={pending || i === 0}
                  aria-label={`Subir ${c.nombre}`}
                  className="text-[11px] leading-none text-aventurea-ink-soft disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={pending || i === categorias.length - 1}
                  aria-label={`Bajar ${c.nombre}`}
                  className="text-[11px] leading-none text-aventurea-ink-soft disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              {editando === c.id ? (
                <>
                  <input
                    value={borradorNombre}
                    onChange={(e) => setBorradorNombre(e.target.value)}
                    maxLength={40}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => renombrar(c.id)}
                    disabled={pending}
                    className="shrink-0 text-[12.5px] font-bold text-aventurea-ink underline"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(null)}
                    className="shrink-0 text-[12.5px] font-bold text-aventurea-ink-soft underline"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[13.5px] font-bold text-aventurea-ink">
                    {c.nombre}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(c.id);
                      setBorradorNombre(c.nombre);
                    }}
                    className="shrink-0 text-[12.5px] font-bold text-aventurea-ink-soft underline"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(c.id)}
                    disabled={pending}
                    className="shrink-0 text-[12.5px] font-bold text-red-700 underline"
                  >
                    Quitar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editando !== null && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          Al renombrar, los servicios que están en esa sección se pasan solos a
          la nueva.
        </p>
      )}

      {sinOrdenar.length > 0 && (
        <div className="mt-4">
          <p className="text-[12.5px] font-bold text-aventurea-ink-soft">
            Secciones que ya usás y todavía no ordenaste
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sinOrdenar.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => agregar(g)}
                disabled={pending}
                className="rounded-lg border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink"
              >
                + {g}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar(nueva);
            }
          }}
          maxLength={40}
          placeholder="Nueva sección — ej. Cortes"
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => agregar(nueva)}
          disabled={pending || !nueva.trim()}
          className="shrink-0 rounded-[10px] bg-aventurea-ink px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          Agregar
        </button>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
        Quitar una sección de esta lista no borra ningún servicio: solo pierde
        su lugar fijo y vuelve a acomodarse sola.
      </p>
    </div>
  );
}
