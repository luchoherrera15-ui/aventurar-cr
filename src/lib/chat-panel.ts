"use client";

/**
 * Si el panel de chat flotante está abierto, y cuántos mensajes sin
 * leer tiene — compartido entre el ícono del header (`menu-cuenta.tsx`,
 * dentro de `SiteHeader`, por página) y el panel en sí
 * (`chat-flotante.tsx`, montado una sola vez en el layout raíz). Los
 * dos no comparten árbol de React, así que un Context no alcanzaría —
 * mismo motivo y misma forma que `src/lib/proveedor-actual.ts`.
 */

export type EstadoChatPanel = { abierto: boolean; sinLeer: number };

let estado: EstadoChatPanel = { abierto: false, sinLeer: 0 };
const suscriptores = new Set<() => void>();

function avisar() {
  suscriptores.forEach((f) => f());
}

export function abrirChatPanel() {
  estado = { ...estado, abierto: true };
  avisar();
}

export function cerrarChatPanel() {
  estado = { ...estado, abierto: false };
  avisar();
}

export function alternarChatPanel() {
  estado = { ...estado, abierto: !estado.abierto };
  avisar();
}

export function fijarSinLeerChatPanel(n: number) {
  estado = { ...estado, sinLeer: n };
  avisar();
}

export function leerChatPanel() {
  return estado;
}

/** En el servidor no hay panel abierto ni contador. */
export function leerChatPanelServidor(): EstadoChatPanel {
  return { abierto: false, sinLeer: 0 };
}

export function suscribirChatPanel(avisar: () => void) {
  suscriptores.add(avisar);
  return () => {
    suscriptores.delete(avisar);
  };
}
