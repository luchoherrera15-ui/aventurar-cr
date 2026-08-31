import datos from "./demos-wallet.json";
import type { TipoTarjeta } from "./tipos-tarjeta";

/**
 * LOS OCHO NEGOCIOS DE DEMOSTRACIÓN, PARA LA LANDING.
 *
 * La tabla vive en `demos-wallet.json` porque el sembrador
 * (`scripts/seed-demos-wallet.mjs`) también la lee, y un script `.mjs`
 * no puede importar un `.ts`. Acá solo se le pone tipo y se expone el
 * acceso por tipo de tarjeta.
 *
 * ------------------------------------------------------------------
 * QUÉ PASA SI UN NEGOCIO NO ESTÁ SEMBRADO
 * ------------------------------------------------------------------
 * `demoDe()` devuelve el registro igual: es una tabla estática, no una
 * consulta. Quien lo use tiene que aguantar que `/tarjeta/<slug>`
 * conteste «no encontramos esa tarjeta» hasta que el sembrador corra.
 * Es a propósito — la alternativa era consultar la base en cada render
 * de la landing para decidir si dibujar un botón.
 */

export type DemoWallet = {
  tipo: TipoTarjeta;
  nombre: string;
  slug: string;
  rubro: string;
  /** El fondo del pase. */
  color: string;
  /** El color de los sellos y los datos destacados. */
  acento: string;
  /** Qué se lleva el cliente, en sus palabras. */
  regalia: string;
  /** La configuración del beneficio, con la forma de `ConfigBeneficio`. */
  config: Record<string, unknown>;
};

export const DEMOS_WALLET = (datos.negocios as DemoWallet[]).filter(Boolean);

const POR_TIPO = new Map<string, DemoWallet>(DEMOS_WALLET.map((d) => [d.tipo, d]));

/** La demo de un tipo de tarjeta, o null si ese tipo no tiene una. */
export function demoDe(tipo: TipoTarjeta): DemoWallet | null {
  return POR_TIPO.get(tipo) ?? null;
}

/** A dónde manda el botón de Wallet: el alta real del cliente. */
export function rutaDeAfiliacion(demo: DemoWallet): string {
  return `/tarjeta/${demo.slug}`;
}
