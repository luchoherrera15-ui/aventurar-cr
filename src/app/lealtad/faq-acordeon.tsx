"use client";

import { useState } from "react";

/**
 * EL ACORDEÓN DEL FAQ, CON ALTURA ANIMADA DE VERDAD.
 *
 * La versión anterior usaba `<details>/<summary>` nativo: sin
 * transición de altura, el panel aparece de un salto. Acá se pasa al
 * patrón `desplegable` del sistema (`globals.css`,
 * `grid-template-rows: 0fr → 1fr`) — la misma pieza que ya usan los
 * acordeones del panel, así que el FAQ público queda con el mismo
 * ritmo (`--duracion-card`, `--ease-bookea`) que el resto del sitio, en
 * vez de reinventar una animación de `max-height` a mano.
 *
 * Cada pregunta se abre y cierra de forma independiente (no es un
 * grupo mutuamente excluyente): es el mismo comportamiento que
 * `<details>` sin `name` ya tenía, y cinco preguntas no ameritan forzar
 * que abrir una cierre las demás.
 */
export default function FaqAcordeon({
  items,
}: {
  items: { pregunta: string; respuesta: string }[];
}) {
  const [abiertas, setAbiertas] = useState<Set<number>>(new Set());

  function alternar(i: number) {
    setAbiertas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(i)) siguiente.delete(i);
      else siguiente.add(i);
      return siguiente;
    });
  }

  return (
    <div className="divide-y divide-aventurea-line rounded-3xl border border-aventurea-line bg-white">
      {items.map((f, i) => {
        const expandido = abiertas.has(i);
        return (
          <div key={f.pregunta} className="p-5 sm:p-6">
            <button
              type="button"
              aria-expanded={expandido}
              onClick={() => alternar(i)}
              className="flex w-full items-center justify-between gap-4 text-left text-[14.5px] font-extrabold text-aventurea-navy"
            >
              {f.pregunta}
              <span
                aria-hidden
                className="shrink-0 text-[18px] font-bold text-[color:var(--orange-acento-claro)] transition-transform"
                style={{
                  transitionDuration: "var(--duracion-micro)",
                  transitionTimingFunction: "var(--ease-bookea)",
                  transform: expandido ? "rotate(45deg)" : "none",
                }}
              >
                +
              </span>
            </button>
            <div className="desplegable" data-abierto={expandido}>
              <div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {f.respuesta}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
