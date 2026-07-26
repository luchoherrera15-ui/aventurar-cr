"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconCamera, IconFrame, IconTrash, IconWarning } from "@/components/icons";
import { actualizarRancho, type EditarRanchoState } from "./actions";
import {
  AMENIDADES_GRUPOS,
  CATEGORIAS,
  CATEGORIA_LABEL,
  FOTOS_DESTACADAS,
  FOTOS_MAX,
  FOTO_ALTO_MIN,
  FOTO_ANCHO_MIN,
  CANTONES,
  PROVINCIAS,
  SUBCATEGORIAS,
  type Categoria,
  type Provincia,
  type Rancho,
} from "../types";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

// Los nombres de archivo llegan tal cual del dispositivo del dueño —
// los limpiamos para que la ruta en el bucket sea siempre válida.
function nombreSeguro(nombre: string) {
  return nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
}

type FotoNueva = { file: File; preview: string };

export default function EditarRanchoForm({ rancho }: { rancho: Rancho }) {
  const [state, formAction, pending] = useActionState<
    EditarRanchoState,
    FormData
  >(actualizarRancho, undefined);

  const [categoria, setCategoria] = useState<Categoria>(rancho.categoria);
  const [subcategoria, setSubcategoria] = useState(rancho.subcategoria ?? "");
  const [fotoPreview, setFotoPreview] = useState<string | null>(rancho.foto_url);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoAviso, setFotoAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [subidaError, setSubidaError] = useState<string | null>(null);

  const [galeria, setGaleria] = useState<string[]>(rancho.fotos ?? []);
  const [fotosNuevas, setFotosNuevas] = useState<FotoNueva[]>([]);
  const [amenidades, setAmenidades] = useState<string[]>(rancho.amenidades ?? []);
  const [provincia, setProvincia] = useState<Provincia | "">(
    rancho.provincia ?? "",
  );
  const [canton, setCanton] = useState(rancho.canton ?? "");

  const esLugar = categoria === "lugares";
  const totalFotos = galeria.length + fotosNuevas.length;
  const espacioLibre = FOTOS_MAX - totalFotos;

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

  function onGaleriaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, espacioLibre);
    if (files.length === 0) return;
    setFotosNuevas((prev) => [
      ...prev,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    // Permite volver a elegir el mismo archivo si el dueño lo quita y lo re-agrega.
    e.target.value = "";
  }

  function quitarDeGaleria(url: string) {
    setGaleria((prev) => prev.filter((u) => u !== url));
  }

  function quitarNueva(preview: string) {
    setFotosNuevas((prev) => prev.filter((f) => f.preview !== preview));
  }

  function toggleAmenidad(id: string) {
    setAmenidades((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  async function onSubmit(formData: FormData) {
    const supabase = createClient();
    setSubiendo(true);
    setSubidaError(null);

    if (fotoFile) {
      const path = `${rancho.id}/${Date.now()}-${nombreSeguro(fotoFile.name)}`;
      const { error } = await supabase.storage
        .from("ranchos-fotos")
        .upload(path, fotoFile, { upsert: true });
      if (error) {
        setSubiendo(false);
        setSubidaError("No se pudo subir la foto principal: " + error.message);
        return;
      }
      const { data } = supabase.storage.from("ranchos-fotos").getPublicUrl(path);
      formData.set("foto_url", data.publicUrl);
    }

    const urls = [...galeria];
    for (const { file } of fotosNuevas) {
      const path = `${rancho.id}/galeria/${Date.now()}-${nombreSeguro(file.name)}`;
      const { error } = await supabase.storage
        .from("ranchos-fotos")
        .upload(path, file, { upsert: true });
      if (error) {
        setSubiendo(false);
        setSubidaError("No se pudo subir una foto de la galería: " + error.message);
        return;
      }
      const { data } = supabase.storage.from("ranchos-fotos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    formData.set("fotos", JSON.stringify(urls.slice(0, FOTOS_MAX)));

    setSubiendo(false);
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
          Galería
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Las fotos de tu página
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Hasta <strong>{FOTOS_MAX} fotos</strong>. Las primeras{" "}
          <strong>{FOTOS_DESTACADAS}</strong> se muestran grandes en tu página y
          el resto queda en la galería de abajo. Mostrá los distintos espacios:
          el salón, la piscina, la zona verde, el parqueo.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {galeria.map((url, i) => (
            <FotoMiniatura
              key={url}
              src={url}
              destacada={i < FOTOS_DESTACADAS}
              onQuitar={() => quitarDeGaleria(url)}
            />
          ))}
          {fotosNuevas.map((f, i) => (
            <FotoMiniatura
              key={f.preview}
              src={f.preview}
              destacada={galeria.length + i < FOTOS_DESTACADAS}
              nueva
              onQuitar={() => quitarNueva(f.preview)}
            />
          ))}
          {espacioLibre > 0 && (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange hover:text-aventurea-orange">
              <IconCamera className="h-5 w-5" />
              <span className="text-[11.5px] font-bold">Agregar</span>
              <span className="text-[10.5px]">quedan {espacioLibre}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onGaleriaChange}
                className="hidden"
              />
            </label>
          )}
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
              onChange={(e) => {
                setCategoria(e.target.value as Categoria);
                setSubcategoria("");
              }}
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
            <label className={labelCls}>
              {esLugar ? "Tipo de lugar" : "¿Qué ofrecés exactamente?"}
            </label>
            <select
              name="subcategoria"
              required
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecciona una opción</option>
              {SUBCATEGORIAS[categoria].map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
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
            <label className={labelCls}>Descripción corta</label>
            <textarea
              name="descripcion"
              defaultValue={rancho.descripcion ?? ""}
              placeholder="Una o dos líneas — es lo que se lee en el directorio."
              className={`min-h-[80px] ${inputCls}`}
            />
          </div>

          <div>
            <label className={labelCls}>Presentación larga</label>
            <textarea
              name="descripcion_larga"
              defaultValue={rancho.descripcion_larga ?? ""}
              placeholder="Contá la historia del lugar, qué lo hace especial, qué incluye el alquiler, cómo llegar... Este texto se muestra grande en tu página, encima de una de tus fotos."
              className={`min-h-[130px] ${inputCls}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Provincia</label>
              <select
                name="provincia"
                required
                value={provincia}
                onChange={(e) => {
                  setProvincia(e.target.value as Provincia);
                  setCanton("");
                }}
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
              <select
                name="canton"
                value={canton}
                onChange={(e) => setCanton(e.target.value)}
                disabled={!provincia}
                className={inputCls}
              >
                <option value="">
                  {provincia ? "Selecciona" : "Elegí primero la provincia"}
                </option>
                {/* El cantón viejo puede no estar en la lista oficial
                    (antes se escribía a mano): se conserva como opción. */}
                {canton && !CANTONES[provincia as Provincia]?.includes(canton) && (
                  <option value={canton}>{canton}</option>
                )}
                {(provincia ? CANTONES[provincia as Provincia] : []).map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
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

          <div>
            <label className={labelCls}>Ubicación en el mapa</label>
            <input
              type="text"
              name="mapa_url"
              placeholder="Pegá acá el link de Google Maps de tu lugar"
              defaultValue={rancho.mapa_url ?? ""}
              className={inputCls}
            />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-zinc-500">
              Abrí Google Maps, buscá tu lugar, tocá <strong>Compartir</strong> y
              pegá acá el link. Con eso tu página muestra los botones de{" "}
              <strong>Google Maps</strong> y <strong>Waze</strong> para que el
              cliente llegue sin preguntar. También podés pegar las coordenadas
              directo (ej. <code>9.9281, -84.0907</code>).
              {rancho.latitud !== null && rancho.longitud !== null && (
                <>
                  {" "}
                  <span className="font-bold text-aventurea-green">
                    ✓ Ubicación guardada ({rancho.latitud}, {rancho.longitud}).
                  </span>
                </>
              )}
            </p>
          </div>

          {esLugar && (
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

      <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
        <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
          Redes sociales
        </p>
        <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
          Dónde más te pueden encontrar
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
          Se muestran como botones en tu página. Dejá en blanco las que no usés.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Instagram</label>
            <input
              type="text"
              name="instagram"
              placeholder="@turancho o el link completo"
              defaultValue={rancho.instagram ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Facebook</label>
            <input
              type="text"
              name="facebook"
              placeholder="Nombre de tu página o el link"
              defaultValue={rancho.facebook ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>TikTok</label>
            <input
              type="text"
              name="tiktok"
              placeholder="@turancho o el link completo"
              defaultValue={rancho.tiktok ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Sitio web</label>
            <input
              type="text"
              name="sitio_web"
              placeholder="www.turancho.com"
              defaultValue={rancho.sitio_web ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {esLugar && (
        <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5.5 shadow-sm">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
            Amenidades
          </p>
          <h3 className="mt-1 text-[15.5px] font-bold text-aventurea-ink">
            ¿Qué tiene tu lugar?
          </h3>
          <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
            Marcá todo lo que ofrecés. Se muestra como una lista de íconos en tu
            página — entre más completo, más confianza le da al cliente.
          </p>

          {amenidades.map((a) => (
            <input key={a} type="hidden" name="amenidades" value={a} />
          ))}

          <div className="mt-4 flex flex-col gap-5">
            {AMENIDADES_GRUPOS.map((grupo) => (
              <div key={grupo.titulo}>
                <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  {grupo.titulo}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {grupo.items.map((item) => {
                    const activo = amenidades.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAmenidad(item.id)}
                        aria-pressed={activo}
                        className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                          activo
                            ? "border-aventurea-orange bg-aventurea-orange/10 text-aventurea-orange"
                            : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-orange"
                        }`}
                      >
                        {activo && <span aria-hidden>✓ </span>}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
          {subiendo ? "Subiendo fotos..." : pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

function FotoMiniatura({
  src,
  destacada,
  nueva = false,
  onQuitar,
}: {
  src: string;
  destacada: boolean;
  nueva?: boolean;
  onQuitar: () => void;
}) {
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-aventurea-cream-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      {destacada && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-aventurea-orange px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
          Destacada
        </span>
      )}
      {nueva && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
          Sin guardar
        </span>
      )}
      <button
        type="button"
        onClick={onQuitar}
        aria-label="Quitar foto"
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-red-600 focus:opacity-100 group-hover:opacity-100"
      >
        <IconTrash className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
