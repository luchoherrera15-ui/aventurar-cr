import type { ReactNode } from "react";
import {
  EYEBROW,
  PADDING_CARD,
  RADIO_CARD,
  SUPERFICIE_PANEL,
  TITULO_CARD,
} from "@/components/panel/sistema";
import { NotaDemo } from "./notas";

/**
 * LA TARJETA DEL PANEL DE FOOD. Misma anatomía que el resto de paneles
 * del sitio (superficie blanca + borde + sombra tenue del sistema de
 * `@/components/panel/sistema`) con el encabezado ya resuelto: kicker
 * naranja opcional, título, acción a la derecha y la marquita "Datos
 * de ejemplo" cuando el contenido viene de la utilería de demo.
 *
 * Server-safe a propósito (sin "use client"): la mayoría de las
 * pantallas del panel son Server Components y solo las piezas
 * interactivas (gráficos, KPIs animados) cruzan la frontera.
 */
export function TarjetaPanel({
  kicker,
  titulo,
  accion,
  notaDemo = false,
  children,
  className = "",
}: {
  /** Rótulo chiquito arriba del título ("HOY", "RENDIMIENTO"...). */
  kicker?: string;
  titulo?: string;
  /** Lo que va a la derecha del encabezado (un link, un botón, tabs). */
  accion?: ReactNode;
  /** true = el contenido es utilería de demo y se marca como tal. */
  notaDemo?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const tieneEncabezado = kicker || titulo || accion || notaDemo;
  return (
    <section className={`${SUPERFICIE_PANEL} ${RADIO_CARD} ${PADDING_CARD} ${className}`}>
      {tieneEncabezado && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0">
            {kicker && <p className={EYEBROW}>{kicker}</p>}
            {titulo && <h2 className={`${TITULO_CARD} ${kicker ? "mt-0.5" : ""}`}>{titulo}</h2>}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {notaDemo && <NotaDemo />}
            {accion}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
