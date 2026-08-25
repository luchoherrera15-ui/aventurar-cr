"use client";

/** Una burbuja del hilo de WhatsApp simulado, reusada por el hero, por
 *  "Cómo funciona" y por los escenarios. `autor` decide el color y el
 *  lado (el cliente escribe desde la derecha, el bot desde la
 *  izquierda — al revés de un WhatsApp normal de negocio, donde el
 *  dueño ve al cliente a la izquierda; acá el punto de vista es el
 *  cliente mirando su propio chat, que es la pantalla que se está
 *  mostrando). */

import estilos from "./assist.module.css";

type PropsBurbuja = {
  autor: "cliente" | "bot";
  children: React.ReactNode;
  hora?: string;
  etiqueta?: string;
};

export function BurbujaChat({ autor, children, hora, etiqueta }: PropsBurbuja) {
  const clase = autor === "bot" ? estilos.burbujaBot : estilos.burbujaCliente;
  return (
    <div className={`${estilos.burbujaFila} ${autor === "bot" ? estilos.burbujaFilaIzq : estilos.burbujaFilaDer}`}>
      <div className={clase}>
        <p className={estilos.burbujaTexto}>{children}</p>
        {hora ? <span className={estilos.burbujaHora}>{hora}</span> : null}
      </div>
      {etiqueta ? <span className={estilos.burbujaEtiqueta}>{etiqueta}</span> : null}
    </div>
  );
}

/** Los tres puntos de "escribiendo…" del bot. */
export function EscribiendoChat() {
  return (
    <div className={`${estilos.burbujaFila} ${estilos.burbujaFilaIzq}`}>
      <div className={`${estilos.burbujaBot} ${estilos.burbujaEscribiendo}`} aria-label="Escribiendo…">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
