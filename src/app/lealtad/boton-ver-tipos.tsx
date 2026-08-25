"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { TIPOS_TARJETA, TIPOS_TARJETA_ID, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * "Ver cuáles →" al lado de la viñeta "Los N tipos de tarjeta" en las
 * cards de paquete (`panel-paquetes-lealtad.tsx` y `precios-landing.tsx`,
 * las dos consumen `bulletsDe` de la primera). Esa viñeta prometía
 * sellos/puntos/cupón/etc. sin decir cuáles son — quien no se sabe el
 * catálogo de memoria no tenía forma de comprobarlo sin salir de la
 * pantalla de precios.
 */
export default function BotonVerTipos({
  tipos,
  /** true = texto claro, para las cards oscuras de precios-landing.tsx. */
  claro = false,
}: {
  /** Los tipos que trae ESTE paquete — null = los ocho (planes.ts). */
  tipos: readonly TipoTarjeta[] | null;
  claro?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const lista = tipos ?? TIPOS_TARJETA_ID;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`ml-1 font-extrabold underline underline-offset-2 ${
          claro ? "text-white" : "text-bookea-azul"
        }`}
      >
        Ver cuáles
      </button>

      {/* Portal a `document.body`: las cards de paquete tienen
          `will-change-transform` (la animación de hover) — cualquier
          descendiente `position: fixed` de un elemento con transform
          (o will-change: transform) deja de posicionarse contra el
          viewport y pasa a posicionarse contra ESE elemento. Sin el
          portal, el popup quedaba encogido adentro de la card en vez
          de cubrir la pantalla. */}
      {abierto &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tipos de tarjeta incluidos"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-5"
          onClick={() => setAbierto(false)}
        >
          <div
            className="max-h-[85svh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-extrabold text-bookea-tinta">
                  {lista.length === TIPOS_TARJETA_ID.length
                    ? "Los 8 tipos de tarjeta"
                    : `${lista.length} tipos de tarjeta`}
                </h2>
                <p className="mt-0.5 text-[12px] text-bookea-gris">Elegís uno al armar tu tarjeta.</p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="shrink-0 rounded-full p-1.5 text-bookea-gris hover:bg-bookea-fondo"
              >
                <Icono nombre="cerrar" className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {lista.map((id) => {
                const def = TIPOS_TARJETA[id];
                return (
                  <li
                    key={id}
                    className="flex items-start gap-2.5 rounded-xl border border-bookea-linea p-3"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bookea-azul-suave text-bookea-azul">
                      <Icono nombre={def.icono as NombreIcono} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-extrabold text-bookea-tinta">
                        {def.nombre}
                      </span>
                      <span className="block text-[11px] leading-snug text-bookea-gris">
                        {def.descripcion}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
