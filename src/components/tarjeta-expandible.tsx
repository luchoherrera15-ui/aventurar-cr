"use client";

import { Children, useId, useState } from "react";
import { IconChevronDown } from "@/components/icons";

/**
 * Tarjeta blanca contenida con encabezado siempre visible (título +
 * chip con el conteo + un extra opcional a la derecha), un ADELANTO con
 * los primeros N hijos y el resto plegado tras un botón de pie
 * "Ver los N ▾ / Ver menos ▴". Es el patrón de /cuenta para que las
 * secciones largas no conviertan la página en una torre vertical: cada
 * bloque enseña lo esencial y solo crece si el usuario lo pide.
 *
 * El resto plegado se anima con el truco de grid-template-rows
 * (0fr → 1fr), así la transición es suave sin medir alturas.
 */
export default function TarjetaExpandible({
  titulo,
  conteo,
  extra,
  adelanto = 3,
  genero = "m",
  className = "",
  claseCuerpo = "",
  claseContenido = "",
  claseResto = "",
  children,
}: {
  /** Título del encabezado (puede llevar un ícono al lado). */
  titulo: React.ReactNode;
  /** Número del chip junto al título. */
  conteo: number;
  /** Contenido opcional a la derecha del encabezado (datos, pestañas…). */
  extra?: React.ReactNode;
  /** Cuántos hijos quedan siempre visibles como adelanto. */
  adelanto?: number;
  /** Género gramatical del botón: "Ver los 13" (m) / "Ver las 5" (f). */
  genero?: "m" | "f";
  /** Clases extra de la tarjeta (márgenes de la página, etc.). */
  className?: string;
  /** Padding del cuerpo que envuelve adelanto + resto. */
  claseCuerpo?: string;
  /** Layout compartido del adelanto y del resto (flex, grid…). */
  claseContenido?: string;
  /** Clases que solo lleva el resto (separador o aire respecto al adelanto). */
  claseResto?: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const idResto = useId();

  const items = Children.toArray(children);
  const visibles = items.slice(0, adelanto);
  const resto = items.slice(adelanto);
  const hayResto = resto.length > 0;

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface ${className}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5 ${
          items.length > 0 ? "border-b border-aventurea-line" : ""
        }`}
      >
        <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-aventurea-ink">
          {titulo}
          <span className="rounded-lg bg-aventurea-navy/10 px-2 py-0.5 text-[11px] font-extrabold leading-none text-aventurea-navy">
            {conteo}
          </span>
        </h2>
        {extra}
      </div>

      {items.length > 0 && (
        <div className={claseCuerpo}>
          <div className={claseContenido}>{visibles}</div>
          {hayResto && (
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              {/* El hijo con overflow-hidden recorta el resto (incluido su
                  padding o borde) mientras la fila del grid mide 0. */}
              <div id={idResto} inert={!abierto} className="min-h-0 overflow-hidden">
                <div className={`${claseContenido} ${claseResto}`}>{resto}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {hayResto && (
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idResto}
          onClick={() => setAbierto((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-aventurea-line px-5 py-2.5 text-[12.5px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-cream-2/60"
        >
          {abierto ? "Ver menos" : `Ver ${genero === "f" ? "las" : "los"} ${items.length}`}
          <IconChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-300 ${abierto ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </section>
  );
}
