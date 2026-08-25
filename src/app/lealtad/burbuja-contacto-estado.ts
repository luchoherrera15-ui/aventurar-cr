"use client";

/**
 * QUÉ MUESTRA LA BURBUJA DE CONTACTO — compartido con quien la quiera
 * abrir desde afuera (el botón "Solicitar ayuda personalizada" del
 * héroe). Mismo patrón que `src/lib/chat-panel.ts`: sin esto un
 * Context serviría igual, porque los dos SÍ comparten árbol acá, pero
 * replicar el patrón ya probado es más simple que decidir de nuevo.
 *
 * SEGUNDA PASADA: antes era un booleano ("¿está abierta?"). Ahora la
 * burbuja ofrece DOS caminos —"Chatear con un agente" (el bot de
 * Gemini) o "Enviar un correo" (el formulario de siempre)— así que el
 * booleano se quedó corto: hacía falta un tercer estado ("mostrando
 * el selector") entre cerrado y cualquiera de los dos caminos. Un
 * único campo con cuatro valores es más simple de leer que dos
 * booleanos que nunca deberían ser true a la vez.
 */

export type VistaBurbuja = "cerrada" | "selector" | "correo" | "chat";

let vista: VistaBurbuja = "cerrada";
const suscriptores = new Set<() => void>();

function avisar() {
  suscriptores.forEach((f) => f());
}

function ir(nueva: VistaBurbuja) {
  vista = nueva;
  avisar();
}

/** Abre el selector — lo que dispara "Solicitar ayuda personalizada"
 *  y el botón flotante cuando están cerrados. */
export function abrirBurbujaContacto() {
  ir("selector");
}

export function cerrarBurbujaContacto() {
  ir("cerrada");
}

/** El botón flotante: si está cerrada la abre en el selector: si
 *  cualquiera de las dos vistas ya está abierta, la cierra entera. */
export function alternarBurbujaContacto() {
  ir(vista === "cerrada" ? "selector" : "cerrada");
}

export function irACorreoBurbuja() {
  ir("correo");
}

export function irAChatBurbuja() {
  ir("chat");
}

/** Volver al selector desde cualquiera de los dos caminos, sin cerrar
 *  del todo — para quien se arrepiente a mitad de un formulario vacío
 *  o de un chat que recién empezó. */
export function volverAlSelectorBurbuja() {
  ir("selector");
}

export function leerBurbujaContacto(): VistaBurbuja {
  return vista;
}

export function leerBurbujaContactoServidor(): VistaBurbuja {
  return "cerrada";
}

export function suscribirBurbujaContacto(avisar: () => void) {
  suscriptores.add(avisar);
  return () => {
    suscriptores.delete(avisar);
  };
}
