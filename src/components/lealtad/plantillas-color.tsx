"use client";

import {
  PALETAS_LISTA,
  coloresDePaleta,
  paletaDeLosColores,
} from "@/lib/lealtad/paletas";

/**
 * LAS PLANTILLAS DE COLOR, de un toque.
 *
 * ------------------------------------------------------------------
 * QUÉ ARREGLA
 * ------------------------------------------------------------------
 * El creador ofrecía dos ruedas de color en crudo, arrancando en el
 * navy de Bookea. O sea: el dueño veía ocho tarjetas diseñadas en la
 * página —el café marrón, el súper verde, la barbería grafito—, decía
 * «quiero esa», entraba a armar la suya y le daban dos ruedas y suerte.
 * Elegía del menú y en la cocina le pasaban los ingredientes sueltos.
 *
 * Estas ocho son LAS MISMAS de la página: salen de
 * `src/lib/lealtad/paletas.ts`, que es de donde también las lee la
 * landing. No hay una segunda copia de los hexadecimales que se pueda
 * separar de la primera.
 *
 * ------------------------------------------------------------------
 * NINGUNA MARCADA NO ES UN ERROR
 * ------------------------------------------------------------------
 * Qué plantilla está marcada se DERIVA de los dos colores. Por eso
 * afinar una rueda no borra la elección ni la deshace: simplemente
 * ninguna plantilla coincide, ninguna queda marcada, y las ocho siguen
 * ahí para volver de un toque. Con un «elegida» guardado aparte habría
 * dos verdades —la marcada y los colores— y se separarían al primer
 * toque de la rueda.
 */

export default function PlantillasColor({
  colorFondo,
  colorSello,
  alElegir,
}: {
  colorFondo: string;
  colorSello: string;
  alElegir: (colores: { fondo: string; sello: string }) => void;
}) {
  const puesta = paletaDeLosColores(colorFondo, colorSello);

  return (
    <div
      className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-4"
      role="group"
      aria-label="Plantillas de color"
    >
      {PALETAS_LISTA.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={puesta?.id === p.id}
          onClick={() => alElegir(coloresDePaleta(p))}
          className={`presionable overflow-hidden rounded-xl border text-left ${
            puesta?.id === p.id ? "border-bookea-azul ring-2 ring-bookea-azul" : "border-bookea-linea"
          }`}
        >
          {/* La muestra usa los TRES colores: el fondo, el acento en el
              círculo —que es el sello— y el tono del medio en la barra.
              Con dos, dos paletas distintas se ven casi iguales. */}
          <span
            aria-hidden
            className="flex h-11 items-center gap-1.5 px-3"
            style={{ background: p.colores[0] }}
          >
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: p.colores[2] }} />
            <span className="h-1.5 w-8 rounded-full" style={{ background: p.colores[1] }} />
          </span>
          <span className="block truncate px-2.5 py-2 text-[11.5px] font-bold text-bookea-tinta">
            {p.nombre}
          </span>
        </button>
      ))}
    </div>
  );
}
