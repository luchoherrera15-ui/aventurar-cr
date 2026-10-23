/**
 * LOS TIPOS QUE VIAJAN ENTRE EL SERVIDOR Y LA PANTALLA DE IMPULSOS.
 *
 * Sin imports de servidor a propósito: los usa también el navegador. Las acciones
 * (`impulsos-actions.ts`) los arman; la pantalla (`impulsos-panel.tsx`) los dibuja.
 *
 * Los que no son propios de la pantalla (el impulso con su conteo, el historial, las plantillas) viven en
 * `@/lib/lealtad/impulsos/vista`, porque también los usan las rutas que le hablan a Foorkie; se re-exportan
 * acá para que la pantalla siga importando todo de este archivo.
 */

import type { EntradaImpulso } from "@/lib/lealtad/impulsos/tipos";
import type { ImpulsoVista, PlantillaVista } from "@/lib/lealtad/impulsos/vista";

export type {
  CambioDeEstado,
  ConteoDeTareas,
  FilaHistorial,
  FiltrosHistorial,
  ImpulsoVista,
  PaginaDeHistorial,
  PlantillaVista,
} from "@/lib/lealtad/impulsos/vista";

export type ContextoDeImpulsos = {
  programaId: string;
  nombrePrograma: string;
  nombreNegocio: string;
  modo: string;
  zona: string;
  /** AAAA-MM-DD de hoy en la zona del negocio. */
  hoy: string;
  esFoorkie: boolean;
  tieneRecompensa: boolean;
  recompensa: string | null;
  meta: number | null;
  /** El proveedor de correo está configurado en el servidor. */
  correoConfigurado: boolean;
  /** La tarjeta puede acumular y canjear ahora. Si no, los impulsos no salen. */
  tarjetaOpera: boolean;
};

export type DatosDeImpulsos =
  | { disponible: false; motivo: string; migracionFalta?: boolean }
  | {
      disponible: true;
      contexto: ContextoDeImpulsos;
      impulsos: ImpulsoVista[];
      plantillas: PlantillaVista[];
    };

export type ResultadoAccion<T = null> =
  | { ok: true; datos: T }
  | { ok: false; motivo: string; problemas?: { campo: string; mensaje: string }[] };

export type { EntradaImpulso };
