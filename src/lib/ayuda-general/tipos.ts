/**
 * TIPOS DE «HABLÁ CON BOOKEA» — soporte general visitante ↔ Bookea (0182).
 *
 * Mismo estilo camelCase que `@/lib/lealtad/ayuda-hilo.ts`: la tabla
 * habla snake_case, estos tipos hablan lo que consume la UI.
 *
 * A PROPÓSITO no incluyen `tokenHash` en ningún lado: ningún `select()`
 * de este módulo (ver `hilo.ts`) lo pide, así que no hay forma de que
 * termine viajando a un componente de cliente por accidente.
 */

export type EstadoAyudaGeneral = "abierta" | "cerrada";

export type MensajeAyudaGeneral = {
  id: string;
  texto: string;
  /** true = lo escribió alguien del equipo de Bookea. */
  deBookea: boolean;
  /** Ya formateada en hora de Costa Rica. */
  fecha: string;
  /** Quien escribió, SI tiene sesión real. null = sin sesión (visitante o, en teoría, nadie). */
  autorId: string | null;
};

export type HiloAyudaGeneral = {
  id: string;
  estado: EstadoAyudaGeneral;
  /** Con quién habla Bookea. Siempre presente — ver 0182: la cabeza del hilo nunca queda sin nombre ni contacto, ni para un visitante logueado (se completa solo desde `perfiles`). */
  nombre: string;
  contacto: string;
  mensajes: MensajeAyudaGeneral[];
};
