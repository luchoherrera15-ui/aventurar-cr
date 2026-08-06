"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";
import { nombreDeFoto } from "@/lib/zip";
import { borrarFotoAlbum } from "./actions";
import { EVENTO_FOTOS_MIAS, misFotos, olvidarFotoPropia, tokenDelNavegador } from "./identidad";

export type FotoAlbum = { id: string; path: string; autor: string | null };

/**
 * La grilla masonry del álbum — solo eso. Los controles de descarga y
 * de subida viven arriba, en la barra que arma AlbumInteractivo; la
 * grilla RECIBE la selección (`eligiendo`, `seleccion`) en vez de
 * dueña, porque esos dos controles necesitan el mismo estado y el
 * padre común es lo que los mantiene sincronizados.
 *
 * Es un componente de cliente por una razón propia: saber CUÁLES fotos
 * puede quitar quien está mirando. El dueño del álbum lo sabe el
 * servidor, pero un invitado sin cuenta solo se reconoce por lo que
 * guardó su propio navegador (ver identidad.ts) — y eso el servidor no
 * lo puede leer. Así que el botón "Quitar" se decide acá.
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
  eligiendo,
  seleccion,
  onToggle,
}: {
  albumId: string;
  fotos: FotoAlbum[];
  /** La URL pública del bucket, con la barra final. */
  baseFotos: string;
  paleta: Paleta;
  /** El dueño del álbum (o un admin) puede quitar cualquier foto. */
  esDueno: boolean;
  claseSerif: string;
  /** Modo "elegir algunas" para descargar, controlado desde arriba. */
  eligiendo: boolean;
  seleccion: Set<string>;
  onToggle: (fotoId: string) => void;
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

  return (
    <>
      {error && (
        <p className="mx-auto mt-6 max-w-[520px] rounded-xl bg-red-600/10 px-4 py-3 text-center text-[13px] font-semibold text-red-700">
          {error}
        </p>
      )}

      {/* Columnas CSS: cada foto entera en su columna, nada de recortes. */}
      <div className="mt-8 columns-2 gap-3 sm:columns-3 sm:gap-4">
        {fotos.map((f, i) => {
          const puedeQuitar = esDueno || mias.includes(f.id);
          const elegida = seleccion.has(f.id);
          return (
            <figure key={f.id} className="mb-3 break-inside-avoid sm:mb-4">
              <div
                className={eligiendo ? "relative cursor-pointer" : "relative"}
                onClick={eligiendo ? () => onToggle(f.id) : undefined}
              >
                {/* Masonry: cada foto conserva su proporción real (no
                    hay w/h guardado por foto), así que va sin `fill` —
                    width/height acá son solo la pista para el srcset;
                    width:100%/height:auto en el style manda el tamaño
                    real, como recomienda Next para grillas masonry. */}
                <Image
                  src={`${baseFotos}${f.path}`}
                  alt={f.autor ? `Foto de ${f.autor}` : "Foto del evento"}
                  width={1200}
                  height={900}
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="rounded-xl object-cover transition-opacity"
                  style={{
                    width: "100%",
                    height: "auto",
                    boxShadow: `0 10px 30px -18px ${conAlfa(paleta.tinta, 0.4)}`,
                    opacity: eligiendo && !elegida ? 0.55 : 1,
                    outline: elegida ? `3px solid ${paleta.acento}` : undefined,
                    outlineOffset: elegida ? "2px" : undefined,
                  }}
                />
                {eligiendo && (
                  <span
                    aria-hidden
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold"
                    style={{
                      background: elegida ? paleta.acento : conAlfa(paleta.fondo, 0.85),
                      color: elegida ? paleta.fondo : conAlfa(paleta.tinta, 0.45),
                      boxShadow: `0 2px 8px -2px ${conAlfa(paleta.tinta, 0.5)}`,
                    }}
                  >
                    {elegida ? "✓" : ""}
                  </span>
                )}
                {/* La casilla de verdad, invisible pero presente: es lo
                    que hace que un lector de pantalla entienda que la
                    foto se puede marcar. */}
                {eligiendo && (
                  <input
                    type="checkbox"
                    checked={elegida}
                    onChange={() => onToggle(f.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={
                      f.autor ? `Elegir la foto de ${f.autor}` : "Elegir esta foto"
                    }
                    className="absolute right-2 top-2 h-7 w-7 cursor-pointer opacity-0"
                  />
                )}
              </div>
              <figcaption
                className={`${claseSerif} mt-1.5 flex items-center justify-center gap-2 text-center text-[13px] italic`}
                style={{ color: conAlfa(paleta.tinta, 0.55) }}
              >
                {f.autor}
                {/* Mientras se está eligiendo, estos dos desaparecen: en
                    un teléfono "Quitar" queda a milímetros de la foto que
                    se está tocando para marcarla, y borrar no se deshace. */}
                {!eligiendo && (
                  <>
                    {/* `?download=` hace que Supabase la mande con
                        Content-Disposition: attachment. Sin eso el
                        atributo `download` de HTML se ignora, porque el
                        bucket está en otro dominio, y la foto se abre en
                        una pestaña en vez de guardarse. */}
                    <a
                      href={`${baseFotos}${f.path}?download=${encodeURIComponent(nombreDeFoto(i, f.autor))}`}
                      aria-label={
                        f.autor ? `Descargar la foto de ${f.autor}` : "Descargar esta foto"
                      }
                      className="rounded-lg px-1.5 py-0.5 font-sans text-[11.5px] font-bold not-italic transition-colors hover:underline"
                      style={{ color: conAlfa(paleta.tinta, 0.5) }}
                    >
                      Bajar
                    </a>
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
                  </>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}
