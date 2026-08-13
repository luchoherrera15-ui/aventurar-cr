"use client";

import { useRef } from "react";
import { TIPOS_TARJETA_LISTA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { Icono, type NombreIcono } from "./iconos";

/**
 * PASO 1 DEL CREADOR: qué clase de tarjeta se va a hacer.
 *
 * Es una RADIOGROUP de verdad, no ocho divs con onClick. La diferencia
 * importa y no es cosmética:
 *
 *   · un lector de pantalla anuncia «grupo de opciones, 1 de 8» y el
 *     estado de cada una, en vez de leer ocho textos sueltos sin decir
 *     que hay que elegir uno;
 *   · las flechas del teclado mueven entre opciones y el Tab salta al
 *     siguiente campo — que es lo que un formulario hace;
 *   · una sola parada de tabulación para las ocho, no ocho.
 *
 * El patrón es el de WAI-ARIA: `tabIndex` 0 solo en la seleccionada
 * («roving tabindex»), y las flechas mueven la selección y el foco a
 * la vez.
 */

/** Wrap-around: de la última a la primera, como espera el patrón. */
function siguiente(indice: number, delta: number, total: number): number {
  return (indice + delta + total) % total;
}

export default function SelectorTipo({
  valor,
  alElegir,
}: {
  valor: TipoTarjeta;
  alElegir: (tipo: TipoTarjeta) => void;
}) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const indiceActual = TIPOS_TARJETA_LISTA.findIndex((t) => t.id === valor);

  function mover(delta: number) {
    const i = siguiente(Math.max(0, indiceActual), delta, TIPOS_TARJETA_LISTA.length);
    alElegir(TIPOS_TARJETA_LISTA[i].id);
    botones.current[i]?.focus();
  }

  function alTeclado(e: React.KeyboardEvent) {
    // En una grilla, abajo/arriba saltan una fila. Se asume la grilla
    // de 2 columnas del móvil como mínimo común: en desktop son 4 y el
    // salto se siente igual de natural.
    const saltos: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 2,
      ArrowLeft: -1,
      ArrowUp: -2,
    };
    const delta = saltos[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    mover(delta);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tipo de tarjeta"
      onKeyDown={alTeclado}
      className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
    >
      {TIPOS_TARJETA_LISTA.map((tipo, i) => {
        const elegido = tipo.id === valor;
        return (
          <button
            key={tipo.id}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={elegido}
            // Roving tabindex: una sola parada para las ocho.
            tabIndex={elegido || (indiceActual === -1 && i === 0) ? 0 : -1}
            onClick={() => alElegir(tipo.id)}
            className={`elevar group relative flex h-full flex-col items-start rounded-3xl border p-4 text-left ${
              elegido
                ? "border-bookea-azul bg-bookea-azul-suave"
                : "border-bookea-linea bg-white hover:border-bookea-azul/40"
            }`}
          >
            {/* El check naranja de la seleccionada. `scale` y no
                `display`: aparecer de golpe se lee como un parpadeo. */}
            <span
              aria-hidden
              className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full text-white transition-transform duration-200 ${
                elegido ? "scale-100" : "scale-0"
              }`}
              style={{ background: "var(--orange)" }}
            >
              <Icono nombre="listo" className="h-3.5 w-3.5" />
            </span>

            <span
              className={`grid h-10 w-10 place-items-center rounded-2xl transition-colors ${
                elegido ? "text-white" : "text-bookea-azul"
              }`}
              style={{
                background: elegido ? "var(--navy)" : "var(--navy-suave)",
              }}
            >
              <Icono nombre={tipo.icono as NombreIcono} className="h-5 w-5" />
            </span>

            <span className="mt-3 block text-[14px] font-extrabold text-bookea-tinta">
              {tipo.nombre}
            </span>
            <span className="mt-1 block text-[11.5px] leading-snug text-bookea-gris">
              {tipo.descripcion}
            </span>
          </button>
        );
      })}
    </div>
  );
}
