import { FUENTE } from "./temas";
import { ESCALA_MENU, type DefEstiloMenu, type Disposicion, type PapelMenu, type TamanoMenu } from "./menu-estilos";

/**
 * DE LA FICHA DEL DISEÑO A LO QUE EL RENDERIZADOR NECESITA.
 *
 * Vive en su propio archivo por una razón concreta: `temas.ts` importa
 * el estilo base de `menu-estilos.ts`, así que si `menu-estilos.ts`
 * importara de vuelta la tabla de fuentes se armaría un ciclo — y los
 * ciclos de módulos no fallan en el build, fallan en el navegador con
 * «Cannot access 'ESTILO_MENU_BASE' before initialization». Este módulo
 * importa a los dos y nadie lo importa a él.
 *
 * Es puro y no lleva "use client": lo usan la PÁGINA del menú (servidor)
 * y el componente del carrito (cliente).
 */

export type PintaMenu = {
  paleta: PapelMenu;
  /** La familia CSS ya armada, lista para `fontFamily`. */
  familia: string;
  /** Cuán ancha va la caja del catálogo: las grillas piden más aire. */
  ancho: string;
  /** Multiplicador de la letra (9 sep 2026). 1 = tamaño normal. */
  escala: number;
  def: DefEstiloMenu;
};

/**
 * El papel del diseño gana sobre el tema de la página; si el diseño no
 * trae papel propio (`papel: null`), el catálogo se ve con los colores
 * que el negocio ya eligió para su link hub.
 *
 * Vive en este módulo —y no junto a los componentes— porque la PÁGINA
 * del menú es un Server Component y no puede importar nada de un
 * archivo "use client".
 */
export function pintaDeEstilo(def: DefEstiloMenu, tema: PapelMenu, tamano: TamanoMenu = "normal"): PintaMenu {
  const f = FUENTE[def.fuente];
  const anchos: Record<Disposicion, string> = {
    guia: "540px",
    columnas: "760px",
    lista: "560px",
    tarjetas: "620px",
    cuadricula: def.columnas >= 3 ? "980px" : "820px",
    revista: "680px",
  };
  return {
    paleta: def.papel ?? tema,
    familia: `var(${f.cssVar}), ${f.respaldo}`,
    ancho: anchos[def.disposicion],
    escala: ESCALA_MENU[tamano],
    def,
  };
}
