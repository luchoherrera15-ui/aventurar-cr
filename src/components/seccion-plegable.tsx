import type { ReactNode } from "react";
import { IconChevronDown } from "@/components/icons";

/**
 * Bloque plegable a base de <details>: funciona sin JavaScript y los
 * inputs de un formulario que quede cerrado siguen en el DOM, así que
 * se envían igual al guardar. El atributo `open` solo fija el estado
 * inicial — después el dueño lo abre y cierra a gusto.
 *
 * Dos modos:
 * - `marco` (por defecto): todo es UNA tarjeta; el contenido se pinta
 *   dentro del mismo borde. Para contenido que no trae tarjeta propia.
 * - `marco={false}`: solo el encabezado es tarjeta; al abrir, el
 *   contenido aparece debajo con sus propias tarjetas (formularios que
 *   ya vienen enmarcados, como los de precios o descuentos).
 */
export default function SeccionPlegable({
  id,
  etiqueta,
  titulo,
  descripcion,
  resumen,
  abierta = false,
  marco = true,
  children,
}: {
  id?: string;
  /** Rótulo naranja pequeño encima del título (opcional). */
  etiqueta?: string;
  titulo: string;
  descripcion?: ReactNode;
  /** Dato corto a la derecha del título, ej. "3 cupones". */
  resumen?: string;
  abierta?: boolean;
  marco?: boolean;
  children: ReactNode;
}) {
  const encabezado = (
    <>
      <span className="min-w-0">
        {etiqueta && (
          <span className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-orange">
            {etiqueta}
          </span>
        )}
        <span className={`block text-[15px] font-bold text-aventurea-ink ${etiqueta ? "mt-1" : ""}`}>
          {titulo}
        </span>
        {descripcion && (
          <span className="mt-1 block text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            {descripcion}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-0.5">
        {resumen && (
          <span className="whitespace-nowrap rounded-full bg-aventurea-cream-2 px-2.5 py-1 text-[11px] font-bold text-aventurea-ink-soft">
            {resumen}
          </span>
        )}
        <IconChevronDown className="h-4 w-4 text-aventurea-ink-soft transition-transform group-open:rotate-180" />
      </span>
    </>
  );

  if (!marco) {
    return (
      <details id={id} open={abierta} className="group">
        <summary className="flex cursor-pointer select-none list-none items-start justify-between gap-3 rounded-2xl border border-aventurea-line bg-aventurea-surface px-5 py-4 shadow-sm transition-colors hover:border-aventurea-navy/40 [&::-webkit-details-marker]:hidden">
          {encabezado}
        </summary>
        <div className="mt-3 flex flex-col gap-3.5">{children}</div>
      </details>
    );
  }

  return (
    <details
      id={id}
      open={abierta}
      className="group rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm"
    >
      <summary className="flex cursor-pointer select-none list-none items-start justify-between gap-3 p-5.5 [&::-webkit-details-marker]:hidden">
        {encabezado}
      </summary>
      <div className="px-5.5 pb-5.5">{children}</div>
    </details>
  );
}
