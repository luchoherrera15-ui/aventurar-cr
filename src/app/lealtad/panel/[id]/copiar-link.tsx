"use client";

import { useState } from "react";

/**
 * COPIAR UN LINK, CON ACUSE DE RECIBO.
 *
 * El dueño reparte estos links por WhatsApp. Seleccionarlos a mano de
 * un bloque de texto en el teléfono es donde se pierde media URL — y un
 * link a medias lleva a «este código no lleva a ninguna tarjeta».
 *
 * El «Copiado» no es adorno: sin confirmación nadie sabe si el toque
 * funcionó, y la reacción es tocar otra vez. Vuelve solo a los dos
 * segundos para que el botón no quede mintiendo si después falla.
 *
 * `navigator.clipboard` puede no existir (http sin TLS, un navegador
 * viejo) o negarse por permisos: en ese caso se dice que no se pudo, en
 * vez de fingir que sí. El link está a la vista al lado, así que
 * siempre queda el camino de seleccionarlo a mano.
 */
export default function CopiarLink({ url, etiqueta }: { url: string; etiqueta?: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "falla">("listo");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
      setTimeout(() => setEstado("listo"), 2000);
    } catch {
      setEstado("falla");
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={etiqueta ? `Copiar el link de ${etiqueta}` : "Copiar el link"}
      className="presionable shrink-0 rounded-lg border border-aventurea-line bg-aventurea-surface px-3 py-1.5 text-[12px] font-bold text-aventurea-ink hover:border-aventurea-navy"
    >
      {estado === "copiado" ? "Copiado" : estado === "falla" ? "Copialo a mano" : "Copiar"}
    </button>
  );
}
