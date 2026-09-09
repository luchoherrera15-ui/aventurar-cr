"use client";

import { useState } from "react";

/** «Copiar» que dice «Copiado ✓» dos segundos. Sin librerías. */
export default function BotonCopiar({ texto, className }: { texto: string; className: string }) {
  const [listo, setListo] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setListo(true);
          setTimeout(() => setListo(false), 2000);
        } catch {
          window.prompt("Copiá tu enlace:", texto);
        }
      }}
    >
      {listo ? "Copiado ✓" : "Copiar enlace"}
    </button>
  );
}
