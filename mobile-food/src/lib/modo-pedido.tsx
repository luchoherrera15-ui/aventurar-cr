import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * El selector global "Mesa" / "To Go" (0207) — dos botones arriba que
 * pidió el dueño, compartidos entre Inicio, Descubrir, la ficha del
 * restaurante y "Mis reservas/pedidos": elegís el modo una vez y las
 * pantallas de abajo lo respetan, en vez de que cada una tenga su
 * propio interruptor desincronizado.
 */
export type ModoPedido = "mesa" | "togo";

type ModoPedidoState = {
  modo: ModoPedido;
  setModo: (modo: ModoPedido) => void;
};

const ModoPedidoContext = createContext<ModoPedidoState>({
  modo: "mesa",
  setModo: () => {},
});

export function ModoPedidoProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<ModoPedido>("mesa");
  const valor = useMemo(() => ({ modo, setModo }), [modo]);
  return <ModoPedidoContext.Provider value={valor}>{children}</ModoPedidoContext.Provider>;
}

export function useModoPedido() {
  return useContext(ModoPedidoContext);
}
