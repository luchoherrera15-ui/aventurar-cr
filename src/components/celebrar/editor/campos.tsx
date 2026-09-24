"use client";

import AsistenteTexto, { type CampoIA } from "./asistente-texto";

/**
 * Los controles del panel derecho del editor: campo de texto, área,
 * interruptor y selector. Todos con rótulo visible, área táctil ≥ 44 px
 * y las clases del sistema de CELEBRAR (`c-campo`, `c-rotulo`).
 *
 * `ia`: si el campo lo declara, aparece el «diamantito» al lado del
 * rótulo para escribirlo con IA (ver asistente-texto.tsx).
 */

function Rotulo({ id, etiqueta, ia, valor, alCambiar }: { id: string; etiqueta: string; ia?: CampoIA; valor: string; alCambiar: (v: string) => void }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <label htmlFor={id} className="c-rotulo">
        {etiqueta}
      </label>
      {ia && <AsistenteTexto ia={ia} valor={valor} alAplicar={alCambiar} />}
    </div>
  );
}

export function Campo({
  id,
  etiqueta,
  valor,
  alCambiar,
  placeholder,
  tipo = "text",
  maxLength = 160,
  ayuda,
  ia,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  placeholder?: string;
  tipo?: "text" | "url" | "date" | "tel";
  maxLength?: number;
  ayuda?: string;
  ia?: CampoIA;
}) {
  return (
    <div>
      <Rotulo id={id} etiqueta={etiqueta} ia={ia} valor={valor} alCambiar={alCambiar} />
      <input
        id={id}
        type={tipo}
        value={valor}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => alCambiar(e.target.value)}
        className="c-campo min-h-11 text-[14px]"
      />
      {ayuda && <p className="mt-1.5 text-[12px] text-(--c-tinta-suave)">{ayuda}</p>}
    </div>
  );
}

export function Area({
  id,
  etiqueta,
  valor,
  alCambiar,
  placeholder,
  filas = 4,
  maxLength = 2000,
  ia,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  placeholder?: string;
  filas?: number;
  maxLength?: number;
  ia?: CampoIA;
}) {
  return (
    <div>
      <Rotulo id={id} etiqueta={etiqueta} ia={ia} valor={valor} alCambiar={alCambiar} />
      <textarea
        id={id}
        value={valor}
        rows={filas}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => alCambiar(e.target.value)}
        className="c-campo min-h-[96px] resize-y py-2.5 text-[14px] leading-relaxed"
      />
    </div>
  );
}

export function Interruptor({
  id,
  etiqueta,
  activo,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  activo: boolean;
  alCambiar: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-[14px] text-(--c-tinta)">
      <span>{etiqueta}</span>
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={activo}
          aria-checked={activo}
          onChange={(e) => alCambiar(e.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-(--c-linea) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) peer-checked:bg-(--c-ok) peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--c-azul)" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-(--c-blanco) shadow-plano transition-transform duration-(--duracion-micro) ease-(--ease-bookea) peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Selector<T extends string>({
  id,
  etiqueta,
  valor,
  opciones,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: T;
  opciones: readonly { valor: T; texto: string; estilo?: React.CSSProperties }[];
  alCambiar: (v: T) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="c-rotulo">
        {etiqueta}
      </label>
      <select id={id} value={valor} onChange={(e) => alCambiar(e.target.value as T)} className="c-campo min-h-11 text-[14px]">
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor} style={o.estilo}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Botón chico de una fila (subir, bajar, quitar). */
export function BotonFila({
  onClick,
  etiqueta,
  children,
  disabled,
}: {
  onClick: () => void;
  etiqueta: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-(--c-tinta-suave) transition-colors duration-(--duracion-micro) ease-(--ease-bookea) hover:bg-(--c-hielo) hover:text-(--c-tinta) disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
