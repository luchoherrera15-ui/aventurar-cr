"use client";

import { formatearCRC } from "@/lib/dinero";
import type { ProductoDeVenta } from "@/lib/lealtad/productos";

/**
 * EL DESPLEGABLE DE LA CAJA (0198).
 *
 * Los DOS caminos de venta —el escáner y la lista de clientes— piden
 * lo mismo: elegir qué se vendió para que el monto se llene solo. Una
 * sola pieza para los dos, porque dos desplegables con las mismas
 * reglas se separan igual que dos derivaciones del mismo color.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA PIEZA NO HACE
 * ------------------------------------------------------------------
 * No decide el monto ni los sellos: avisa QUÉ se eligió y quien la
 * monta rellena el campo de monto, que sigue siendo editable a
 * propósito (una venta puede llevar dos cafés). Los sellos los calcula
 * el SERVIDOR con `sellosPorCompra` leyendo el beneficio de la base —
 * el navegador manda producto y monto, nunca la cantidad de sellos.
 *
 * Si el negocio no tiene productos activos, quien la monta ni la pinta:
 * sin catálogo el mostrador queda EXACTAMENTE como antes de la 0198.
 */
export default function SelectorProducto({
  id,
  productos,
  valor,
  onElegir,
  etiqueta = "Producto",
}: {
  /** Id del <select>, para poder atarle su <label>. */
  id: string;
  /** Solo los ACTIVOS, ya ordenados por el servidor. */
  productos: ProductoDeVenta[];
  /** El producto elegido, o null (venta a mano). */
  valor: string | null;
  onElegir: (producto: ProductoDeVenta | null) => void;
  etiqueta?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft"
      >
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor ?? ""}
        onChange={(e) => {
          const elegido = productos.find((p) => p.id === e.target.value) ?? null;
          onElegir(elegido);
        }}
        className="w-full rounded-[10px] border border-aventurea-line bg-aventurea-cream-2 px-3 py-2.5 text-[13.5px] text-aventurea-ink"
      >
        {/* La primera opción NO es un producto: es seguir cobrando como
            siempre. Va primera porque es lo que ya funcionaba, y quien
            no encuentre su producto en la lista tiene que poder cobrar
            igual con el cliente enfrente. */}
        <option value="">Sin producto — escribo el monto</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} · {formatearCRC(p.precio)}
          </option>
        ))}
      </select>
    </div>
  );
}
