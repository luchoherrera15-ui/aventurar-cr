"use client";

/**
 * Si el panel de chat flotante está abierto, y cuántos mensajes sin
 * leer tiene — compartido entre el ícono del header (`menu-cuenta.tsx`,
 * dentro de `SiteHeader`, por página) y el panel en sí
 * (`chat-flotante.tsx`, montado una sola vez en el layout raíz). Los
 * dos no comparten árbol de React, así que un Context no alcanzaría —
 * mismo motivo y misma forma que `src/lib/proveedor-actual.ts`.
 */

/** El negocio con el que abrir el hilo directo (lo pide un botón
 *  "Consultar"). */
export type NegocioPedido = { ranchoId: string; nombre: string };

export type EstadoChatPanel = {
  abierto: boolean;
  sinLeer: number;
  /** Negocio pedido por el último `abrirChatConNegocio`, si lo hubo. */
  negocio: NegocioPedido | null;
  /** Sube en cada pedido: deja reabrir el hilo aunque el panel YA
   *  estuviera abierto (si no, el efecto que carga el contenido no se
   *  entera porque `abierto` no cambió de valor). */
  pedido: number;
};

let estado: EstadoChatPanel = { abierto: false, sinLeer: 0, negocio: null, pedido: 0 };
const suscriptores = new Set<() => void>();

function avisar() {
  suscriptores.forEach((f) => f());
}

export function abrirChatPanel() {
  estado = { ...estado, abierto: true, negocio: null };
  avisar();
}

/**
 * Abre el panel derecho en el hilo con ESE negocio — lo que usan los
 * botones "Consultar" / "Escribinos" de las páginas públicas, para no
 * mandar a nadie a una pantalla de chat aparte.
 */
export function abrirChatConNegocio(negocio: NegocioPedido) {
  estado = { ...estado, abierto: true, negocio, pedido: estado.pedido + 1 };
  avisar();
}

export function cerrarChatPanel() {
  estado = { ...estado, abierto: false, negocio: null };
  avisar();
}

export function alternarChatPanel() {
  estado = { ...estado, abierto: !estado.abierto, negocio: null };
  avisar();
}

export function fijarSinLeerChatPanel(n: number) {
  estado = { ...estado, sinLeer: n };
  avisar();
}

export function leerChatPanel() {
  return estado;
}

/** En el servidor no hay panel abierto ni contador. Referencia estable:
 *  useSyncExternalStore compara por identidad y un objeto nuevo en cada
 *  llamada lo haría loopear. */
const ESTADO_SERVIDOR: EstadoChatPanel = {
  abierto: false,
  sinLeer: 0,
  negocio: null,
  pedido: 0,
};

export function leerChatPanelServidor(): EstadoChatPanel {
  return ESTADO_SERVIDOR;
}

export function suscribirChatPanel(avisar: () => void) {
  suscriptores.add(avisar);
  return () => {
    suscriptores.delete(avisar);
  };
}
