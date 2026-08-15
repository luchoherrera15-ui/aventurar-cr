"use client";

import { useMemo, useState } from "react";
import { seccionesEnOrden } from "@/lib/catalogo";
import type { ServicioPerfil } from "./perfil-tipos";
import ServiceCategoryTabs, { CATEGORIA_TODOS } from "./service-category-tabs";
import ServiceCard from "./service-card";

/**
 * La sección "Servicios" del perfil: agrupa el catálogo por categoría
 * reusando `seccionesEnOrden` (la misma función pura que ya usa
 * agenda-negocio.tsx hoy — no se reimplementa el agrupamiento) y
 * compone los chips de `ServiceCategoryTabs` arriba con las tarjetas
 * de `ServiceCard` debajo.
 *
 * Mismo `id="servicios"` y `scroll-mt-24` que ya usa agenda-negocio.tsx
 * hoy — `ProfileNavigation` salta a esta sección con ese ancla.
 */
export default function ServicesSection({
  items,
  ordenSecciones = [],
  onReservar,
}: {
  items: ServicioPerfil[];
  /** Orden de secciones guardado por el dueño (0119). Vacío = como
   *  vengan los servicios, el comportamiento de siempre. */
  ordenSecciones?: string[];
  onReservar: (servicioId: string | null, miembroId: string | null) => void;
}) {
  // Mismo criterio que agenda-negocio.tsx: un Map por nombre de grupo
  // (el `null` se pinta como "Servicios"). Si dos grupos comparten
  // nombre, es el mismo comportamiento de hoy — no se cambia acá.
  const grupos = useMemo(() => {
    const mapa = new Map<string, ServicioPerfil[]>(
      seccionesEnOrden(items, ordenSecciones).map((s) => [s.grupo ?? "Servicios", s.items]),
    );
    return [...mapa.entries()].map(([nombre, lista]) => ({ nombre, items: lista }));
  }, [items, ordenSecciones]);

  const categorias = useMemo(() => grupos.map((g) => g.nombre), [grupos]);
  const [activa, setActiva] = useState<string>(CATEGORIA_TODOS);

  const gruposVisibles =
    activa === CATEGORIA_TODOS ? grupos : grupos.filter((g) => g.nombre === activa);

  return (
    <div id="servicios" className="mt-8 scroll-mt-24">
      <h2 className="titulo text-[18px] text-aventurea-navy">
        Servicios
      </h2>

      {items.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-aventurea-line bg-aventurea-surface p-6 text-[13.5px] text-aventurea-ink-soft">
          Este negocio todavía no publicó sus servicios — consultale por el chat.
        </p>
      ) : (
        <>
          <div className="mt-3.5">
            <ServiceCategoryTabs categorias={categorias} activa={activa} onCambiar={setActiva} />
          </div>

          {gruposVisibles.map((g) => (
            <div key={g.nombre} className="mt-5">
              {grupos.length > 1 && (
                <h3 className="mb-2.5 text-[12px] font-extrabold uppercase tracking-wide text-aventurea-navy">
                  {g.nombre}
                </h3>
              )}
              <div className="flex flex-col gap-3">
                {g.items.map((s) => (
                  <ServiceCard key={s.id} servicio={s} onReservar={onReservar} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
