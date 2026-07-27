"use client";

import { useActionState, useState, useTransition } from "react";
import {
  crearSeccion,
  actualizarSeccion,
  alternarActivo,
  eliminarSeccion,
  type SeccionFormState,
} from "./actions";
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  SUBCATEGORIAS,
  PROVINCIAS,
  CANTONES,
  type Categoria,
  type Provincia,
  type HomeSeccion,
  type TipoSeccionHome,
} from "@/app/mi-rancho/types";

type RanchoLigero = { id: string; nombre: string; categoria: Categoria };

const TIPO_LABEL: Record<TipoSeccionHome, string> = {
  categoria: "Por categoría",
  ubicacion: "Por zona",
  manual: "Selección manual",
};

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-sm text-aventurea-ink";
const labelCls = "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function SeccionesPanel({
  initialSecciones,
  ranchosDisponibles,
}: {
  initialSecciones: HomeSeccion[];
  ranchosDisponibles: RanchoLigero[];
}) {
  const [secciones, setSecciones] = useState(initialSecciones);
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function quitarDeLista(id: string) {
    setSecciones((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] text-aventurea-ink-soft">
          {secciones.length} sección{secciones.length === 1 ? "" : "es"} · el orden de la lista es el
          orden en que aparecen en el home.
        </p>
        {!creando && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark"
          >
            + Nueva sección
          </button>
        )}
      </div>

      {creando && (
        <FormularioSeccion
          accion={async (_s, fd) => {
            const res = await crearSeccion(undefined, fd);
            if (!res?.error) setCreando(false);
            return res;
          }}
          ranchosDisponibles={ranchosDisponibles}
          onCancelar={() => setCreando(false)}
        />
      )}

      <div className="flex flex-col gap-2.5">
        {[...secciones]
          .sort((a, b) => a.orden - b.orden)
          .map((s) =>
            editandoId === s.id ? (
              <FormularioSeccion
                key={s.id}
                inicial={s}
                accion={async (_st, fd) => {
                  const res = await actualizarSeccion(s.id, fd);
                  if (!res?.error) {
                    setSecciones((prev) =>
                      prev.map((x) => (x.id === s.id ? { ...x, ...datosVisualesDeForm(fd) } : x)),
                    );
                    setEditandoId(null);
                  }
                  return res;
                }}
                ranchosDisponibles={ranchosDisponibles}
                onCancelar={() => setEditandoId(null)}
              />
            ) : (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-aventurea-cream-2 px-2 py-0.5 text-[10.5px] font-bold uppercase text-aventurea-ink-soft">
                      {TIPO_LABEL[s.tipo]}
                    </span>
                    <span className="text-[10.5px] text-zinc-400">orden {s.orden}</span>
                    {!s.activo && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-700">
                        Oculta
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[14.5px] font-bold text-aventurea-ink">{s.titulo}</p>
                  <p className="truncate text-[12.5px] text-aventurea-ink-soft">
                    {s.tipo === "categoria" &&
                      (CATEGORIA_LABEL[s.categoria as Categoria] ?? s.categoria)}
                    {s.tipo === "ubicacion" && [s.canton, s.provincia].filter(Boolean).join(", ")}
                    {s.tipo === "manual" && `${s.rancho_ids?.length ?? 0} proveedores elegidos`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await alternarActivo(s.id, !s.activo);
                        setSecciones((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, activo: !x.activo } : x)),
                        );
                      })
                    }
                    className="rounded-lg border border-aventurea-line px-2.5 py-1.5 text-[12px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                  >
                    {s.activo ? "Ocultar" : "Mostrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(s.id)}
                    className="rounded-lg border border-aventurea-line px-2.5 py-1.5 text-[12px] font-bold text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await eliminarSeccion(s.id);
                        quitarDeLista(s.id);
                      })
                    }
                    className="rounded-lg border border-aventurea-line px-2.5 py-1.5 text-[12px] font-bold text-red-700 hover:border-red-400"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ),
          )}
        {secciones.length === 0 && !creando && (
          <p className="rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-8 text-center text-[13.5px] text-aventurea-ink-soft">
            Todavía no hay ninguna sección — el home muestra un riel automático por categoría hasta
            que armes la primera acá.
          </p>
        )}
      </div>
    </div>
  );
}

// Solo para reflejar en la lista, sin esperar a recargar la página, los
// campos que se ven en la card (título/tipo/orden/activo no cambian con
// esto — activo y borrado ya se actualizan aparte).
function datosVisualesDeForm(fd: FormData): Partial<HomeSeccion> {
  return {
    titulo: String(fd.get("titulo") || ""),
    tipo: String(fd.get("tipo") || "categoria") as TipoSeccionHome,
    orden: parseInt(String(fd.get("orden") || "0"), 10) || 0,
    categoria: (String(fd.get("categoria") || "") || null) as Categoria | null,
    subcategoria: String(fd.get("subcategoria") || "") || null,
    provincia: (String(fd.get("provincia") || "") || null) as Provincia | null,
    canton: String(fd.get("canton") || "") || null,
    rancho_ids: fd.getAll("rancho_ids").map(String),
  };
}

function FormularioSeccion({
  accion,
  inicial,
  ranchosDisponibles,
  onCancelar,
}: {
  accion: (state: SeccionFormState, formData: FormData) => Promise<SeccionFormState>;
  inicial?: HomeSeccion;
  ranchosDisponibles: RanchoLigero[];
  onCancelar: () => void;
}) {
  const [state, formAction, pending] = useActionState<SeccionFormState, FormData>(accion, undefined);
  const [tipo, setTipo] = useState<TipoSeccionHome>(inicial?.tipo ?? "categoria");
  const [categoriaSel, setCategoriaSel] = useState<Categoria | "">(inicial?.categoria ?? "");
  const [provinciaSel, setProvinciaSel] = useState<Provincia | "">(inicial?.provincia ?? "");
  const [seleccionados, setSeleccionados] = useState<string[]>(inicial?.rancho_ids ?? []);
  const [buscarRancho, setBuscarRancho] = useState("");

  const candidatos = ranchosDisponibles
    .filter((r) => !seleccionados.includes(r.id))
    .filter((r) => r.nombre.toLowerCase().includes(buscarRancho.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3.5 rounded-2xl border border-aventurea-navy/30 bg-aventurea-surface p-5"
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Título</label>
          <input
            type="text"
            name="titulo"
            required
            defaultValue={inicial?.titulo ?? ""}
            placeholder="Ej. Lugares para tu evento en Alajuela"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Subtítulo (opcional)</label>
          <input
            type="text"
            name="subtitulo"
            defaultValue={inicial?.subtitulo ?? ""}
            placeholder="Un texto corto debajo del título"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Tipo</label>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoSeccionHome)}
            className={inputCls}
          >
            <option value="categoria">Por categoría</option>
            <option value="ubicacion">Por zona</option>
            <option value="manual">Selección manual</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Orden (menor = aparece antes)</label>
          <input
            type="number"
            name="orden"
            defaultValue={inicial?.orden ?? 0}
            className={inputCls}
          />
        </div>
      </div>

      {tipo === "categoria" && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Categoría</label>
            <select
              name="categoria"
              value={categoriaSel}
              onChange={(e) => setCategoriaSel(e.target.value as Categoria)}
              className={inputCls}
            >
              <option value="">Elegí una categoría</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Subcategoría (opcional)</label>
            <select name="subcategoria" defaultValue={inicial?.subcategoria ?? ""} className={inputCls}>
              <option value="">Todas</option>
              {categoriaSel &&
                SUBCATEGORIAS[categoriaSel].map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {tipo === "ubicacion" && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Provincia</label>
            <select
              name="provincia"
              value={provinciaSel}
              onChange={(e) => setProvinciaSel(e.target.value as Provincia)}
              className={inputCls}
            >
              <option value="">Elegí una provincia</option>
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cantón (opcional)</label>
            <select name="canton" defaultValue={inicial?.canton ?? ""} className={inputCls}>
              <option value="">Todos</option>
              {provinciaSel &&
                CANTONES[provinciaSel].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {tipo === "manual" && (
        <div>
          <label className={labelCls}>Proveedores en esta sección</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {seleccionados.length === 0 && (
              <p className="text-[12.5px] text-aventurea-ink-soft">Todavía no agregaste ninguno.</p>
            )}
            {seleccionados.map((id) => {
              const r = ranchosDisponibles.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-aventurea-navy/10 py-1 pl-3 pr-1.5 text-[12px] font-bold text-aventurea-navy"
                >
                  <input type="hidden" name="rancho_ids" value={id} />
                  {r?.nombre ?? id}
                  <button
                    type="button"
                    onClick={() => setSeleccionados((prev) => prev.filter((x) => x !== id))}
                    className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-aventurea-navy hover:text-white"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
          <input
            type="text"
            value={buscarRancho}
            onChange={(e) => setBuscarRancho(e.target.value)}
            placeholder="Buscar proveedor por nombre..."
            className={inputCls}
          />
          {buscarRancho && (
            <div className="mt-1.5 flex flex-col gap-0.5 rounded-lg border border-aventurea-line bg-aventurea-cream-2 p-1.5">
              {candidatos.length === 0 && (
                <p className="px-2 py-1 text-[12.5px] text-aventurea-ink-soft">Sin resultados.</p>
              )}
              {candidatos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSeleccionados((prev) => [...prev, c.id]);
                    setBuscarRancho("");
                  }}
                  className="rounded-md px-2 py-1.5 text-left text-[13px] text-aventurea-ink hover:bg-white"
                >
                  {c.nombre}{" "}
                  <span className="text-aventurea-ink-soft">· {CATEGORIA_LABEL[c.categoria]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-aventurea-navy px-4 py-2 text-[13px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {pending ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-xl border border-aventurea-line px-4 py-2 text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
