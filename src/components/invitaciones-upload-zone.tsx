"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { IconImagePlus, IconVideoPlus, IconX } from "./icons";

/**
 * El adjuntador del generador de invitaciones.
 *
 * Antes cada archivo se leía como base64 y viajaba dentro del POST del
 * server action: por eso el techo era de 4 MB (fotos) y 6 MB (videos) —
 * más que eso y Vercel cortaba el body. Ahora el navegador sube el
 * archivo DIRECTO al bucket con la sesión del cliente y solo manda la
 * URL, así que caben canciones enteras y videos de verdad.
 *
 * Todo aterriza en `invitaciones/subidas/{usuario}/…`; cuando la
 * invitación se genera, la ruta del API los muda a
 * `invitaciones/{id}/…` para que el panel de almacenamiento pueda
 * decir de quién y de cuál invitación es cada mega.
 */

type Tipo = "imagenes" | "videos" | "audios";

const BUCKET = "ranchos-fotos";

/** Techos por tipo. El bucket admite 100 MB (migración 0079). */
const MAX_BYTES: Record<Tipo, number> = {
  imagenes: 25 * 1024 * 1024,
  videos: 100 * 1024 * 1024,
  audios: 100 * 1024 * 1024,
};

const AJUSTES: Record<
  Tipo,
  { titulo: string; accept: string; formatos: string; prefijoMime: string }
> = {
  imagenes: {
    titulo: "Imágenes",
    accept: "image/*",
    formatos: "PNG, JPG, WebP · hasta 25 MB",
    prefijoMime: "image/",
  },
  videos: {
    titulo: "Videos",
    accept: "video/*",
    formatos: "MP4, WebM · hasta 100 MB",
    prefijoMime: "video/",
  },
  audios: {
    titulo: "Música",
    accept: "audio/*",
    formatos: "MP3, M4A, WAV, OGG · hasta 100 MB",
    prefijoMime: "audio/",
  },
};

function pesoBonito(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "cancion final.mp3" → "mp3"; sin extensión reconocible, "bin". */
function extensionDe(file: File) {
  const porNombre = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (porNombre && /^[a-z0-9]{2,5}$/.test(porNombre)) return porNombre;
  const porMime = file.type.split("/")[1]?.split(";")[0] ?? "bin";
  return porMime.replace(/[^a-z0-9]/g, "") || "bin";
}

interface UploadZoneProps {
  imagenes: string[];
  videos: string[];
  audios: string[];
  onImagenesChange: (urls: string[]) => void;
  onVideosChange: (urls: string[]) => void;
  onAudiosChange: (urls: string[]) => void;
  disabled?: boolean;
}

export default function UploadZone({
  imagenes,
  videos,
  audios,
  onImagenesChange,
  onVideosChange,
  onAudiosChange,
  disabled = false,
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState<Tipo | null>(null);
  const [aviso, setAviso] = useState("");
  const [subiendo, setSubiendo] = useState(0);

  const valores: Record<Tipo, string[]> = { imagenes, videos, audios };
  const setters: Record<Tipo, (urls: string[]) => void> = {
    imagenes: onImagenesChange,
    videos: onVideosChange,
    audios: onAudiosChange,
  };

  function handleDrag(e: React.DragEvent, tipo: Tipo) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(tipo);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  }

  /**
   * Sube al bucket todo lo que calce con el tipo de la caja y agrega
   * las URLs de una sola vez — un setter por archivo se pisaría entre
   * sí por el array del closure.
   */
  async function agregarArchivos(files: File[], tipo: Tipo) {
    const { prefijoMime } = AJUSTES[tipo];
    const validos = files.filter((f) => f.type.startsWith(prefijoMime));
    const noCalzan = files.length - validos.length;
    const chicos = validos.filter((f) => f.size <= MAX_BYTES[tipo]);
    const pesados = validos.length - chicos.length;

    const quejas: string[] = [];
    if (noCalzan > 0) {
      quejas.push(
        `${noCalzan} archivo${noCalzan > 1 ? "s no eran" : " no era"} de ${AJUSTES[tipo].titulo.toLowerCase()}`,
      );
    }
    if (pesados > 0) {
      quejas.push(
        `${pesados} superaba${pesados > 1 ? "n" : ""} el límite de ${pesoBonito(MAX_BYTES[tipo])}`,
      );
    }
    setAviso(quejas.join(" · "));
    if (chicos.length === 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAviso("Iniciá sesión de nuevo: se perdió la sesión y no se puede subir.");
      return;
    }

    setSubiendo((n) => n + chicos.length);
    const subidas: string[] = [];
    const fallados: string[] = [];

    for (const file of chicos) {
      const archivo = tipo === "imagenes" ? await comprimirImagen(file) : file;
      const ruta = `invitaciones/subidas/${user.id}/${crypto.randomUUID()}.${extensionDe(archivo)}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(ruta, archivo, { contentType: archivo.type || undefined });

      if (error) {
        fallados.push(file.name);
        continue;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
      if (data?.publicUrl) subidas.push(data.publicUrl);
    }

    setSubiendo((n) => Math.max(0, n - chicos.length));

    if (fallados.length > 0) {
      setAviso(
        `No se pudieron subir ${fallados.length} archivo${fallados.length > 1 ? "s" : ""}. ` +
          "Si pesan mucho, puede ser el tope del proyecto en Supabase.",
      );
    }
    if (subidas.length > 0) setters[tipo]([...valores[tipo], ...subidas]);
  }

  function handleDrop(e: React.DragEvent, tipo: Tipo) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    agregarArchivos(Array.from(e.dataTransfer.files), tipo);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, tipo: Tipo) {
    const files = e.currentTarget.files;
    if (!files) return;
    agregarArchivos(Array.from(files), tipo);
    e.currentTarget.value = "";
  }

  function quitar(tipo: Tipo, index: number) {
    setters[tipo](valores[tipo].filter((_, i) => i !== index));
  }

  const ocupado = disabled || subiendo > 0;

  /** Lo que las tres cajas comparten tal cual. */
  const comunes = {
    ocupado,
    onDrag: handleDrag,
    onDrop: handleDrop,
    onFileChange: handleFileChange,
  };

  return (
    <div className="grid gap-6">
      {aviso && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] font-semibold text-amber-800">
          {aviso}
        </p>
      )}
      {subiendo > 0 && (
        <p className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-2 text-[12.5px] font-semibold text-aventurea-ink-soft">
          Subiendo {subiendo} archivo{subiendo > 1 ? "s" : ""}…
        </p>
      )}

      <div>
        <CajaSubida
          {...comunes}
          tipo="imagenes"
          activa={dragActive === "imagenes"}
          icono={
            <IconImagePlus className="mb-0.5 mr-1.5 inline h-4 w-4 text-aventurea-orange" />
          }
        />
        {imagenes.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {imagenes.map((img, idx) => (
              <div key={img} className="group relative h-24 overflow-hidden rounded-xl">
                <Image src={img} alt={`Imagen ${idx + 1}`} fill sizes="200px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => quitar("imagenes", idx)}
                  className="absolute right-1 top-1 rounded-xl bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <CajaSubida
          {...comunes}
          tipo="videos"
          activa={dragActive === "videos"}
          icono={
            <IconVideoPlus className="mb-0.5 mr-1.5 inline h-4 w-4 text-aventurea-orange" />
          }
        />
        {videos.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {videos.map((vid, idx) => (
              <div key={vid} className="group relative overflow-hidden rounded-xl">
                <video src={vid} className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => quitar("videos", idx)}
                  className="absolute right-1 top-1 rounded-xl bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <CajaSubida
          {...comunes}
          tipo="audios"
          activa={dragActive === "audios"}
          icono={<IconNota />}
        />
        {audios.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {audios.map((aud, idx) => (
              <li
                key={aud}
                className="flex items-center gap-3 rounded-xl border border-aventurea-line bg-white px-3 py-2"
              >
                <audio src={aud} controls className="h-8 min-w-0 flex-1" />
                <button
                  type="button"
                  onClick={() => quitar("audios", idx)}
                  className="shrink-0 rounded-xl bg-aventurea-cream-2 p-1.5 text-aventurea-ink-soft hover:text-aventurea-ink"
                  aria-label={`Quitar audio ${idx + 1}`}
                >
                  <IconX className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Una caja de arrastrar-y-soltar. Vive fuera del componente grande a
 * propósito: declarada adentro, React la trataría como un tipo nuevo en
 * cada render y desmontaría el input de archivos a cada rato.
 */
function CajaSubida({
  tipo,
  icono,
  activa,
  ocupado,
  onDrag,
  onDrop,
  onFileChange,
}: {
  tipo: Tipo;
  icono: React.ReactNode;
  activa: boolean;
  ocupado: boolean;
  onDrag: (e: React.DragEvent, tipo: Tipo) => void;
  onDrop: (e: React.DragEvent, tipo: Tipo) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, tipo: Tipo) => void;
}) {
  const { titulo, accept, formatos } = AJUSTES[tipo];
  const id = `subir-${tipo}`;
  return (
    <div>
      <h4 className="mb-3 text-[13px] font-bold text-aventurea-ink">
        {icono}
        {titulo}
      </h4>
      {/* El <label> abre el selector sin necesidad de un ref: el input
          vive adentro, escondido, y el clic en la caja lo dispara. */}
      <label
        htmlFor={id}
        className={`relative block rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          activa
            ? "border-aventurea-sky bg-aventurea-sky/10"
            : "border-aventurea-line bg-aventurea-cream-2 hover:border-aventurea-sky/50"
        } ${ocupado ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        onDragEnter={(e) => onDrag(e, tipo)}
        onDragLeave={(e) => onDrag(e, tipo)}
        onDragOver={(e) => onDrag(e, tipo)}
        onDrop={(e) => onDrop(e, tipo)}
      >
        <input
          id={id}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => onFileChange(e, tipo)}
          className="hidden"
          disabled={ocupado}
        />
        <p className="text-[13px] font-semibold text-aventurea-ink">
          Arrastrá {titulo.toLowerCase()} aquí o clickeá
        </p>
        <p className="text-[11.5px] text-aventurea-ink-soft">{formatos}</p>
      </label>
    </div>
  );
}

function IconNota() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      className="mb-0.5 mr-1.5 inline h-4 w-4 text-aventurea-orange"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l10-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
  );
}
