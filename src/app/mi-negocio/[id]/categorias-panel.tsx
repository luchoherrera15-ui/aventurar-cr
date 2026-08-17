"use client";

import { useState, useTransition } from "react";
import { IconChevronDown, IconPlus } from "@/components/icons";
import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import {
  BOTON_PANEL_PRIMARIO,
  CAMPO_PANEL,
  DETALLE,
  ESTADO_AVISO,
} from "@/components/panel/sistema";
import {
  ACCIONES_FILA,
  BOTON_FILA,
  BOTON_FILA_ICONO,
  BOTON_FILA_PELIGRO,
  FilaFicha,
  LISTA_FICHAS,
} from "./fila-ficha";
import {
  crearCategoria,
  eliminarCategoria,
  renombrarCategoria,
  reordenarCategorias,
  type CategoriaNegocio,
} from "./categorias-actions";

/**
 * El orden de las secciones del catálogo (categorias_negocio, 0119).
 *
 * Lo que se administra acá es SOLO el orden: el servicio sigue
 * apuntando a su sección por nombre, desde el formulario de arriba.
 * Por eso una sección puede existir en el catálogo sin estar en esta
 * lista — funciona igual, solo que se acomoda sola al final.
 *
 * Es una tarjeta del panel más, con la MISMA fila y los MISMOS botones
 * chicos que el catálogo que tiene arriba: antes las flechas eran dos
 * triángulos de texto (▲▼) de 11px y las acciones, tres enlaces
 * subrayados — tres lenguajes distintos para las mismas tres acciones
 * que la lista de servicios ya tenía como botones.
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
    <Card
      eyebrow="Cómo se ordena"
      titulo="Orden de las secciones"
      accion={
        sinOrdenar.length > 0 ? (
          <PildoraEstado estado="aviso">{sinOrdenar.length} sin ordenar</PildoraEstado>
        ) : (
          <span className={DETALLE}>
            {categorias.length} secci{categorias.length === 1 ? "ón" : "ones"}
          </span>
        )
      }
    >
      <p className={`leading-relaxed ${DETALLE}`}>
        El orden en que el cliente ve tus secciones al reservar. Las que no pongás acá salen
        después, en el orden en que aparecen tus servicios.
      </p>

      {error && (
        <p role="alert" className={`mt-3 rounded-xl p-3 text-[13px] ${ESTADO_AVISO.alerta}`}>
          {error}
        </p>
      )}

      {categorias.length === 0 ? (
        <div className="mt-3.5">
          <CardVacia>
            Todavía no fijaste ningún orden. Mientras tanto tus secciones salen en el orden
            en que aparecen tus servicios.
          </CardVacia>
        </div>
      ) : (
        <div className={`mt-3.5 ${LISTA_FICHAS}`}>
          {categorias.map((c, i) => {
            const ultima = i === categorias.length - 1;
            if (editando === c.id) {
              return (
                <div
                  key={c.id}
                  className={`flex flex-wrap items-center gap-2 p-3.5 sm:px-4 ${
                    ultima ? "" : "border-b border-aventurea-line"
                  }`}
                >
                  <input
                    value={borradorNombre}
                    onChange={(e) => setBorradorNombre(e.target.value)}
                    maxLength={40}
                    aria-label={`Nuevo nombre de ${c.nombre}`}
                    className={`min-w-[180px] flex-1 ${CAMPO_PANEL}`}
                  />
                  <div className={ACCIONES_FILA}>
                    <button
                      type="button"
                      onClick={() => renombrar(c.id)}
                      disabled={pending}
                      className={BOTON_FILA}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditando(null)}
                      className={BOTON_FILA}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <FilaFicha
                key={c.id}
                separador={!ultima}
                // El orden ES el dato de esta lista: el número dice en
                // qué puesto sale la sección, que es justo lo que las
                // flechas cambian.
                medio={
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-aventurea-line bg-aventurea-cream-2 text-[12.5px] font-extrabold tabular-nums text-aventurea-ink-soft"
                  >
                    {i + 1}
                  </span>
                }
                titulo={c.nombre}
                acciones={
                  <div className={ACCIONES_FILA}>
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={pending || i === 0}
                      aria-label={`Subir ${c.nombre}`}
                      className={BOTON_FILA_ICONO}
                    >
                      <IconChevronDown className="h-3.5 w-3.5 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={pending || ultima}
                      aria-label={`Bajar ${c.nombre}`}
                      className={BOTON_FILA_ICONO}
                    >
                      <IconChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(c.id);
                        setBorradorNombre(c.nombre);
                      }}
                      className={BOTON_FILA}
                    >
                      Renombrar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(c.id)}
                      disabled={pending}
                      className={BOTON_FILA_PELIGRO}
                    >
                      Quitar
                    </button>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {editando !== null && (
        <p className={`mt-2 leading-relaxed ${DETALLE}`}>
          Al renombrar, los servicios que están en esa sección se pasan solos a la nueva.
        </p>
      )}

      {sinOrdenar.length > 0 && (
        <div className="mt-4">
          <p className="text-[12.5px] font-bold text-aventurea-ink">
            Secciones que ya usás y todavía no ordenaste
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sinOrdenar.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => agregar(g)}
                disabled={pending}
                className={BOTON_FILA}
              >
                <IconPlus className="h-3 w-3" /> {g}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
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
          aria-label="Nueva sección"
          className={`min-w-[180px] flex-1 ${CAMPO_PANEL}`}
        />
        <button
          type="button"
          onClick={() => agregar(nueva)}
          disabled={pending || !nueva.trim()}
          className={BOTON_PANEL_PRIMARIO}
        >
          Agregar
        </button>
      </div>

      <p className={`mt-3 leading-relaxed ${DETALLE}`}>
        Quitar una sección de esta lista no borra ningún servicio: solo pierde su lugar fijo
        y vuelve a acomodarse sola.
      </p>
    </Card>
  );
}
