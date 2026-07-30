"use client";

import { useState } from "react";

/**
 * Botón chiquito de "copiar al portapapeles" con la confirmación
 * efímera de siempre. Lo usan el espacio del anfitrión (link de la
 * invitación y del álbum) y cualquier página que reparta links.
 */
export default function BotonCopiar({
  texto,
  etiqueta = "Copiar",
  className,
}: {
  /** Lo que se copia (normalmente una URL completa). */
  texto: string;
  etiqueta?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    });
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={
        className ??
        "shrink-0 rounded-lg border border-aventurea-line px-3 py-1.5 text-[12px] font-bold text-aventurea-ink-soft transition-colors hover:border-aventurea-navy hover:text-aventurea-navy"
      }
    >
      {copiado ? "¡Copiado!" : etiqueta}
    </button>
  );
}
