/**
 * LOS TIPOS QUE SALEN DEL SERVICIO DE IMPULSOS hacia quien los dibuja: la pantalla del panel de Bookea y
 * las rutas que le hablan a Foorkie. Solo tipos, sin imports de servidor: los usa también el navegador.
 *
 * Los de la pantalla (`ContextoDeImpulsos`, `DatosDeImpulsos`, `ResultadoAccion`) viven en
 * `impulsos-vista.ts`, que re-exporta estos para que la pantalla importe todo de un solo lugar.
 */

import type { EstadoImpulso, EstadoTarea, Impulso } from "./tipos";

export type ConteoDeTareas = Record<EstadoTarea, number>;

export type ImpulsoVista = Impulso & {
  conteo: ConteoDeTareas;
  /** ISO de la última vez que un mensaje de este impulso salió. */
  ultimoEnvio: string | null;
};

export type PlantillaVista = {
  id: string;
  nombre: string;
  resumen: string;
  disponible: boolean;
  motivo?: string;
};

export type FiltrosHistorial = {
  impulsoId?: string | null;
  /** Un estado de tarea, o "todos". */
  estado?: EstadoTarea | "todos";
  pagina?: number;
};

export type FilaHistorial = {
  id: string;
  impulsoId: string;
  impulsoNombre: string;
  cliente: string;
  canal: string;
  estado: EstadoTarea;
  ejecutarEn: string;
  enviadaEn: string | null;
  intentos: number;
  motivo: string | null;
  motivoTexto: string;
  detalle: string | null;
  titulo: string | null;
  cuerpo: string | null;
  /** Se puede reintentar a mano. */
  reintentable: boolean;
  /** Reintentar puede duplicar un mensaje: hay que avisarlo y pedir confirmación. */
  reintentoConRiesgo: boolean;
};

export type PaginaDeHistorial = {
  filas: FilaHistorial[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type CambioDeEstado = Extract<EstadoImpulso, "activo" | "pausado" | "archivado" | "borrador">;
