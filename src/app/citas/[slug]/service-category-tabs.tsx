"use client";

/** La opción que muestra todas las categorías juntas, sin filtrar. */
export const CATEGORIA_TODOS = "Todos";

/**
 * Chips horizontales de categoría, desplazables sin scrollbar visible
 * en mobile (mismo patrón [scrollbar-width:none] que ya usa la tira de
 * fechas de ReservarCitaModal). Elegir un chip FILTRA la grilla de
 * servicios — no hace scroll — porque `ServicesSection` ya necesita el
 * estado de "categoría activa" para decidir qué grupos pintar; filtrar
 * reusa ese mismo estado en vez de sumar un segundo mecanismo de
 * scroll + IntersectionObserver que competiría con el de
 * `ProfileNavigation` por los mismos ids de sección.
 *
 * Las categorías son las secciones reales del catálogo (`grupo` de
 * cada servicio, ej. "Cabello", "Color"): este negocio no tiene un
 * concepto de "Popular" en la base, así que ese chip de ejemplo no se
 * inventa acá.
 */
export default function ServiceCategoryTabs({
  categorias,
  activa,
  onCambiar,
}: {
  /** Nombres reales de categoría del negocio, sin "Todos". */
  categorias: string[];
  activa: string;
  onCambiar: (categoria: string) => void;
}) {
  // Con una sola categoría no hay nada que filtrar — mismo criterio
  // que el título de grupo en la grilla (grupos.length > 1).
  if (categorias.length < 2) return null;
  const opciones = [CATEGORIA_TODOS, ...categorias];

  return (
    <div
      role="tablist"
      aria-label="Categorías de servicios"
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {opciones.map((c) => (
        <button
          key={c}
          type="button"
          role="tab"
          aria-selected={activa === c}
          onClick={() => onCambiar(c)}
          className={`shrink-0 whitespace-nowrap rounded-xl border px-4 py-2 text-[13px] font-bold transition-colors ${
            activa === c
              ? "border-aventurea-navy bg-aventurea-navy text-white"
              : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
