"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/comprimir-imagen";

/**
 * SUBIR UNA IMAGEN, sin pedirle una URL a nadie.
 *
 * ------------------------------------------------------------------
 * POR QUÉ EXISTE
 * ------------------------------------------------------------------
 * El asistente pedía «Logo (URL https)». Eso le traslada al dueño de
 * una barbería un problema que no es suyo: subir el archivo a algún
 * lado, encontrar el link directo, comprobar que sea https y que no
 * caduque. La mitad pega el link de una carpeta de Drive —que no es
 * una imagen— y se queda sin logo sin entender por qué.
 *
 * ------------------------------------------------------------------
 * EL ARCHIVO VA DIRECTO AL BUCKET, NO POR EL SERVER ACTION
 * ------------------------------------------------------------------
 * El navegador sube con su propia sesión y solo manda la URL al
 * guardar. Si el archivo viajara dentro del POST del server action, el
 * techo sería el del body de Vercel y una foto de celular lo rompería.
 * Es el mismo camino que ya usan el catálogo, el equipo y las
 * invitaciones.
 *
 * ------------------------------------------------------------------
 * EL LÍMITE SE MIDE DESPUÉS DE COMPRIMIR, Y ESO IMPORTA
 * ------------------------------------------------------------------
 * Una foto de celular pesa 4-6 MB y comprimida queda en unos cientos
 * de KB. Rechazarla ANTES de comprimir sería rechazar el caso normal.
 * Se rechaza solo lo que sigue pesando de más YA COMPRIMIDO, que es un
 * archivo de verdad raro — y ahí el mensaje puede ser honesto.
 */

const BUCKET = "ranchos-fotos";

/**
 * Presets por destino. No es lo mismo un logo que una banda: cada uno
 * se prepara para el tamaño en que Apple y Google lo van a dibujar, en
 * vez de subir 2560px que después nadie usa.
 *
 *   logo   → Apple lo pinta a 160×50pt (480×150 @3x); Google en círculo.
 *   banner → el `strip` de Apple es 375×123pt (1125×369 @3x).
 */
export const PRESETS = {
  logo: {
    ladoMax: 512,
    calidad: 0.9,
    relacion: "1 / 1",
    ayuda: "Cuadrado, y con fondo transparente se ve mejor",
    // Un logo se guarda PNG si trae transparencia. Aplastarlo contra
    // blanco deja blanco-sobre-blanco a toda marca hecha para fondo
    // oscuro —y el pase de Wallet es navy—, que es lo que reventaba el
    // recorte de sharp al generar el pase. Ver `comprimir-imagen.ts`.
    conservarAlfa: true,
  },
  banner: {
    ladoMax: 1200,
    calidad: 0.85,
    relacion: "3 / 1",
    ayuda: "Apaisada, tipo banner",
    // Una banda es una foto: JPEG sobre blanco, como el resto del sitio.
    conservarAlfa: false,
  },
} as const;

export type DestinoImagen = keyof typeof PRESETS;

const MAX_MB = 2;

export default function SubirImagen({
  valor,
  alCambiar,
  destino = "logo",
  etiqueta,
  carpeta,
}: {
  /** La URL actual, o "" si no hay. */
  valor: string;
  alCambiar: (url: string) => void;
  destino?: DestinoImagen;
  etiqueta: string;
  /** Prefijo de la ruta en el bucket. */
  carpeta: string;
}) {
  const preset = PRESETS[destino];
  const input = useRef<HTMLInputElement | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);

  async function tomar(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);

    if (!archivo.type.startsWith("image/")) {
      setError("Eso no es una imagen. Probá con un PNG o un JPG.");
      return;
    }

    setSubiendo(true);
    try {
      const liviano = await comprimirImagen(archivo, {
        ladoMax: preset.ladoMax,
        calidad: preset.calidad,
        conservarAlfa: preset.conservarAlfa,
      });

      if (liviano.size > MAX_MB * 1024 * 1024) {
        const mb = (liviano.size / 1024 / 1024).toFixed(1);
        setError(`Aun comprimida pesa ${mb} MB y el máximo es ${MAX_MB} MB. Probá con otra.`);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Se cerró tu sesión. Recargá la página.");
        return;
      }

      const ext = (liviano.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const ruta = `${carpeta}/${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: eSubida } = await supabase.storage
        .from(BUCKET)
        .upload(ruta, liviano, { contentType: liviano.type, upsert: false });
      if (eSubida) {
        setError("No se pudo subir. Probá de nuevo en un momento.");
        return;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
      alCambiar(data.publicUrl);
    } catch {
      setError("No se pudo procesar la imagen. Probá con otra.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-bookea-gris">
        {etiqueta}
      </span>

      {valor ? (
        <div className="flex items-center gap-3 rounded-2xl border border-bookea-linea p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen
              recién subida por el usuario; el optimizador no aporta acá. */}
          <img
            src={valor}
            alt=""
            className="shrink-0 rounded-lg object-cover"
            style={{ aspectRatio: preset.relacion, width: destino === "logo" ? 56 : 132 }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold text-bookea-tinta">Imagen cargada</p>
            <p className="truncate text-[11.5px] text-bookea-gris">{valor.split("/").pop()}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              alCambiar("");
              setError(null);
            }}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-bookea-gris underline hover:text-bookea-tinta"
          >
            Quitar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            void tomar(e.dataTransfer.files?.[0]);
          }}
          disabled={subiendo}
          className={`flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors ${
            encima ? "border-bookea-azul bg-bookea-azul-suave" : "border-bookea-linea"
          } disabled:opacity-60`}
        >
          <span className="text-[13px] font-bold text-bookea-tinta">
            {subiendo ? "Subiendo…" : "Arrastrá una imagen o tocá acá"}
          </span>
          <span className="text-[11.5px] text-bookea-gris">
            PNG o JPG · hasta {MAX_MB} MB · {preset.ayuda}
          </span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void tomar(e.target.files?.[0]);
          // Se limpia para que elegir DOS VECES el mismo archivo vuelva
          // a disparar el change: sin esto, quitar y re-subir la misma
          // imagen no hace nada y parece que el botón está roto.
          e.target.value = "";
        }}
      />

      {error && <p className="mt-1.5 text-[12px] font-bold text-red-600">{error}</p>}
    </div>
  );
}
