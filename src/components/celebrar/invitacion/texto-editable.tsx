"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * Qué hace el editor cuando la persona escribe sobre un texto de la
 * previa: `(idDeSeccion, ruta dentro de datos, valor nuevo)`. En la
 * página pública y en la demo no hay proveedor y `<Texto>` es un
 * elemento común.
 */
export type EditarTexto = (seccionId: string, ruta: string, valor: string) => void;

const ContextoEdicionTexto = createContext<EditarTexto | null>(null);

/** El renderizador (que puede correr en el servidor) envuelve las escenas con esto. */
export function ProveedorEdicionTexto({ editar, children }: { editar: EditarTexto | null; children: React.ReactNode }) {
  return <ContextoEdicionTexto.Provider value={editar}>{children}</ContextoEdicionTexto.Provider>;
}

type Etiqueta = "p" | "h1" | "h2" | "h3" | "span";

/**
 * Un texto de la invitación que, dentro del editor, SE EDITA EN SU LUGAR:
 * un clic lo vuelve editable (con el cursor donde se hizo clic), cada
 * tecla actualiza el documento (la previa y el panel de la derecha van a
 * la par), Enter confirma en los de una línea, Escape deshace y salir
 * del campo cierra la edición.
 *
 * Mientras se edita, React no toca el contenido del nodo (renderiza
 * `null` como hijos y el texto vive en el DOM): así el cursor no salta
 * con cada re-render. Al cerrar, se vacía el nodo a mano antes de que
 * React vuelva a pintar sus hijos, para no duplicar el texto.
 */
export function Texto({
  sid,
  ruta,
  valor,
  as: Etiq = "p",
  multilinea = false,
  className,
  style,
  children,
}: {
  /** El id de la sección dueña del texto. */
  sid: string;
  /** La ruta dentro de `datos` («titulo», «items.0.detalle»). */
  ruta: string;
  /** El valor actual del documento (lo que se edita). */
  valor: string;
  as?: Etiqueta;
  /** Enter inserta salto de línea en vez de confirmar. */
  multilinea?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Cómo se PINTA (puede diferir del valor: «Sofía & Andrés» con el «&» en acento). */
  children?: React.ReactNode;
}) {
  const editar = useContext(ContextoEdicionTexto);
  const ref = useRef<HTMLElement>(null);
  const [editando, setEditando] = useState(false);
  // Dónde se hizo clic (para poner el cursor ahí) y el valor de partida (para Escape).
  const punto = useRef<{ x: number; y: number } | null>(null);
  const inicial = useRef(valor);

  useEffect(() => {
    if (!editando) return;
    const el = ref.current;
    if (!el) return;
    el.textContent = inicial.current;
    el.focus({ preventScroll: true });
    colocarCursor(el, punto.current);
  }, [editando]);

  if (!editar) {
    return (
      <Etiq className={className} style={style}>
        {children ?? valor}
      </Etiq>
    );
  }

  function cerrar() {
    const el = ref.current;
    // Vaciar antes de que React vuelva a pintar los hijos: si no, el texto
    // escrito quedaría al lado del que React agrega.
    if (el) el.textContent = "";
    setEditando(false);
  }

  return (
    <Etiq
      ref={ref as React.Ref<HTMLHeadingElement & HTMLParagraphElement & HTMLSpanElement>}
      className={`${className ?? ""} inv-txt ${editando ? "inv-txt-editando" : ""}`.trim()}
      style={style}
      contentEditable={editando ? (soportaSoloTexto() ? "plaintext-only" : true) : undefined}
      suppressContentEditableWarning
      spellCheck={editando ? true : undefined}
      role={editando ? "textbox" : undefined}
      aria-multiline={editando ? multilinea : undefined}
      aria-label={editando ? "Editar texto" : undefined}
      title={editando ? undefined : "Clic para editar"}
      onClick={
        editando
          ? undefined
          : (e) => {
              punto.current = { x: e.clientX, y: e.clientY };
              inicial.current = valor;
              setEditando(true);
            }
      }
      onInput={
        editando
          ? (e) => {
              const el = e.currentTarget;
              editar(sid, ruta, leerTexto(el, multilinea));
            }
          : undefined
      }
      onKeyDown={
        editando
          ? (e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                editar(sid, ruta, inicial.current);
                cerrar();
              } else if (e.key === "Enter" && (!multilinea || e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                cerrar();
              }
            }
          : undefined
      }
      onBlur={editando ? cerrar : undefined}
      onPaste={
        editando && !soportaSoloTexto()
          ? (e) => {
              // Sin `plaintext-only` el navegador pegaría HTML: se pega el texto plano.
              e.preventDefault();
              document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
            }
          : undefined
      }
    >
      {editando ? null : children ?? valor}
    </Etiq>
  );
}

/** El texto del nodo: exacto con `plaintext-only`; por `innerText` (que respeta los <br>) sin él. */
function leerTexto(el: HTMLElement, multilinea: boolean): string {
  const crudo = soportaSoloTexto() ? el.textContent ?? "" : el.innerText;
  // Los de una línea nunca guardan saltos (un Enter que se coló, un pegado).
  const texto = multilinea ? crudo.replace(/\u00a0/g, " ") : crudo.replace(/\s*\n\s*/g, " ");
  return texto.replace(/\n{3,}/g, "\n\n");
}

let soporte: boolean | null = null;
/** Chrome, Safari y Firefox 136+ editan solo texto plano (Enter = \n, sin HTML pegado). */
function soportaSoloTexto(): boolean {
  if (soporte !== null) return soporte;
  if (typeof document === "undefined") return false;
  const d = document.createElement("div");
  d.contentEditable = "plaintext-only";
  soporte = d.contentEditable === "plaintext-only";
  return soporte;
}

/** Pone el cursor donde se hizo clic; si no se puede, al final. */
function colocarCursor(el: HTMLElement, punto: { x: number; y: number } | null) {
  const sel = window.getSelection();
  if (!sel) return;
  let rango: Range | null = null;
  if (punto) {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(punto.x, punto.y);
      if (pos && el.contains(pos.offsetNode)) {
        rango = document.createRange();
        rango.setStart(pos.offsetNode, pos.offset);
        rango.collapse(true);
      }
    } else if (doc.caretRangeFromPoint) {
      const r = doc.caretRangeFromPoint(punto.x, punto.y);
      if (r && el.contains(r.startContainer)) rango = r;
    }
  }
  if (!rango) {
    rango = document.createRange();
    rango.selectNodeContents(el);
    rango.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(rango);
}
