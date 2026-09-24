"use client";

import { useState, type ReactNode } from "react";
import { VerMas } from "./piezas";

/**
 * VARIANTE C — un escenario grande y cuatro pestañas.
 *
 * La única de las cuatro que necesita JavaScript, y por eso vive en su
 * propio archivo con `"use client"`: si estuviera junto a las otras,
 * arrastraría al cliente piezas que hoy se renderizan en el servidor.
 *
 * La idea: en vez de cuatro cosas chicas al mismo tiempo, UNA grande
 * por vez. El visual gana cuatro veces el espacio; a cambio, solo se ve
 * lo que la persona elige — y hay que confiar en que toque las
 * pestañas.
 */

export default function VariantePestanas({
  paneles,
}: {
  paneles: { titulo: string; resumen: string; pieza: ReactNode }[];
}) {
  const [activo, setActivo] = useState(0);

  return (
    <div>
      {/* Las pestañas */}
      <div
        role="tablist"
        aria-label="Qué hace Bookea"
        className="mx-auto flex max-w-[640px] flex-wrap justify-center gap-2"
      >
        {paneles.map((p, i) => (
          <button
            key={p.titulo}
            role="tab"
            type="button"
            aria-selected={i === activo}
            onClick={() => setActivo(i)}
            className={`rounded-[10px] px-4 py-2.5 text-[14px] font-extrabold transition-colors ${
              i === activo
                ? "bg-[color:var(--tinta)] text-white"
                : "bg-[color:var(--superficie)] text-[color:var(--tinta)] hover:bg-[color:var(--superficie-2)]"
            }`}
          >
            {p.titulo}
          </button>
        ))}
      </div>

      {/* El escenario */}
      <div className="group mt-8 rounded-[24px] border border-[color:var(--linea)] bg-[color:var(--superficie)] p-8 sm:p-12">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="mx-auto w-full max-w-[360px]">
            {paneles[activo].pieza}
          </div>
          <div className="text-left">
            <p className="titulo text-[clamp(24px,3.4vw,34px)] text-[color:var(--tinta)]">
              {paneles[activo].titulo}
            </p>
            <p className="mt-3 max-w-[40ch] text-[16px] leading-relaxed text-[color:var(--tinta-suave)]">
              {paneles[activo].resumen}
            </p>
            <VerMas className="mt-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
