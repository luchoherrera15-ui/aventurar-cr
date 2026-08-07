"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";
import { comprimirImagen } from "@/lib/comprimir-imagen";
import { hashDelToken, recordarFotoPropia, tokenDelNavegador } from "./identidad";

/** Tope de la tanda: nadie sube el carrete completo de un solo golpe. */
const MAX_POR_TANDA = 10;
/** Tope del álbum — el mismo que impone la política de la base (0068). */
const MAX_FOTOS_ALBUM = 500;

/**
 * "Añadí al álbum", el contenido del modal que abre la burbuja
 * flotante (ver album-interactivo.tsx): tres pasos numerados — nombre,
 * fotos, subir — para que hasta la tía menos tecnológica sepa qué
 * sigue. Sin cuenta — la llave anónima puede subir al bucket público y
 * anotar la fila mientras el álbum esté activo (RLS de 0068). Al
 * terminar refresca la página y las fotos nuevas entran a la grilla.
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
  onCerrar,
}: {
  albumId: string;
  fotosActuales: number;
  /** La serif del álbum, para que el título del bloque haga juego. */
  claseSerif: string;
  /** Los colores heredados de la invitación (0089). */
  paleta: Paleta;
  /** Cierra el modal que envuelve este formulario. */
  onCerrar: () => void;
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
        // Un álbum de recuerdos se mira en grande y se descarga para
        // imprimir — acá la nitidez pesa más que en una card de listado.
        // Calidad 0.82, no 0.92: la diferencia no se ve a ojo ni
        // imprimiendo, y pesa 38 % menos — el ahorro de almacenamiento
        // más grande del producto, sin cambiar nada de infraestructura.
        const comprimida = await comprimirImagen(elegidas[n], { ladoMax: 2400, calidad: 0.82 });
        // comprimirImagen devuelve el MISMO archivo si no pudo procesarlo
        // (canvas bloqueado, formato raro) — acá se prefiere saltar la
        // foto antes que subir algo pesado con extensión .jpg mentirosa.
        if (comprimida === elegidas[n]) throw new Error("No se pudo comprimir la imagen.");
        const path = `${albumId}/${ts}-${n + 1}.jpg`;
        const { error: errorSubida } = await supabase.storage
          .from("albumes")
          .upload(path, comprimida, { contentType: "image/jpeg" });
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

  /** El circulito numerado de cada paso. */
  const numero = (n: number) => (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
      style={{ background: paleta.acento, color: paleta.fondo }}
    >
      {n}
    </span>
  );

  return (
    <div className="text-left">
      <h2 className={`${claseSerif} text-center text-[26px] font-semibold italic`}>
        Añadí al álbum
      </h2>
      <p
        className="mt-1 text-center text-[13px] leading-snug"
        style={{ color: conAlfa(paleta.tinta, 0.6) }}
      >
        Compartí tus recuerdos — quedan en el álbum para todos.
      </p>

      {albumLleno ? (
        <p
          className="mt-5 rounded-xl px-4 py-3 text-center text-[13px] font-semibold"
          style={{
            background: conAlfa(paleta.tinta, 0.05),
            color: conAlfa(paleta.tinta, 0.7),
          }}
        >
          El álbum llegó a su tope de {MAX_FOTOS_ALBUM} fotos. ¡Gracias por tanto recuerdo!
        </p>
      ) : listo ? (
        <div className="mt-6 text-center">
          <p
            className="rounded-xl px-4 py-3 text-[13.5px] font-semibold"
            style={{ background: conAlfa(paleta.tinta, 0.05), color: paleta.tinta }}
          >
            ¡Listo! Tus fotos ya son parte del álbum.
          </p>
          <button
            type="button"
            onClick={onCerrar}
            className="mt-4 rounded-xl px-6 py-2.5 text-[13.5px] font-bold transition-opacity hover:opacity-90"
            style={{ background: paleta.acento, color: paleta.fondo }}
          >
            Ver el álbum
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          {/* Paso 1: quién sube */}
          <div>
            <p className="flex items-center gap-2.5 text-[13.5px] font-bold">
              {numero(1)} Tu nombre <span className="font-normal opacity-60">(opcional)</span>
            </p>
            <input
              id="album-autor"
              type="text"
              value={autor}
              onChange={(e) => setAutor(e.target.value)}
              placeholder="Para saber quién compartió cada foto"
              className="mt-2 w-full rounded-xl border px-3.5 py-2.5 text-[13.5px] focus:outline-none"
              style={{
                borderColor: conAlfa(paleta.tinta, 0.2),
                background: conAlfa(paleta.tinta, 0.04),
                color: paleta.tinta,
              }}
            />
          </div>

          {/* Paso 2: las fotos */}
          <div>
            <p className="flex items-center gap-2.5 text-[13.5px] font-bold">
              {numero(2)} Tus fotos
            </p>
            <label
              htmlFor="album-fotos"
              className="mt-2 block cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center text-[13px] font-bold transition-colors"
              style={{
                borderColor: conAlfa(paleta.tinta, 0.25),
                color: conAlfa(paleta.tinta, 0.7),
              }}
            >
              {elegidas.length > 0
                ? `${elegidas.length} foto${elegidas.length === 1 ? "" : "s"} elegida${elegidas.length === 1 ? "" : "s"} — tocá para cambiar`
                : `Tocá acá para elegir hasta ${MAX_POR_TANDA}`}
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
          </div>

          {/* Paso 3: subir */}
          <div>
            <p className="flex items-center gap-2.5 text-[13.5px] font-bold">
              {numero(3)} Finalizar
            </p>
            <button
              type="button"
              disabled={subiendo || elegidas.length === 0}
              onClick={subir}
              className="mt-2 w-full rounded-xl px-4 py-3 text-[14px] font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: paleta.acento, color: paleta.fondo }}
            >
              {subiendo
                ? `Subiendo… ${progreso}/${elegidas.length}`
                : elegidas.length === 0
                  ? "Subir ahora"
                  : `Subir ${elegidas.length} foto${elegidas.length === 1 ? "" : "s"}`}
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-red-600/10 px-3.5 py-2 text-[12px] font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
