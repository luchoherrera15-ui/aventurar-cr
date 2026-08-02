"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";
import { borrarFotoAlbum } from "./actions";
import {
  EVENTO_FOTOS_MIAS,
  misFotos,
  olvidarFotoPropia,
  tokenDelNavegador,
} from "./identidad";

export type FotoAlbum = { id: string; path: string; autor: string | null };

/**
 * La grilla masonry del álbum.
 *
 * Es un componente de cliente por una sola razón: saber CUÁLES fotos
 * puede quitar quien está mirando. El dueño del álbum lo sabe el
 * servidor, pero un invitado sin cuenta solo se reconoce por lo que
 * guardó su propio navegador (ver identidad.ts) — y eso el servidor no
 * lo puede leer. Así que el botón se decide acá.
 *
 * El servidor igual vuelve a verificar antes de borrar nada: esconder
 * el botón es comodidad, no seguridad.
 */
export default function Galeria({
  albumId,
  fotos,
  baseFotos,
  paleta,
  esDueno,
  claseSerif,
}: {
  albumId: string;
  fotos: FotoAlbum[];
  /** La URL pública del bucket, con la barra final. */
  baseFotos: string;
  paleta: Paleta;
  /** El dueño del álbum (o un admin) puede quitar cualquier foto. */
  esDueno: boolean;
  claseSerif: string;
}) {
  const router = useRouter();
  const [mias, setMias] = useState<string[]>([]);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // localStorage no existe en el servidor, así que la lista propia se
  // lee después de montar. El evento la refresca cuando se sube algo
  // sin recargar la página.
  useEffect(() => {
    const refrescar = () => setMias(misFotos(albumId));
    refrescar();
    window.addEventListener(EVENTO_FOTOS_MIAS, refrescar);
    return () => window.removeEventListener(EVENTO_FOTOS_MIAS, refrescar);
  }, [albumId]);

  function quitar(foto: FotoAlbum) {
    const suya = mias.includes(foto.id);
    const aviso = esDueno && !suya
      ? "¿Quitar esta foto del álbum? La subió un invitado y no se puede deshacer."
      : "¿Quitar tu foto del álbum? No se puede deshacer.";
    if (!window.confirm(aviso)) return;

    setError(null);
    setBorrando(foto.id);
    startTransition(async () => {
      const res = await borrarFotoAlbum({
        fotoId: foto.id,
        token: tokenDelNavegador(),
      });
      setBorrando(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      olvidarFotoPropia(albumId, foto.id);
      router.refresh();
    });
  }

  if (fotos.length === 0) {
    return (
      <p
        className="mx-auto mt-10 max-w-[400px] rounded-2xl border border-dashed p-8 text-center text-[14px]"
        style={{ borderColor: conAlfa(paleta.tinta, 0.25), color: conAlfa(paleta.tinta, 0.6) }}
      >
        Todavía no hay fotos — sé la primera persona en subir una.
      </p>
    );
  }

  return (
    <>
      {error && (
        <p className="mx-auto mt-6 max-w-[520px] rounded-xl bg-red-600/10 px-4 py-3 text-center text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}

      {/* Columnas CSS: cada foto entera en su columna, nada de recortes. */}
      <div className="mt-10 columns-2 gap-3 sm:columns-3 sm:gap-4">
        {fotos.map((f) => {
          const puedeQuitar = esDueno || mias.includes(f.id);
          return (
            <figure key={f.id} className="mb-3 break-inside-avoid sm:mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- fotos de invitados en el bucket público */}
              <img
                src={`${baseFotos}${f.path}`}
                alt={f.autor ? `Foto de ${f.autor}` : "Foto del evento"}
                loading="lazy"
                className="w-full rounded-xl object-cover"
                style={{ boxShadow: `0 10px 30px -18px ${conAlfa(paleta.tinta, 0.4)}` }}
              />
              <figcaption
                className={`${claseSerif} mt-1.5 flex items-center justify-center gap-2 text-center text-[13px] italic`}
                style={{ color: conAlfa(paleta.tinta, 0.55) }}
              >
                {f.autor}
                {puedeQuitar && (
                  <button
                    type="button"
                    onClick={() => quitar(f)}
                    disabled={pendiente && borrando === f.id}
                    aria-label={
                      f.autor ? `Quitar la foto de ${f.autor}` : "Quitar esta foto"
                    }
                    className="rounded-lg px-1.5 py-0.5 text-[11.5px] font-sans font-bold not-italic transition-colors hover:bg-red-600/10 hover:text-red-700 disabled:opacity-50"
                    style={{ color: conAlfa(paleta.tinta, 0.5) }}
                  >
                    {borrando === f.id ? "Quitando…" : "Quitar"}
                  </button>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}
