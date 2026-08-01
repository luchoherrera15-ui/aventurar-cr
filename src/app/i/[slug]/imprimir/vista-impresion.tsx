"use client";

import { useState } from "react";

export type TamanoPapel = "carta" | "a4";

const PAPEL: Record<TamanoPapel, { css: string; etiqueta: string; medidas: string }> = {
  carta: { css: "letter", etiqueta: "Carta", medidas: "21.6 × 27.9 cm" },
  a4: { css: "A4", etiqueta: "A4", medidas: "21 × 29.7 cm" },
};

/**
 * La invitación lista para papel.
 *
 * Es el MISMO HTML del diseño, no una versión aparte: se imprime con el
 * motor del navegador, así que lo que sale por la impresora es
 * exactamente lo que se ve en pantalla — tipografías, colores y
 * composición incluidos. Lo único que se apaga es lo que en papel no
 * existe: las animaciones, la cuenta regresiva (un contador impreso no
 * tiene sentido) y la barra de esta misma pantalla.
 *
 * El tamaño se cambia con `@page size`, que es lo que lee el diálogo de
 * impresión para elegir la hoja.
 */
export default function VistaImpresion({
  html,
  titulo,
}: {
  html: string;
  titulo: string;
}) {
  const [tamano, setTamano] = useState<TamanoPapel>("carta");

  // Ojo con `print-color-adjust`: sin esto los navegadores descartan
  // fondos e imágenes al imprimir "para ahorrar tinta", y un diseño con
  // fondo de color saldría en blanco. Con esto se respeta el diseño.
  const estilos = `
    @page { size: ${PAPEL[tamano].css}; margin: 10mm; }
    @media print {
      .no-imprimir { display: none !important; }
      html, body { background: #fff !important; }

      /* La paleta, la tipografía y los ornamentos se respetan: en papel
         tiene que reconocerse la misma invitación. Lo que se va es todo
         lo que solo existe porque hay una pantalla. */
      .hoja, .hoja * {
        animation: none !important;
        transition: none !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Un contador impreso miente desde que sale de la impresora. */
      .hoja [data-bookea="cuenta-regresiva"] { display: none !important; }

      /* Video, audio y botones no existen en papel; un mapa embebido
         imprime un rectángulo gris. */
      .hoja video,
      .hoja audio,
      .hoja iframe,
      .hoja button { display: none !important; }

      /* Un elemento fijo se imprime encima del contenido o se repite en
         cada hoja: en papel pasa a fluir con el resto. */
      .hoja [style*="position:fixed"],
      .hoja [style*="position: fixed"] { position: static !important; }

      /* Alturas pensadas para el viewport dejan hojas casi vacías. */
      .hoja [style*="100vh"],
      .hoja [style*="100svh"],
      .hoja [style*="100dvh"] {
        min-height: 0 !important;
        height: auto !important;
      }

      /* Que un bloque no quede partido entre dos hojas. */
      .hoja section,
      .hoja article,
      .hoja figure { break-inside: avoid; }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: estilos }} />

      <div className="no-imprimir sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-surface/95 px-5 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-aventurea-ink">{titulo}</p>
            <p className="text-[12px] text-aventurea-ink-soft">
              Versión para papel — mismo estilo, sin lo que solo vive en pantalla
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Tamaño de papel"
              className="flex rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1"
            >
              {(Object.keys(PAPEL) as TamanoPapel[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={tamano === id}
                  onClick={() => setTamano(id)}
                  className={`rounded-lg px-4 py-1.5 text-[13px] font-bold transition-colors ${
                    tamano === id
                      ? "bg-aventurea-navy text-white"
                      : "text-aventurea-ink-soft hover:text-aventurea-ink"
                  }`}
                >
                  {PAPEL[id].etiqueta}
                  <span className="ml-1.5 hidden text-[11px] font-semibold opacity-70 sm:inline">
                    {PAPEL[id].medidas}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-aventurea-orange px-5 py-2 text-[13.5px] font-bold text-white transition-colors hover:bg-aventurea-orange-dark"
            >
              Descargar PDF
            </button>
          </div>
        </div>

        <p className="mx-auto mt-2 max-w-[1000px] text-[11.5px] leading-relaxed text-aventurea-ink-soft">
          Se abre el cuadro de impresión: elegí <strong>Guardar como PDF</strong> en
          el destino. Si tu diseño tiene fondo de color, activá{" "}
          <strong>Gráficos de fondo</strong> en las opciones para que salga igual
          que en pantalla.
        </p>
      </div>

      {/* El diseño tal cual, sin el bloque de confirmar asistencia: en
          papel no hay dónde confirmar. */}
      <div className="hoja" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
