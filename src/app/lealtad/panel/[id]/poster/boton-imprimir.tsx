"use client";

/** Imprime la hoja. El CSS de `poster.css` esconde todo lo demás. */
export default function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="poster-imprimir">
      🖨️ Imprimir el póster
    </button>
  );
}
