"use client";

import { GraficoArea, type PuntoGrafico } from "@/components/food/panel";
import { formatearCRC } from "@/lib/dinero";

/**
 * El gráfico de ventas estimadas, envuelto en un componente cliente
 * chiquito por una razón de frontera, no de diseño: GraficoArea
 * recibe `formatearValor`/`formatearTick` como FUNCIONES, y una
 * función no puede viajar de un Server Component a uno cliente por
 * props. La página (servidor) pasa solo los puntos; el formato de
 * colones vive de este lado de la frontera.
 */

/**
 * ₡ compacto para los ticks del eje Y: el margen izquierdo del
 * gráfico mide 42px y "₡1.200.000" no cabe ahí — "₡1,2 M" sí.
 */
function tickCRC(v: number): string {
  if (v >= 1_000_000)
    return `₡${(v / 1_000_000).toLocaleString("es-CR", { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `₡${Math.round(v / 1_000)}k`;
  return formatearCRC(v);
}

export default function GraficoVentas({
  puntos,
  alto = 220,
}: {
  puntos: PuntoGrafico[];
  alto?: number;
}) {
  return (
    <GraficoArea
      puntos={puntos}
      serie="Ventas estimadas"
      alto={alto}
      formatearValor={formatearCRC}
      formatearTick={tickCRC}
    />
  );
}
