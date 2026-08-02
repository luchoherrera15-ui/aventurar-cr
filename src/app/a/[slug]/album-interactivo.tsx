"use client";

import { useState } from "react";
import { conAlfa, type Paleta } from "@/lib/invitaciones/paleta";
import Descargas from "./descargas";
import Galeria, { type FotoAlbum } from "./galeria";
import SubirFotos from "./subir-fotos";

/**
 * Todo lo interactivo del álbum: la barra de arriba (subir + descargar)
 * y la grilla debajo.
 *
 * Existe por una sola razón — que la barra y la grilla necesitan
 * COMPARTIR la selección de fotos: tocar una foto en la grilla la
 * marca, y eso tiene que verse reflejado en el botón "Descargar N
 * fotos" de la barra. Antes ese estado vivía adentro de la grilla, con
 * los controles de descarga pegados al lado; para poder subirlos
 * arriba sin que dejen de hablarse, el estado tuvo que subir un nivel,
 * a este componente, que es el padre común de los dos.
 *
 * "Subir fotos" va en esta misma barra por el pedido de siempre: que no
 * haga falta bajar todo el álbum para poder aportar una foto.
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
      {/* La barra: "Subí tus fotos" a la izquierda, "Descargar" a la
          derecha. En pantalla angosta se apilan en ese mismo orden —
          subir primero, que es la acción que trae gente nueva al
          álbum — en vez de ponerlas lado a lado apretadas. */}
      <div className="mt-8 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <SubirFotos
          albumId={albumId}
          fotosActuales={fotos.length}
          claseSerif={claseSerif}
          paleta={paleta}
        />
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
      </div>

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
    </>
  );
}
