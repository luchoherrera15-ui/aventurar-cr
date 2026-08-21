"use client";

import type { ReactNode } from "react";
import {
  CATEGORIAS_DEMO,
  ZONAS_DEMO,
  precioSimbolo,
  type CategoriaDemo,
  type MomentoDia,
  type ZonaDemo,
} from "@/lib/food/demo/tipos";
import { IconX } from "@/components/icons";

/**
 * Los filtros combinables de la demo. El estado vive en el padre
 * (marketplace-demo.tsx) — este componente solo pinta el panel: bottom
 * sheet en móvil, diálogo centrado en desktop. Cada chip aplica al
 * instante (sin botón "Aplicar"), que es lo que hace fluida una demo
 * en vivo frente a un cliente.
 */
export type FiltrosDemo = {
  zona: ZonaDemo | null;
  categoria: CategoriaDemo | null;
  descuentoMin: number | null;
  ratingMin: number | null;
  precio: 1 | 2 | 3 | 4 | null;
  momento: MomentoDia | null;
};

export const FILTROS_VACIOS: FiltrosDemo = {
  zona: null,
  categoria: null,
  descuentoMin: null,
  ratingMin: null,
  precio: null,
  momento: null,
};

export function hayFiltros(f: FiltrosDemo): boolean {
  return Object.values(f).some((v) => v !== null);
}

const DESCUENTOS = [10, 20, 30, 40, 50];
const RATINGS = [4.0, 4.5, 4.8];
const PRECIOS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
const MOMENTOS: { id: MomentoDia; label: string }[] = [
  { id: "almuerzo", label: "Almuerzo" },
  { id: "tarde", label: "Tarde" },
  { id: "cena", label: "Cena" },
];

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`presionable rounded-xl border px-3.5 py-2 text-[13px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
      }`}
    >
      {children}
    </button>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-aventurea-ink-soft">
        {titulo}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function FiltrosDemoPanel({
  abierto,
  filtros,
  onCambiar,
  onLimpiar,
  onCerrar,
  resultados,
}: {
  abierto: boolean;
  filtros: FiltrosDemo;
  onCambiar: (f: FiltrosDemo) => void;
  onLimpiar: () => void;
  onCerrar: () => void;
  resultados: number;
}) {
  if (!abierto) return null;

  function alternar<K extends keyof FiltrosDemo>(clave: K, valor: FiltrosDemo[K]) {
    onCambiar({ ...filtros, [clave]: filtros[clave] === valor ? null : valor });
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Cerrar filtros"
        onClick={onCerrar}
        className="absolute inset-0 bg-aventurea-navy/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-flotante sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[560px] sm:max-h-[80vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="titulo text-[19px] text-aventurea-navy">Filtros</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="presionable flex h-9 w-9 items-center justify-center rounded-full border border-aventurea-line text-aventurea-ink hover:border-aventurea-navy"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-6">
          <Grupo titulo="Zona">
            {ZONAS_DEMO.map((z) => (
              <Chip key={z} activo={filtros.zona === z} onClick={() => alternar("zona", z)}>
                {z}
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Tipo de comida">
            {CATEGORIAS_DEMO.map((c) => (
              <Chip key={c} activo={filtros.categoria === c} onClick={() => alternar("categoria", c)}>
                {c}
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Descuento">
            {DESCUENTOS.map((d) => (
              <Chip key={d} activo={filtros.descuentoMin === d} onClick={() => alternar("descuentoMin", d)}>
                {d}%+
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Rating">
            {RATINGS.map((r) => (
              <Chip key={r} activo={filtros.ratingMin === r} onClick={() => alternar("ratingMin", r)}>
                {r.toFixed(1)}+
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Precio">
            {PRECIOS.map((p) => (
              <Chip key={p} activo={filtros.precio === p} onClick={() => alternar("precio", p)}>
                {precioSimbolo(p)}
              </Chip>
            ))}
          </Grupo>

          <Grupo titulo="Horario">
            {MOMENTOS.map((m) => (
              <Chip key={m.id} activo={filtros.momento === m.id} onClick={() => alternar("momento", m.id)}>
                {m.label}
              </Chip>
            ))}
          </Grupo>
        </div>

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-aventurea-line pt-4">
          <button
            type="button"
            onClick={onLimpiar}
            className="text-[13.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
          >
            Limpiar todo
          </button>
          <button type="button" onClick={onCerrar} className="btn-naranja presionable">
            Ver {resultados} {resultados === 1 ? "restaurante" : "restaurantes"}
          </button>
        </div>
      </div>
    </div>
  );
}
