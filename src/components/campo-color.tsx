"use client";

import { useState } from "react";
import { normalizarColor } from "@/lib/invitaciones/paleta";

/**
 * UN COLOR: la rueda y el hexadecimal, del mismo campo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ VIVE EN `components/` Y NO EN LA PANTALLA QUE LO USA
 * ------------------------------------------------------------------
 * Estaba copiado en el creador de tarjetas y en el editor del pase, y
 * las copias ya se habían separado: una le ponía `aria-label` al campo
 * de texto y la otra lo dejaba mudo para el lector de pantalla.
 *
 * ------------------------------------------------------------------
 * LA RUEDA NO SALTA A NEGRO MIENTRAS SE ESCRIBE
 * ------------------------------------------------------------------
 * `input type="color"` solo entiende `#rrggbb`. Al borrar un carácter
 * del hexadecimal, el valor deja de ser válido un instante y el
 * navegador pinta la rueda de NEGRO: se ve como si el campo se rompiera
 * al tocarlo. Por eso se recuerda el último color bueno y la rueda se
 * queda con él mientras el texto está a medio escribir.
 *
 * Al salir del campo, lo que no se entienda vuelve a ese último color:
 * así nadie llega a «Guardar» con un color que el servidor va a
 * rechazar por una almohadilla que faltó. `normalizarColor` entiende
 * `#abc` y `rgb(...)` además de `#rrggbb`, así que pegar un color de
 * cualquier lado funciona.
 */

export default function CampoColor({
  id,
  etiqueta,
  valor,
  alCambiar,
  ayuda,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  ayuda?: string;
}) {
  const [ultimoBueno, setUltimoBueno] = useState(normalizarColor(valor) ?? "#000000");

  function escribir(v: string) {
    alCambiar(v);
    const limpio = normalizarColor(v);
    if (limpio) setUltimoBueno(limpio);
  }

  return (
    <div>
      <label
        className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-bookea-gris"
        htmlFor={id}
      >
        {etiqueta}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="color"
          value={normalizarColor(valor) ?? ultimoBueno}
          onChange={(e) => escribir(e.target.value)}
          className="h-[42px] w-14 shrink-0 cursor-pointer rounded-xl border border-bookea-linea"
        />
        <input
          value={valor}
          onChange={(e) => escribir(e.target.value)}
          onBlur={() => alCambiar(normalizarColor(valor) ?? ultimoBueno)}
          aria-label={`${etiqueta} en hexadecimal`}
          spellCheck={false}
          className="w-full rounded-xl border border-bookea-linea bg-white px-3 py-2.5 text-[13.5px] text-bookea-tinta placeholder:text-bookea-gris/70"
        />
      </div>
      {ayuda && <p className="mt-1.5 text-[11.5px] leading-relaxed text-bookea-gris">{ayuda}</p>}
    </div>
  );
}
