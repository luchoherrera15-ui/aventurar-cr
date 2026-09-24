"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lo que el editor le pasa a cada escena para poder tocarla en la
 * previa: si está seleccionada, y qué hacer al tocarla, al apagarla o
 * al pedir su diseño. En la página pública no viene nada de esto.
 */
export type EscenaEditable = {
  id: string;
  nombre: string;
  activa: boolean;
  fija: boolean;
  visible: boolean;
  alSeleccionar: (id: string) => void;
  alOcultar: (id: string) => void;
  alDisenar: (id: string) => void;
};

/**
 * Una escena de la invitación: la sección que, al entrar en la vista,
 * marca `data-vista` para que sus piezas (`.inv-rev`) hagan su entrada.
 * El IntersectionObserver funciona igual en la página pública y dentro
 * del teléfono del editor (el observador tiene en cuenta el recorte de
 * los contenedores con scroll). Sin JS, sin `animaciones` o con
 * `prefers-reduced-motion`, la hoja de estilos deja todo visible.
 *
 * En el editor, además, la escena es TOCABLE: un clic la selecciona (y
 * abre su tarjeta en el panel), y la seleccionada muestra un marco
 * punteado con dos botones flotantes — ocultar y «Aa» (su diseño).
 */
export default function Escena({
  className,
  style,
  children,
  borde,
  editable,
  ...resto
}: React.HTMLAttributes<HTMLElement> & { borde?: boolean; editable?: EscenaEditable }) {
  const ref = useRef<HTMLElement>(null);
  const [vista, setVista] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || vista) return;
    if (typeof IntersectionObserver === "undefined") {
      // Navegador sin observador: se muestra de una, sin re-render.
      el.setAttribute("data-vista", "");
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVista(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [vista]);

  // La seleccionada desde el panel se trae a la vista dentro del teléfono.
  useEffect(() => {
    if (editable?.activa) ref.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [editable?.activa]);

  const clases = [className, editable ? "inv-editable" : "", editable?.activa ? "inv-activa" : "", editable && !editable.visible ? "inv-apagada" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      ref={ref}
      className={clases}
      style={style}
      data-vista={vista ? "" : undefined}
      data-borde={borde ? "" : undefined}
      onClickCapture={
        editable
          ? (e) => {
              // Un clic en un link o botón de la invitación no navega en el
              // editor: selecciona la escena.
              e.preventDefault();
              editable.alSeleccionar(editable.id);
            }
          : undefined
      }
      {...resto}
    >
      {children}
      {editable?.activa && (
        <div className="inv-herramientas" aria-label={`Sección ${editable.nombre}`}>
          <span className="inv-herr-nombre">{editable.nombre}</span>
          {!editable.fija && (
            <button
              type="button"
              className="inv-herr-btn"
              title={editable.visible ? "Ocultar esta sección" : "Mostrar esta sección"}
              aria-label={editable.visible ? "Ocultar esta sección" : "Mostrar esta sección"}
              onClick={(e) => {
                e.stopPropagation();
                editable.alOcultar(editable.id);
              }}
            >
              {editable.visible ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 9 4 10 7-.4 1.2-1.3 2.6-2.6 3.8M6.6 6.6C4.3 8 2.7 10 2 12c1 3 5 7 10 7 1.5 0 2.9-.3 4.1-.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M2 12c1-3 5-7 10-7s9 4 10 7c-1 3-5 7-10 7S3 15 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}
          <button
            type="button"
            className="inv-herr-btn inv-herr-aa"
            title="Diseño de esta sección"
            aria-label="Diseño de esta sección"
            onClick={(e) => {
              e.stopPropagation();
              editable.alDisenar(editable.id);
            }}
          >
            Aa
          </button>
        </div>
      )}
    </section>
  );
}
