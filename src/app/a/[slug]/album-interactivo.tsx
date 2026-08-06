"use client";

import { useState } from "react";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";
import { IconCamera } from "@/components/icons";
import Descargas from "./descargas";
import Galeria, { type FotoAlbum } from "./galeria";
import SubirFotos from "./subir-fotos";

/**
 * Todo lo interactivo del álbum, ahora en piezas flotantes (pedido del
 * dueño, a la manera de las galerías de eventos):
 *
 * - La BURBUJA "Subí tus fotos" abajo a la derecha, siempre a mano por
 *   largo que sea el álbum. Abre el modal de pasos (subir-fotos.tsx).
 * - El menú de tres puntitos arriba a la derecha con las descargas
 *   (descargas.tsx), también fijo.
 * - La grilla en el medio, limpia — ya no hay cajones de controles
 *   empujando las fotos hacia abajo.
 *
 * Este componente existe porque la barra y la grilla COMPARTEN la
 * selección de fotos: tocar una foto la marca y el botón "Descargar N"
 * de la barra tiene que enterarse. El estado vive acá, en el padre
 * común.
 */
export default function AlbumInteractivo({
  albumId,
  slug,
  fotos,
  baseFotos,
  paleta,
  esDueno,
  claseSerif,
}: {
  albumId: string;
  slug: string;
  fotos: FotoAlbum[];
  baseFotos: string;
  paleta: Paleta;
  esDueno: boolean;
  claseSerif: string;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [subiendo, setSubiendo] = useState(false);

  function alternar(id: string) {
    setSeleccion((prev) => {
      const copia = new Set(prev);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  function cancelarSeleccion() {
    setEligiendo(false);
    setSeleccion(new Set());
  }

  return (
    <>
      {fotos.length > 0 && (
        <Descargas
          slug={slug}
          totalFotos={fotos.length}
          paleta={paleta}
          eligiendo={eligiendo}
          seleccion={seleccion}
          onIniciar={() => setEligiendo(true)}
          onCancelar={cancelarSeleccion}
          onElegirTodas={() => setSeleccion(new Set(fotos.map((f) => f.id)))}
        />
      )}

      {fotos.length === 0 ? (
        <p
          className="mx-auto mt-10 max-w-[400px] rounded-2xl border border-dashed p-8 text-center text-[14px]"
          style={{ borderColor: conAlfa(paleta.tinta, 0.25), color: conAlfa(paleta.tinta, 0.6) }}
        >
          Todavía no hay fotos — sé la primera persona en subir una.
        </p>
      ) : (
        <Galeria
          albumId={albumId}
          fotos={fotos}
          baseFotos={baseFotos}
          paleta={paleta}
          esDueno={esDueno}
          claseSerif={claseSerif}
          eligiendo={eligiendo}
          seleccion={seleccion}
          onToggle={alternar}
        />
      )}

      {/* La burbuja para subir — se esconde mientras se están
          eligiendo fotos, porque abajo está la barra de descarga. */}
      {!eligiendo && (
        <button
          type="button"
          onClick={() => setSubiendo(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full py-3.5 pl-4 pr-5 text-[14px] font-bold shadow-xl transition-transform hover:scale-[1.04] sm:bottom-6 sm:right-6"
          style={{ background: paleta.acento, color: paleta.fondo }}
        >
          <IconCamera className="h-4.5 w-4.5" /> Subí tus fotos
        </button>
      )}

      {/* El modal de pasos, sobre un velo que atenúa el álbum. */}
      {subiendo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Añadí al álbum"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setSubiendo(false)}
            className="anim-velo-entrar absolute inset-0 cursor-default"
            style={{ background: conAlfa(paleta.tinta, 0.45) }}
          />
          <div
            className="anim-panel-entrar relative max-h-[88svh] w-full max-w-[420px] overflow-y-auto rounded-3xl p-6 shadow-2xl sm:p-7"
            style={{ background: paleta.fondo, color: paleta.tinta }}
          >
            <button
              type="button"
              onClick={() => setSubiendo(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[17px] font-bold transition-colors"
              style={{ background: conAlfa(paleta.tinta, 0.07), color: conAlfa(paleta.tinta, 0.7) }}
            >
              ✕
            </button>
            <SubirFotos
              albumId={albumId}
              fotosActuales={fotos.length}
              claseSerif={claseSerif}
              paleta={paleta}
              onCerrar={() => setSubiendo(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
