import {
  ACTIVADORES,
  activadorAplicaAlModo,
  CANALES,
  condicionesParaModo,
  ETIQUETA_OP,
  MAX_IMPULSOS_POR_TARJETA,
  TOPE_DIARIO_POR_CLIENTE,
  type GrupoActivador,
  type ParametroActivador,
  type TipoCondicion,
} from "./catalogo";
import { contextoDeEjemplo, variablesParaModo } from "./mensaje";
import type { IdActivador, IdCanal, OpCondicion } from "./tipos";
import { activadorEnVoz, canalEnVoz, type Voz } from "./voz-foorkie";

/**
 * EL CATÁLOGO DE LOS IMPULSOS, EN UNA FORMA QUE SE PUEDE MANDAR POR LA RED.
 *
 * El catálogo de `catalogo.ts` tiene funciones (la etiqueta de una condición depende del tipo de tarjeta,
 * el valor de una variable se calcula con un cliente): sirve para el código, no para un JSON. Quien arma
 * la pantalla desde afuera —el panel de Foorkie— necesita todo ya resuelto para UNA tarjeta: este módulo lo
 * deja listo, sin una sola función, en la voz que le toca y filtrado por el tipo de tarjeta.
 *
 * Puro. Lo usa la ruta `impulsos` de Foorkie (`foorkie-impulsos.ts`).
 */

export type ActivadorDelCatalogo = {
  id: IdActivador;
  etiqueta: string;
  descripcion: string;
  grupo: GrupoActivador;
  /** false = está apagado: se muestra con su `noDisponible` y no se puede elegir. */
  disponible: boolean;
  noDisponible?: string;
  /** Tiene sentido en este tipo de tarjeta. */
  aplica: boolean;
  requiereRecompensa?: boolean;
  parametros?: ParametroActivador[];
  nota?: string;
};

export type CanalDelCatalogo = {
  id: IdCanal;
  etiqueta: string;
  descripcion: string;
  disponible: boolean;
  falta?: string;
  tituloMax: number;
  cuerpoMax: number;
  unaLinea: boolean;
  limites: string[];
};

export type CondicionDelCatalogo = {
  id: string;
  /** Ya resuelta con el tipo de tarjeta («Sellos actuales» / «Puntos disponibles» / «Saldo de cashback»). */
  etiqueta: string;
  ayuda: string;
  tipo: TipoCondicion;
  ops: OpCondicion[];
  min?: number;
  max?: number;
  opciones?: { valor: string; etiqueta: string }[];
};

export type VariableDelCatalogo = {
  id: string;
  etiqueta: string;
  descripcion: string;
  requiereRecompensa?: boolean;
  /** Lo que da con un cliente de ejemplo (el que usa la vista previa). */
  ejemplo: string | null;
};

export type TopesDelCatalogo = {
  maxImpulsosPorTarjeta: number;
  topeDiarioPorCliente: number;
  maxCondiciones: number;
  nombreMax: number;
  descripcionMax: number;
  tituloMax: number;
  cuerpoMax: number;
};

export type Catalogo = {
  /** TODOS (también los no disponibles). */
  activadores: ActivadorDelCatalogo[];
  canales: CanalDelCatalogo[];
  /** Solo las que aplican al tipo de tarjeta. */
  condiciones: CondicionDelCatalogo[];
  etiquetasOp: Record<OpCondicion, string>;
  /** Las del tipo de tarjeta. */
  variables: VariableDelCatalogo[];
  topes: TopesDelCatalogo;
};

/**
 * Los topes que fija la validación (`validacion.ts`) y el servicio. Si alguno cambia allá, la prueba
 * `catalogo-vista.test.ts` falla hasta que se cambie acá: la pantalla de afuera no puede prometer otro límite.
 */
export const TOPES: TopesDelCatalogo = {
  maxImpulsosPorTarjeta: MAX_IMPULSOS_POR_TARJETA,
  topeDiarioPorCliente: TOPE_DIARIO_POR_CLIENTE,
  maxCondiciones: 12,
  nombreMax: 80,
  descripcionMax: 240,
  tituloMax: 60,
  cuerpoMax: 600,
};

export function construirCatalogo(
  modo: string,
  { nombreNegocio, nombrePrograma }: { nombreNegocio: string; nombrePrograma: string },
  voz: Voz = "bookea",
): Catalogo {
  const activadores: ActivadorDelCatalogo[] = ACTIVADORES.map((a) => {
    const def = activadorEnVoz(a, voz);
    return {
      id: def.id,
      etiqueta: def.etiqueta,
      descripcion: def.descripcion,
      grupo: def.grupo,
      disponible: def.disponible,
      ...(def.noDisponible !== undefined ? { noDisponible: def.noDisponible } : {}),
      aplica: activadorAplicaAlModo(def, modo),
      ...(def.requiereRecompensa ? { requiereRecompensa: true } : {}),
      ...(def.parametros ? { parametros: def.parametros.map((p) => ({ ...p })) } : {}),
      ...(def.nota !== undefined ? { nota: def.nota } : {}),
    };
  });

  const canales: CanalDelCatalogo[] = CANALES.map((c) => {
    const def = canalEnVoz(c, voz);
    return {
      id: def.id,
      etiqueta: def.etiqueta,
      descripcion: def.descripcion,
      disponible: def.disponible,
      ...(def.falta !== undefined ? { falta: def.falta } : {}),
      tituloMax: def.tituloMax,
      cuerpoMax: def.cuerpoMax,
      unaLinea: def.unaLinea,
      limites: [...def.limites],
    };
  });

  const condiciones: CondicionDelCatalogo[] = condicionesParaModo(modo).map((c) => ({
    id: c.id,
    etiqueta: c.etiqueta(modo),
    ayuda: c.ayuda,
    tipo: c.tipo,
    ops: [...c.ops],
    ...(c.min !== undefined ? { min: c.min } : {}),
    ...(c.max !== undefined ? { max: c.max } : {}),
    ...(c.opciones ? { opciones: c.opciones.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta })) } : {}),
  }));

  // Un nombre vacío daría un ejemplo sin nombre del negocio: se usa el de siempre («Tu negocio»).
  const ejemplo = contextoDeEjemplo(modo, nombreNegocio.trim() || undefined, nombrePrograma.trim() || undefined);
  const variables: VariableDelCatalogo[] = variablesParaModo(modo).map((v) => ({
    id: v.id,
    etiqueta: v.etiqueta,
    descripcion: v.descripcion,
    ...(v.requiereRecompensa ? { requiereRecompensa: true } : {}),
    ejemplo: v.valor(ejemplo),
  }));

  return { activadores, canales, condiciones, etiquetasOp: { ...ETIQUETA_OP }, variables, topes: { ...TOPES } };
}
