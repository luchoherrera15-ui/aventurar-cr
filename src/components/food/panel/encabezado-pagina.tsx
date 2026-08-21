import type { ReactNode } from "react";
import { BAJADA_PANTALLA, TITULO_PANTALLA } from "@/components/panel/sistema";

/**
 * El encabezado estándar de cada pantalla del panel de FOOD: título,
 * bajada opcional y acciones a la derecha. Existe para que Dashboard,
 * Reservas, Clientes, Rendimiento… abran todas igual y nadie re-invente
 * los tamaños (salen de `@/components/panel/sistema`). Server-safe.
 */
export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  className = "",
}: {
  titulo: string;
  descripcion?: string;
  /** Botones o filtros propios de la pantalla, alineados a la derecha. */
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="min-w-0">
        <h1 className={TITULO_PANTALLA}>{titulo}</h1>
        {descripcion && <p className={`mt-1 ${BAJADA_PANTALLA}`}>{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </div>
  );
}
