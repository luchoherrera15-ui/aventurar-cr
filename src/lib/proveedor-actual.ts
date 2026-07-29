"use client";

/**
 * Qué proveedor está viendo la persona en este momento. Lo escribe la
 * página del portal (montando <ProveedorActual/>) y lo lee la burbuja
 * de chat flotante para ofrecer "chateá con este proveedor" en vez de
 * mandar a la bandeja general.
 *
 * Es un store mínimo con la forma que pide useSyncExternalStore — sin
 * contexto de React a propósito: la burbuja vive en el layout raíz,
 * fuera del árbol de la página, y un Provider de contexto no la
 * alcanzaría.
 */

export type ProveedorEnPantalla = {
  ranchoId: string;
  nombre: string;
};

let actual: ProveedorEnPantalla | null = null;
const suscriptores = new Set<() => void>();

export function fijarProveedorActual(proveedor: ProveedorEnPantalla | null) {
  actual = proveedor;
  suscriptores.forEach((avisar) => avisar());
}

export function leerProveedorActual() {
  return actual;
}

/** En el servidor no hay "proveedor en pantalla". */
export function leerProveedorActualServidor() {
  return null;
}

export function suscribirProveedorActual(avisar: () => void) {
  suscriptores.add(avisar);
  return () => {
    suscriptores.delete(avisar);
  };
}
