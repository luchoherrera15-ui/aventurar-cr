"use client";

import { useState, useRef } from "react";
import { IconImagePlus, IconVideoPlus, IconX } from "./icons";

interface UploadZoneProps {
  imagenes: string[];
  videos: string[];
  onImagenesChange: (urls: string[]) => void;
  onVideosChange: (urls: string[]) => void;
  disabled?: boolean;
}

export default function UploadZone({
  imagenes,
  videos,
  onImagenesChange,
  onVideosChange,
  disabled = false,
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState<"imagenes" | "videos" | null>(null);
  const [aviso, setAviso] = useState("");
  const fileInputImgRef = useRef<HTMLInputElement>(null);
  const fileInputVidRef = useRef<HTMLInputElement>(null);

  // El body del server action tolera unos MB: se limita cada archivo
  // para que el POST no reviente al generar.
  const MAX_BYTES = { imagenes: 4 * 1024 * 1024, videos: 6 * 1024 * 1024 };

  function handleDrag(e: React.DragEvent, tipo: "imagenes" | "videos") {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(tipo);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  }

  /**
   * Lee todos los archivos del gesto de una vez y hace UNA sola
   * llamada al setter — un onload por archivo con el array del
   * closure haría que cada uno pisara al anterior.
   */
  async function agregarArchivos(files: File[], tipo: "imagenes" | "videos") {
    const validos = files.filter((f) =>
      tipo === "imagenes" ? f.type.startsWith("image/") : f.type.startsWith("video/")
    );
    const chicos = validos.filter((f) => f.size <= MAX_BYTES[tipo]);
    const rechazados = validos.length - chicos.length;
    setAviso(
      rechazados > 0
        ? `${rechazados} archivo${rechazados > 1 ? "s" : ""} superaba el límite (${
            tipo === "imagenes" ? "4" : "6"
          } MB) y no se agregó`
        : ""
    );
    if (chicos.length === 0) return;

    const base64s = await Promise.all(
      chicos.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
            reader.readAsDataURL(file);
          })
      )
    );

    if (tipo === "imagenes") {
      onImagenesChange([...imagenes, ...base64s]);
    } else {
      onVideosChange([...videos, ...base64s]);
    }
  }

  function handleDrop(e: React.DragEvent, tipo: "imagenes" | "videos") {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    agregarArchivos(Array.from(e.dataTransfer.files), tipo);
  }

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: "imagenes" | "videos"
  ) {
    const files = e.currentTarget.files;
    if (!files) return;
    agregarArchivos(Array.from(files), tipo);
    e.currentTarget.value = "";
  }

  function removeImagen(index: number) {
    onImagenesChange(imagenes.filter((_, i) => i !== index));
  }

  function removeVideo(index: number) {
    onVideosChange(videos.filter((_, i) => i !== index));
  }

  const dropzoneCls = (tipo: "imagenes" | "videos") =>
    `relative rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
      dragActive === tipo
        ? "border-aventurea-orange bg-aventurea-orange/10"
        : "border-aventurea-line bg-aventurea-cream-2 hover:border-aventurea-orange/50"
    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`;

  return (
    <div className="grid gap-6">
      {aviso && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] font-semibold text-amber-800">
          {aviso}
        </p>
      )}
      {/* Imágenes */}
      <div>
        <h4 className="mb-3 text-[13px] font-bold text-aventurea-ink">
          <IconImagePlus className="mb-0.5 mr-1.5 inline h-4 w-4 text-aventurea-orange" />
          Imágenes
        </h4>
        <div
          className={dropzoneCls("imagenes")}
          onDragEnter={(e) => handleDrag(e, "imagenes")}
          onDragLeave={(e) => handleDrag(e, "imagenes")}
          onDragOver={(e) => handleDrag(e, "imagenes")}
          onDrop={(e) => handleDrop(e, "imagenes")}
          onClick={() => !disabled && fileInputImgRef.current?.click()}
        >
          <input
            ref={fileInputImgRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFileChange(e, "imagenes")}
            className="hidden"
            disabled={disabled}
          />
          <p className="text-[13px] font-semibold text-aventurea-ink">
            Arrastrá imágenes aquí o clickeá
          </p>
          <p className="text-[11.5px] text-aventurea-ink-soft">PNG, JPG, WebP</p>
        </div>

        {imagenes.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {imagenes.map((img, idx) => (
              <div key={idx} className="group relative rounded-xl overflow-hidden">
                <img
                  src={img}
                  alt={`Imagen ${idx + 1}`}
                  className="h-24 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImagen(idx)}
                  className="absolute right-1 top-1 rounded-xl bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Videos */}
      <div>
        <h4 className="mb-3 text-[13px] font-bold text-aventurea-ink">
          <IconVideoPlus className="mb-0.5 mr-1.5 inline h-4 w-4 text-aventurea-orange" />
          Videos
        </h4>
        <div
          className={dropzoneCls("videos")}
          onDragEnter={(e) => handleDrag(e, "videos")}
          onDragLeave={(e) => handleDrag(e, "videos")}
          onDragOver={(e) => handleDrag(e, "videos")}
          onDrop={(e) => handleDrop(e, "videos")}
          onClick={() => !disabled && fileInputVidRef.current?.click()}
        >
          <input
            ref={fileInputVidRef}
            type="file"
            multiple
            accept="video/*"
            onChange={(e) => handleFileChange(e, "videos")}
            className="hidden"
            disabled={disabled}
          />
          <p className="text-[13px] font-semibold text-aventurea-ink">
            Arrastrá videos aquí o clickeá
          </p>
          <p className="text-[11.5px] text-aventurea-ink-soft">MP4, WebM (máx 5 seg)</p>
        </div>

        {videos.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {videos.map((vid, idx) => (
              <div key={idx} className="group relative rounded-xl overflow-hidden">
                <video src={vid} className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeVideo(idx)}
                  className="absolute right-1 top-1 rounded-xl bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
