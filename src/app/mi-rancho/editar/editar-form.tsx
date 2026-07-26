"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconCamera, IconFrame, IconWarning } from "@/components/icons";
import { actualizarRancho, type EditarRanchoState } from "./actions";
import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  FOTO_ALTO_MIN,
  FOTO_ANCHO_MIN,
  PROVINCIAS,
  type Categoria,
  type Rancho,
} from "../types";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

export default function EditarRanchoForm({ rancho }: { rancho: Rancho }) {
  const [state, formAction, pending] = useActionState<
    EditarRanchoState,
    FormData
  >(actualizarRancho, undefined);

  const [categoria, setCategoria] = useState<Categoria>(rancho.categoria);
  const [fotoPreview, setFotoPreview] = useState<string | null>(rancho.foto_url);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoAviso, setFotoAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [subidaError, setSubidaError] = useState<string | null>(null);
  const esSalon = categoria === "salon";

  function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoAviso(null);
    const url = URL.createObjectURL(file);
    setFotoPreview(url);

    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth < FOTO_ANCHO_MIN || img.naturalHeight < FOTO_ALTO_MIN) {
        setFotoAviso(
          `Esta foto es de ${img.naturalWidth}×${img.naturalHeight}px. Se recomienda al menos ${FOTO_ANCHO_MIN}×${FOTO_ALTO_MIN}px para que no se vea borrosa — igual la podés subir así.`,
        );
      }
    };
    img.src = url;
  }

  async function onSubmit(formData: FormData) {
    if (fotoFile) {
      setSubiendo(true);
      setSubidaError(null);
      const supabase = createClient();
      const path = `${rancho.id}/${Date.now()}-${fotoFile.name}`;
      const { error } = await supabase.storage
        .from("ranchos-fotos")
        .upload(path, fotoFile, { upsert: true });
      setSubiendo(false);
      if (error) {
        setSubidaError("No se pudo subir la foto: " + error.message);
        return;
      }
      const { data } = supabase.storage.from("ranchos-fotos").getPublicUrl(path);
      formData.set("foto_url", data.publicUrl);
    }
    formAction(formData);
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Foto principal
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Es la que se ve en tu card del directorio
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Recomendado: al menos <strong>{FOTO_ANCHO_MIN}×{FOTO_ALTO_MIN}px</strong>,
          proporción horizontal (4:3), formato JPG o PNG. Evitá fotos muy
          oscuras — el nombre se muestra encima con letras blancas.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative h-[160px] w-full overflow-hidden rounded-xl bg-gradient-to-br from-aventurea-cream-2 to-aventurea-line sm:w-[220px]">
            {fotoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoPreview}
                alt="Vista previa"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center opacity-40">
                <IconFrame className="h-9 w-9" />
              </span>
            )}
          </div>
          <div className="flex-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-orange hover:text-aventurea-orange">
              <IconCamera className="h-4 w-4" /> {fotoPreview ? "Cambiar foto" : "Subir foto"}
              <input
                type="file"
                accept="image/*"
                onChange={onFotoChange}
                className="hidden"
              />
            </label>
            {fotoAviso && (
              <p className="flex items-start gap-1.5 mt-2.5 max-w-[46ch] text-[12px] leading-relaxed text-aventurea-orange">
                <IconWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fotoAviso}
              </p>
            )}
            {subidaError && (
              <p className="mt-2.5 text-[12px] font-bold text-red-700">
                {subidaError}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Información
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Datos de tu publicación
        </h3>

        <div className="mt-4 flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Tipo de servicio</label>
            <select
              name="categoria"
              required
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
              className={inputCls}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Nombre</label>
            <input
              type="text"
              name="nombre"
              required
              defaultValue={rancho.nombre}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              name="descripcion"
              defaultValue={rancho.descripcion ?? ""}
              className={`min-h-[80px] ${inputCls}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Provincia</label>
              <select
                name="provincia"
                required
                defaultValue={rancho.provincia ?? ""}
                className={inputCls}
              >
                <option value="">Selecciona</option>
                {PROVINCIAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cantón</label>
              <input
                type="text"
                name="canton"
                defaultValue={rancho.canton ?? ""}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Dirección exacta</label>
            <input
              type="text"
              name="direccion_exacta"
              placeholder="Ej. Calle Monge, 200m norte de la iglesia"
              defaultValue={rancho.direccion_exacta ?? ""}
              className={inputCls}
            />
          </div>

          {esSalon && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Capacidad mínima</label>
                <input
                  type="number"
                  min={1}
                  name="capacidad_min"
                  defaultValue={rancho.capacidad_min ?? ""}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Capacidad máxima</label>
                <input
                  type="number"
                  min={1}
                  name="capacidad_max"
                  defaultValue={rancho.capacidad_max ?? ""}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Precio desde (₡)</label>
              <input
                type="number"
                min={0}
                name="precio_desde"
                defaultValue={rancho.precio_desde ?? ""}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>WhatsApp de contacto</label>
              <input
                type="text"
                name="contacto_whatsapp"
                defaultValue={rancho.contacto_whatsapp ?? ""}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </section>

      {state?.error && (
        <p className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded-xl bg-aventurea-green/10 p-3 text-[13px] font-bold text-aventurea-green">
          ✓ Guardado.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || subiendo}
          className="rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-orange-dark disabled:opacity-60"
        >
          {subiendo ? "Subiendo foto..." : pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
