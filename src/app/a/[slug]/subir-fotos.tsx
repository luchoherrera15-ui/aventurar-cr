"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";
import { hashDelToken, recordarFotoPropia, tokenDelNavegador } from "./identidad";

/** Tope de la tanda: nadie sube el carrete completo de un solo golpe. */
const MAX_POR_TANDA = 10;
/** Tope del álbum — el mismo que impone la política de la base (0068). */
const MAX_FOTOS_ALBUM = 500;
/** Lado máximo tras comprimir: suficiente para pantalla, liviano de subir. */
const LADO_MAX = 1920;

/**
 * Redimensiona una imagen en el navegador (canvas) a máximo 1920px de
 * lado y la reencoda como JPEG: una foto de celular de 8 MB queda en
 * unos cientos de KB antes de tocar la red.
 */
async function comprimir(archivo: File): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen."));
      el.src = url;
    });
    const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
    const alto = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Este navegador no puede procesar la imagen.");
    ctx.drawImage(img, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    if (!blob) throw new Error("No se pudo convertir la imagen.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * "Subí tus fotos del evento": el bloque para invitados al pie de la
 * grilla. Sin cuenta — la llave anónima puede subir al bucket público
 * y anotar la fila mientras el álbum esté activo (RLS de 0068). Al
 * terminar refresca la página y las fotos nuevas aparecen arriba.
 *
 * Junto a cada foto se guarda la LLAVE que permite quitarla después
 * (0089): el hash de un token que se queda en este navegador. El token
 * en claro no viaja nunca — se calcula el SHA-256 acá mismo.
 */
export default function SubirFotos({
  albumId,
  fotosActuales,
  claseSerif,
  paleta,
}: {
  albumId: string;
  fotosActuales: number;
  /** La serif del álbum, para que el título del bloque haga juego. */
  claseSerif: string;
  /** Los colores heredados de la invitación (0089). */
  paleta: Paleta;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [autor, setAutor] = useState("");
  const [elegidas, setElegidas] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const albumLleno = fotosActuales >= MAX_FOTOS_ALBUM;

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setListo(false);
    const archivos = Array.from(e.target.files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_POR_TANDA);
    if ((e.target.files?.length ?? 0) > MAX_POR_TANDA) {
      setError(`Máximo ${MAX_POR_TANDA} fotos por tanda — se toman las primeras ${MAX_POR_TANDA}.`);
    }
    setElegidas(archivos);
  }

  async function subir() {
    if (elegidas.length === 0) {
      setError("Elegí al menos una foto primero.");
      return;
    }
    if (fotosActuales + elegidas.length > MAX_FOTOS_ALBUM) {
      setError("El álbum está llenísimo — ya no caben más fotos. ¡Gracias igual!");
      return;
    }
    setSubiendo(true);
    setError(null);
    setProgreso(0);

    const supabase = createClient();
    const nombre = autor.trim().slice(0, 80) || null;
    const ts = Date.now();
    // Una sola vez para toda la tanda: el token es del navegador, no de
    // la foto. Si el navegador no deja guardarlo (incógnito con el
    // almacenamiento bloqueado), se sube igual — solo que sin poder
    // quitarla después.
    const hash = await hashDelToken(tokenDelNavegador());
    let subidas = 0;

    for (let n = 0; n < elegidas.length; n++) {
      try {
        const blob = await comprimir(elegidas[n]);
        const path = `${albumId}/${ts}-${n + 1}.jpg`;
        const { error: errorSubida } = await supabase.storage
          .from("albumes")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (errorSubida) throw new Error(errorSubida.message);

        const { data: fila, error: errorFila } = await supabase
          .from("album_fotos")
          .insert({ album_id: albumId, path, autor: nombre })
          .select("id")
          .single();
        if (errorFila || !fila) throw new Error(errorFila?.message ?? "sin fila");

        // La llave va después de la foto porque necesita su id. Si algo
        // falla acá, la foto queda subida y solo la puede quitar el
        // dueño del álbum — se prefiere eso a perder la foto.
        if (hash) {
          const { error: errorLlave } = await supabase
            .from("album_foto_llaves")
            .insert({ foto_id: fila.id as string, token_hash: hash });
          if (errorLlave) {
            console.warn("[album] La foto quedó sin llave:", errorLlave.message);
          } else {
            recordarFotoPropia(albumId, String(fila.id));
          }
        }

        subidas += 1;
        setProgreso(subidas);
      } catch {
        // Se sigue con las demás: mejor 9 fotos arriba que ninguna.
      }
    }

    setSubiendo(false);
    if (subidas === 0) {
      setError("No se pudo subir ninguna foto. Revisá tu conexión y probá de nuevo.");
      return;
    }
    setElegidas([]);
    setAutor("");
    if (inputRef.current) inputRef.current.value = "";
    setListo(true);
    // Las fotos recién subidas entran a la grilla del servidor.
    router.refresh();
  }

  return (
    <section
      className="mx-auto mt-12 w-full max-w-[520px] rounded-2xl border p-6 text-center sm:p-8"
      style={{
        borderColor: conAlfa(paleta.tinta, 0.15),
        background: conAlfa(paleta.fondo, 0.7),
        boxShadow: `0 18px 50px -30px ${conAlfa(paleta.tinta, 0.35)}`,
      }}
    >
      <h2 className={`${claseSerif} text-[clamp(24px,5vw,30px)] font-semibold italic`}>
        Subí tus fotos del evento
      </h2>
      <p
        className="mt-2 text-[13px] leading-relaxed"
        style={{ color: conAlfa(paleta.tinta, 0.65) }}
      >
        Sin cuentas ni apps: elegí hasta {MAX_POR_TANDA} fotos y quedan en el álbum para
        todos. Se ajustan solas para que suban rápido.
      </p>

      {albumLleno ? (
        <p
          className="mt-5 rounded-xl px-4 py-3 text-[13px] font-semibold"
          style={{
            background: conAlfa(paleta.tinta, 0.05),
            color: conAlfa(paleta.tinta, 0.7),
          }}
        >
          El álbum llegó a su tope de {MAX_FOTOS_ALBUM} fotos. ¡Gracias por tanto recuerdo!
        </p>
      ) : (
        <div className="mt-5 grid gap-3 text-left">
          <label
            htmlFor="album-fotos"
            className="cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center text-[13.5px] font-bold transition-colors"
            style={{
              borderColor: conAlfa(paleta.tinta, 0.25),
              color: conAlfa(paleta.tinta, 0.7),
            }}
          >
            {elegidas.length > 0
              ? `${elegidas.length} foto${elegidas.length === 1 ? "" : "s"} elegida${elegidas.length === 1 ? "" : "s"} — tocá para cambiar`
              : "Tocá acá para elegir tus fotos"}
            <input
              ref={inputRef}
              id="album-fotos"
              type="file"
              accept="image/*"
              multiple
              onChange={elegir}
              className="sr-only"
            />
          </label>

          <div>
            <label
              htmlFor="album-autor"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: conAlfa(paleta.tinta, 0.55) }}
            >
              Tu nombre (opcional)
            </label>
            <input
              id="album-autor"
              type="text"
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              placeholder="Para que sepan quién las tomó"
              className="w-full rounded-xl border px-4 py-3 text-[14px] focus:outline-none"
              style={{
                borderColor: conAlfa(paleta.tinta, 0.2),
                background: paleta.fondo,
                color: paleta.tinta,
              }}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-600/10 px-4 py-2.5 text-[12.5px] font-semibold text-red-700">
              {error}
            </p>
          )}
          {listo && (
            <p
              className="rounded-xl px-4 py-2.5 text-[12.5px] font-semibold"
              style={{ background: conAlfa(paleta.tinta, 0.05), color: paleta.tinta }}
            >
              ¡Listo! Tus fotos ya son parte del álbum.
            </p>
          )}

          <button
            type="button"
            disabled={subiendo}
            onClick={subir}
            className="rounded-xl px-6 py-3.5 text-[14.5px] font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: paleta.acento, color: paleta.fondo }}
          >
            {subiendo
              ? `Subiendo… ${progreso}/${elegidas.length}`
              : "Subir al álbum"}
          </button>
        </div>
      )}
    </section>
  );
}
