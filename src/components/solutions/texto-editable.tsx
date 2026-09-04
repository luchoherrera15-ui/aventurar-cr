"use client";

import { useEffect, useRef } from "react";

/**
 * TEXTO QUE SE EDITA DONDE SE VE.
 *
 * Pedido del dueño (4 sep 2026): «que todo sea editable en tiempo real,
 * poder editar textos, variables, etc.» — o sea escribir SOBRE la
 * página, no en un formulario al lado.
 *
 * ── POR QUÉ NO ES UN CAMPO CONTROLADO ──────────────────────────────
 * El reflejo sería `contentEditable` + `value={texto}` y reescribir en
 * cada tecla. Eso ROMPE el cursor: React reemplaza el nodo de texto, el
 * navegador pierde la posición del caret y lo manda al principio, así
 * que escribir «Casa» sale «asaC».
 *
 * La solución es la de siempre para contentEditable: el DOM manda
 * mientras el elemento tiene el foco. Acá adentro nunca se escribe el
 * contenido desde React si el usuario está escribiendo; solo se
 * sincroniza desde afuera cuando el elemento NO tiene foco (por
 * ejemplo, al cambiar de tema o al cargar otro negocio).
 *
 * ── Y POR QUÉ SOLO TEXTO PLANO ─────────────────────────────────────
 * `contentEditable` acepta pegar HTML con formato, imágenes y estilos
 * del portapapeles. Todo eso terminaría guardado y servido en una
 * página pública. El `onPaste` fuerza texto plano y el `onInput` lee
 * `textContent`, nunca `innerHTML`: lo que se guarda es siempre una
 * cadena, igual que si viniera de un `<input>`.
 */
export default function TextoEditable({
  valor,
  alCambiar,
  placeholder,
  maxLength,
  className = "",
  style,
  etiqueta,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Para el lector de pantalla: qué se está editando. */
  etiqueta: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  // Sincronización de AFUERA hacia adentro, solo si nadie está
  // escribiendo. Sin la guarda del foco, esto es exactamente el bug del
  // cursor que el comentario de arriba describe.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== valor) el.textContent = valor;
  }, [valor]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={etiqueta}
      tabIndex={0}
      spellCheck={false}
      data-vacio={valor.length === 0 ? "" : undefined}
      data-placeholder={placeholder}
      onInput={(e) => {
        const t = (e.currentTarget.textContent ?? "").replace(/\n/g, " ");
        alCambiar(maxLength ? t.slice(0, maxLength) : t);
      }}
      onPaste={(e) => {
        // Texto plano y nada más: sin esto entra HTML del portapapeles.
        e.preventDefault();
        const t = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        document.execCommand("insertText", false, t);
      }}
      onKeyDown={(e) => {
        // Enter cierra la edición en vez de meter un salto de línea:
        // estos textos son de UNA línea (el nombre, la bajada, la
        // etiqueta de un botón).
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
      }}
      className={`cursor-text rounded-[3px] outline-none ring-offset-1 transition-shadow focus:ring-2 focus:ring-white/60 hover:bg-white/10 empty:before:content-[attr(data-placeholder)] empty:before:opacity-50 ${className}`}
      style={style}
    />
  );
}
