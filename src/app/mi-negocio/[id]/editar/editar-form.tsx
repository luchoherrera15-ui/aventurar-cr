"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { comprimirImagen, FOTO_DE_VITRINA } from "@/lib/comprimir-imagen";
import { subirArchivo } from "@/lib/media/cliente-subida";
import { IconCamera, IconFrame, IconTrash, IconWarning } from "@/components/icons";
import { Lightbox } from "@/components/galeria-lightbox";
import { actualizarRancho, type EditarRanchoState } from "./actions";
import DetallesServicioForm from "@/components/detalles-servicio-form";
import SeccionPlegable from "@/components/seccion-plegable";
import { CAMPOS_POR_CATEGORIA, COBERTURA, type DetallesServicio } from "../../campos-servicio";
import {
  AMENIDADES,
  AMENIDADES_GRUPOS,
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
} from "../../types";
import {
  categoriaOptions,
  esUbicacionFija,
  usaSubcategoria,
} from "@/lib/categorias-vertical";
import { CAMPOS_POR_CATEGORIA_CITA } from "@/app/citas/campos-servicio";
import { COMODIDADES_CITA } from "@/app/citas/comodidades";
import type { CategoriaCita } from "@/app/citas/tipos";

const inputCls =
  "w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink placeholder:zinc-500";
const labelCls =
  "mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft";

// El saneado del nombre de archivo vivía acá, para armar la ruta del
// bucket. Ya no: la clave la deriva el SERVIDOR (src/lib/media/claves.ts),
// que además descarta travesías de ruta, caracteres de control y marcas
// bidi. Que el cliente no elija dónde se escribe es justamente el punto.

type FotoNueva = { file: File; preview: string };

export default function EditarRanchoForm({ rancho }: { rancho: Rancho }) {
  const [state, formAction, pending] = useActionState<
    EditarRanchoState,
    FormData
  >(actualizarRancho, undefined);

  const [categoria, setCategoria] = useState<string>(rancho.categoria);
  const [subcategoria, setSubcategoria] = useState(rancho.subcategoria ?? "");
  const [fotoPreview, setFotoPreview] = useState<string | null>(rancho.foto_url);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoAviso, setFotoAviso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [subidaError, setSubidaError] = useState<string | null>(null);

  // Si el negocio se editó antes desde el móvil, la portada puede venir
  // duplicada dentro de fotos — ahí se ve dos veces la misma imagen (una
  // como "Foto principal" y otra en la Galería). Se filtra acá y al
  // guardar queda afuera para siempre.
  const [galeria, setGaleria] = useState<string[]>(
    Array.from(new Set(rancho.fotos ?? [])).filter((u) => u !== rancho.foto_url),
  );
  const [fotosNuevas, setFotosNuevas] = useState<FotoNueva[]>([]);
  const [lightbox, setLightbox] = useState<{ fotos: string[]; indice: number } | null>(null);
  // Cuál de sus fotos va grande en la sección de presentación. Se guarda
  // por "clave": la URL si ya está subida, o el preview local si todavía
  // no. Al enviar se traduce a la URL definitiva.
  const [presentacionClave, setPresentacionClave] = useState<string | null>(
    rancho.foto_presentacion,
  );
  const [amenidades, setAmenidades] = useState<string[]>(rancho.amenidades ?? []);
  const [nuevaAmenidad, setNuevaAmenidad] = useState("");
  const [detalles, setDetalles] = useState<DetallesServicio>(
    (rancho.detalles as DetallesServicio) ?? {},
  );
  const [provincia, setProvincia] = useState<Provincia | "">(
    rancho.provincia ?? "",
  );
  const [canton, setCanton] = useState(rancho.canton ?? "");

  // Dirección exacta y ubicación en el mapa: cualquier negocio con
  // ubicación física fija los pide — Lugares de Eventos, y CUALQUIER
  // negocio que no sea Eventos (Citas/Hospedajes/Restaurantes son
  // siempre un local fijo, no un proveedor móvil).
  const esLugar = esUbicacionFija(rancho.vertical ?? "eventos", categoria);
  // Exclusivo de Lugares de Eventos: capacidad y amenidades no aplican
  // a Citas/Hospedajes/Restaurantes aunque también tengan ubicación fija.
  const esLugarEventos = rancho.vertical === "eventos" && categoria === "lugares";
  // El proveedor MÓVIL de Eventos (alimentación, animación, organización,
  // decoración, otros): el único caso que pide cobertura/traslado en vez
  // de dirección exacta. Citas/Hospedajes/Restaurantes son locales fijos,
  // no proveedores móviles, así que nunca entran acá.
  const esProveedorMovilEventos = rancho.vertical === "eventos" && !esLugarEventos;
  const esVerticalCitas = rancho.vertical === "citas";
  const totalFotos = galeria.length + fotosNuevas.length;
  const espacioLibre = FOTOS_MAX - totalFotos;

  // Grupos de "Detalles del servicio" para Citas: los propios de la
  // categoría, más COBERTURA (zonas, costo de traslado) si el negocio de
  // "belleza" marcó que atiende a domicilio.
  const gruposDetallesCita = esVerticalCitas
    ? [
        ...(CAMPOS_POR_CATEGORIA_CITA[categoria as CategoriaCita] ?? []),
        ...(categoria === "belleza" && detalles.servicio_domicilio === true
          ? [COBERTURA]
          : []),
      ]
    : [];

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
    if (presentacionClave === url) setPresentacionClave(null);
  }

  function quitarNueva(preview: string) {
    setFotosNuevas((prev) => prev.filter((f) => f.preview !== preview));
    if (presentacionClave === preview) setPresentacionClave(null);
  }

  function marcarPresentacion(clave: string) {
    setPresentacionClave((prev) => (prev === clave ? null : clave));
  }

  function toggleAmenidad(id: string) {
    setAmenidades((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  function agregarAmenidad() {
    const limpia = nuevaAmenidad.trim();
    if (!limpia || amenidades.includes(limpia)) {
      setNuevaAmenidad("");
      return;
    }
    setAmenidades((prev) => [...prev, limpia]);
    setNuevaAmenidad("");
  }

  /**
   * Sube UNA foto a Cloudflare y devuelve su URL, o corta con el mensaje
   * que haya mandado el servidor.
   *
   * ── LO QUE NO CAMBIA ─────────────────────────────────────────────
   *
   * Lo que se guarda sigue siendo una URL absoluta, igual que antes. Por
   * eso las fotos viejas de Supabase y las nuevas de Cloudflare conviven
   * en el mismo arreglo `fotos` sin que ninguna pantalla de lectura se
   * entere. Lo que cambia es DÓNDE vive el archivo, no cómo se referencia.
   *
   * La compresión se conserva: `FOTO_DE_VITRINA` es 2560px al 90%, que es
   * un original digno —sirve para imprimir— y evita mandar 12 megapíxeles
   * crudos desde un celular. Cloudflare genera las cuatro variantes a
   * partir de eso.
   */
  async function subirFoto(file: File, dondeFalla: string): Promise<string | null> {
    const liviana = await comprimirImagen(file, FOTO_DE_VITRINA);
    const r = await subirArchivo({
      archivo: liviana,
      entidad: { tipo: "rancho", id: rancho.id },
    });

    if (!r.ok) {
      setSubiendo(false);
      setSubidaError(`${dondeFalla}: ${r.mensaje}`);
      return null;
    }
    if (!r.url) {
      setSubiendo(false);
      setSubidaError(`${dondeFalla}: la foto subió pero no se pudo obtener su dirección.`);
      return null;
    }
    return r.url;
  }

  async function onSubmit(formData: FormData) {
    setSubiendo(true);
    setSubidaError(null);

    if (fotoFile) {
      const url = await subirFoto(fotoFile, "No se pudo subir la foto principal");
      if (!url) return;
      formData.set("foto_url", url);
    }

    const urls = [...galeria];
    let presentacionUrl = galeria.includes(presentacionClave ?? "")
      ? presentacionClave
      : null;
    for (const { file, preview } of fotosNuevas) {
      const url = await subirFoto(file, "No se pudo subir una foto de la galería");
      if (!url) return;
      urls.push(url);
      // Si la elegida para presentación era esta foto recién subida, hay
      // que mandar la URL real y no el preview local, que no existe fuera
      // de esta pestaña.
      if (presentacionClave === preview) presentacionUrl = url;
    }
    formData.set("fotos", JSON.stringify(urls.slice(0, FOTOS_MAX)));
    formData.set("foto_presentacion", presentacionUrl ?? "");

    setSubiendo(false);
    formAction(formData);
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="rancho_id" value={rancho.id} />
      <SeccionPlegable
        abierta
        etiqueta="Foto principal"
        titulo="Se ve en tu card del directorio y de fondo del calendario"
        descripcion={
          <>
            Es la primera impresión: sale en la lista de resultados y detrás
            del calendario de reservas, con tu nombre encima en letras
            blancas. Recomendado: al menos{" "}
            <strong>{FOTO_ANCHO_MIN}×{FOTO_ALTO_MIN}px</strong>, horizontal
            (4:3), JPG o PNG. Elegí una <strong>amplia y no muy oscura</strong>,
            porque encima le montamos una capa oscura para que el texto se lea.
          </>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative h-[160px] w-full overflow-hidden rounded-xl bg-gradient-to-br from-aventurea-cream-2 to-aventurea-line sm:w-[220px]">
            {fotoPreview ? (
              <button
                type="button"
                onClick={() => setLightbox({ fotos: [fotoPreview], indice: 0 })}
                aria-label="Ver la foto principal en grande"
                className="block h-full w-full"
              >
                {/* Puede ser la foto real (Supabase) o una vista previa
                    local (blob:) del archivo recién elegido — por eso
                    unoptimized cuando no es http. */}
                <Image
                  src={fotoPreview}
                  alt="Vista previa"
                  fill
                  unoptimized={!fotoPreview.startsWith("http")}
                  sizes="220px"
                  className="object-cover"
                />
              </button>
            ) : (
              <span className="absolute inset-0 flex items-center justify-center opacity-40">
                <IconFrame className="h-9 w-9" />
              </span>
            )}
          </div>
          <div className="flex-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-aventurea-line bg-aventurea-surface px-4 py-2.5 text-[13px] font-bold text-aventurea-ink hover:border-aventurea-sky hover:text-aventurea-orange">
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
      </SeccionPlegable>

      <SeccionPlegable
        abierta
        id="fotos"
        etiqueta="Galería"
        titulo="Las fotos de tu página"
        descripcion={
          <>
            Hasta <strong>{FOTOS_MAX} fotos</strong>. Las primeras{" "}
            <strong>{FOTOS_DESTACADAS}</strong> se muestran grandes en tu página y
            el resto queda en la galería de abajo. Mostrá los distintos espacios:
            el salón, la piscina, la zona verde, el parqueo.
          </>
        }
        resumen={totalFotos > 0 ? `${totalFotos} foto${totalFotos === 1 ? "" : "s"}` : undefined}
      >
        <p className="rounded-xl bg-aventurea-cream-2 p-3 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
          <strong className="text-aventurea-ink">Elegí la de presentación:</strong>{" "}
          pasá el mouse por una foto y tocá <em>Usar de presentación</em>. Esa
          es la que sale <strong>grande y a todo el ancho</strong>, con tu
          descripción encima. Si no elegís ninguna, escogemos una nosotros.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {galeria.map((url, i) => (
            <FotoMiniatura
              key={url}
              src={url}
              destacada={i < FOTOS_DESTACADAS}
              presentacion={presentacionClave === url}
              onPresentacion={() => marcarPresentacion(url)}
              onQuitar={() => quitarDeGaleria(url)}
              onAbrir={() =>
                setLightbox({
                  fotos: [...galeria, ...fotosNuevas.map((f) => f.preview)],
                  indice: i,
                })
              }
            />
          ))}
          {fotosNuevas.map((f, i) => (
            <FotoMiniatura
              key={f.preview}
              src={f.preview}
              destacada={galeria.length + i < FOTOS_DESTACADAS}
              presentacion={presentacionClave === f.preview}
              onPresentacion={() => marcarPresentacion(f.preview)}
              nueva
              onQuitar={() => quitarNueva(f.preview)}
              onAbrir={() =>
                setLightbox({
                  fotos: [...galeria, ...fotosNuevas.map((f2) => f2.preview)],
                  indice: galeria.length + i,
                })
              }
            />
          ))}
          {espacioLibre > 0 && (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-sky hover:text-aventurea-orange">
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
      </SeccionPlegable>

      {/* Abierta de entrada solo si faltan datos obligatorios: un campo
          `required` vacío dentro de un <details> cerrado bloquearía el
          guardado sin que el navegador pueda mostrar dónde está el error. */}
      <SeccionPlegable
        abierta={!rancho.subcategoria || !rancho.provincia}
        etiqueta="Información"
        titulo="Datos de tu publicación"
        descripcion="Nombre, descripción, ubicación, precio base y contacto."
      >
        <div className="flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Tipo de servicio</label>
            <select
              name="categoria"
              required
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value);
                setSubcategoria("");
              }}
              className={inputCls}
            >
              {categoriaOptions(rancho.vertical ?? "eventos").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Solo Eventos tiene este segundo nivel — las demás verticales
              son de una sola categoría. */}
          {usaSubcategoria(rancho.vertical ?? "eventos") && (
            <div>
              <label className={labelCls}>
                {esLugarEventos ? "Tipo de lugar" : "¿Qué ofrecés exactamente?"}
              </label>
              <select
                name="subcategoria"
                required
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                className={inputCls}
              >
                <option value="">Selecciona una opción</option>
                {SUBCATEGORIAS[categoria as Categoria].map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              placeholder={
                esLugar
                  ? "Contá la historia del lugar, qué lo hace especial, qué incluye el alquiler, cómo llegar... Este texto se muestra grande en tu página, encima de una de tus fotos."
                  : "Contá la historia de tu negocio, qué lo hace especial, qué incluye tu servicio, cómo trabajás... Este texto se muestra grande en tu página, encima de una de tus fotos."
              }
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
            {esProveedorMovilEventos && (
              <p className="text-[11.5px] leading-relaxed text-zinc-500 sm:col-span-2">
                Tu zona de cobertura — vos te trasladás al evento del cliente,
                no hace falta una dirección exacta ni ubicación en el mapa.
              </p>
            )}
          </div>

          {esLugar && (
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
          )}

          {esLugar && (
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
          )}

          {esLugarEventos && (
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
      </SeccionPlegable>

      <SeccionPlegable
        etiqueta="Redes sociales"
        titulo="Dónde más te pueden encontrar"
        descripcion="Se muestran como botones en tu página. Dejá en blanco las que no usés."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </SeccionPlegable>

      {/* El proveedor MÓVIL de Eventos usa los campos de mi-negocio/campos-servicio.ts. */}
      {esProveedorMovilEventos && (
        <DetallesServicioForm
          grupos={CAMPOS_POR_CATEGORIA[categoria as Categoria] ?? []}
          valores={detalles}
          onCambiar={setDetalles}
        />
      )}

      {/* Citas tiene su propio set de campos por categoría (belleza,
          barbería, uñas, spa, consultorio, otros) — nunca precio ni
          duración, eso vive en el Catálogo. */}
      {esVerticalCitas && (
        <DetallesServicioForm
          grupos={gruposDetallesCita}
          valores={detalles}
          onCambiar={setDetalles}
        />
      )}

      {esLugarEventos && (
        <SeccionPlegable
          etiqueta="Amenidades"
          titulo="¿Qué tiene tu lugar?"
          descripcion="Marcá todo lo que ofrecés. Se muestra como una lista de íconos en tu página — entre más completo, más confianza le da al cliente."
          resumen={amenidades.length > 0 ? `${amenidades.length} marcadas` : undefined}
        >
          {amenidades.map((a) => (
            <input key={a} type="hidden" name="amenidades" value={a} />
          ))}

          <div className="flex flex-col gap-5">
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
                            ? "border-aventurea-sky bg-aventurea-sky/10 text-aventurea-orange"
                            : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-sky"
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

            {amenidades.some((a) => !AMENIDADES.includes(a)) && (
              <div>
                <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Otras
                </h4>
                <div className="flex flex-wrap gap-2">
                  {amenidades
                    .filter((a) => !AMENIDADES.includes(a))
                    .map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenidad(a)}
                        className="flex items-center gap-1.5 rounded-lg border border-aventurea-sky bg-aventurea-sky/10 px-3 py-1.5 text-[12.5px] font-bold text-aventurea-orange"
                      >
                        {a}
                        <span aria-hidden>×</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                ¿No está lo tuyo?
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevaAmenidad}
                  onChange={(e) => setNuevaAmenidad(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarAmenidad();
                    }
                  }}
                  placeholder="Ej. Cochera techada"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={agregarAmenidad}
                  className="shrink-0 rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-sky hover:text-aventurea-orange"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </SeccionPlegable>
      )}

      {esVerticalCitas && (
        <SeccionPlegable
          etiqueta="Comodidades"
          titulo="¿Qué tiene tu local?"
          descripcion="Marcá todo lo que ofrecés. Se muestra como una lista de íconos en tu página — entre más completo, más confianza le da al cliente."
          resumen={amenidades.length > 0 ? `${amenidades.length} marcadas` : undefined}
        >
          {amenidades.map((a) => (
            <input key={a} type="hidden" name="amenidades" value={a} />
          ))}

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {COMODIDADES_CITA.map((item) => {
                const activo = amenidades.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleAmenidad(item.id)}
                    aria-pressed={activo}
                    className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                      activo
                        ? "border-aventurea-sky bg-aventurea-sky/10 text-aventurea-orange"
                        : "border-aventurea-line text-aventurea-ink-soft hover:border-aventurea-sky"
                    }`}
                  >
                    {activo && <span aria-hidden>✓ </span>}
                    {item.label}
                  </button>
                );
              })}
            </div>

            {amenidades.some((a) => !COMODIDADES_CITA.some((c) => c.id === a)) && (
              <div>
                <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Otras
                </h4>
                <div className="flex flex-wrap gap-2">
                  {amenidades
                    .filter((a) => !COMODIDADES_CITA.some((c) => c.id === a))
                    .map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenidad(a)}
                        className="flex items-center gap-1.5 rounded-lg border border-aventurea-sky bg-aventurea-sky/10 px-3 py-1.5 text-[12.5px] font-bold text-aventurea-orange"
                      >
                        {a}
                        <span aria-hidden>×</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                ¿No está lo tuyo?
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevaAmenidad}
                  onChange={(e) => setNuevaAmenidad(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarAmenidad();
                    }
                  }}
                  placeholder="Ej. Cabinas privadas"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={agregarAmenidad}
                  className="shrink-0 rounded-lg border border-aventurea-line px-3 py-1.5 text-[12.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-sky hover:text-aventurea-orange"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </SeccionPlegable>
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
          className="rounded-xl bg-aventurea-sky px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-sky-dark disabled:opacity-60"
        >
          {subiendo ? "Subiendo fotos..." : pending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      <Lightbox
        fotos={lightbox?.fotos ?? []}
        nombre={rancho.nombre}
        abierta={lightbox ? lightbox.indice : null}
        onCambiar={(indice) => setLightbox((prev) => (prev ? { ...prev, indice } : prev))}
        onCerrar={() => setLightbox(null)}
      />
    </form>
  );
}

function FotoMiniatura({
  src,
  destacada,
  presentacion,
  onPresentacion,
  nueva = false,
  onQuitar,
  onAbrir,
}: {
  src: string;
  destacada: boolean;
  presentacion: boolean;
  onPresentacion: () => void;
  nueva?: boolean;
  onQuitar: () => void;
  onAbrir: () => void;
}) {
  return (
    <div
      className={`group relative aspect-[4/3] overflow-hidden rounded-xl bg-aventurea-cream-2 ${
        presentacion ? "ring-2 ring-aventurea-sky ring-offset-2" : ""
      }`}
    >
      <button
        type="button"
        onClick={onAbrir}
        aria-label="Ver la foto en grande"
        className="block h-full w-full"
      >
        {/* "nueva" es una vista previa local (blob:, del archivo recién
            elegido, todavía sin subir) — next/image no puede optimizar
            eso, así que va sin pasar por su pipeline. */}
        <Image src={src} alt="" fill unoptimized={nueva} sizes="200px" className="object-cover" />
      </button>
      {presentacion ? (
        <span className="absolute left-1.5 top-1.5 rounded-lg bg-aventurea-sky px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
          Presentación
        </span>
      ) : (
        destacada && (
          <span className="absolute left-1.5 top-1.5 rounded-lg bg-black/60 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
            Destacada
          </span>
        )
      )}
      <button
        type="button"
        onClick={onPresentacion}
        className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-black/65 py-1.5 text-[10.5px] font-bold text-white opacity-0 transition-opacity hover:bg-black/85 focus:opacity-100 group-hover:opacity-100"
      >
        {presentacion ? "Quitar de presentación" : "Usar de presentación"}
      </button>
      {nueva && (
        <span className="absolute right-1.5 bottom-1.5 rounded-lg bg-black/60 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white group-hover:opacity-0">
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
