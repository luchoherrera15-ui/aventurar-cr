/**
 * Contrato compartido de categorías por vertical.
 *
 * La tabla `ranchos` es una sola pero reparte sus categorías entre 4
 * verticales (`vertical`): eventos, citas, hospedajes y restaurantes.
 * Cada vertical trae su propia lista en su carpeta (mi-negocio/types.tsx
 * para eventos, citas/tipos.ts para citas...) — este archivo es el punto
 * único donde `editar-form.tsx`, `actions.ts` y quien necesite validar o
 * mostrar una categoría según el vertical real del negocio, sin acoplarse
 * a la lista de Eventos como si fuera la de toda la plataforma.
 *
 * Eventos es el fallback seguro: un vertical desconocido (dato viejo,
 * typo, o una vertical nueva que todavía no tiene su propia lista acá)
 * cae en la taxonomía de Eventos en vez de romper.
 */

import {
  CATEGORIAS,
  CATEGORIA_LABEL,
  CATEGORIA_ICONO,
  SUBCATEGORIAS,
  CATEGORIA_GRADIENTE,
  type Categoria,
} from "../app/mi-negocio/types";
import { CATEGORIAS_CITAS, CATEGORIA_CITA_LABEL, type CategoriaCita } from "../app/citas/tipos";
import { CATEGORIA_CITA_ICONO } from "../app/citas/iconos";
import { SUBCATEGORIAS_CITAS } from "../app/citas/subcategorias";

export type VerticalNegocio = "eventos" | "citas" | "hospedajes" | "restaurantes";

type OpcionCategoria = { id: string; label: string };

const OPCIONES_EVENTOS: OpcionCategoria[] = CATEGORIAS.map((c) => ({
  id: c,
  label: CATEGORIA_LABEL[c],
}));

const OPCIONES_CITAS: OpcionCategoria[] = CATEGORIAS_CITAS.map((c) => ({
  id: c,
  label: CATEGORIA_CITA_LABEL[c],
}));

// src/app/booking/tipos.ts (Hospedajes) y src/app/restaurantes/tipos.ts
// (Restaurantes) sí exportan su propia lista de categorías — se cablean
// directo, sin pasar por el fallback de Eventos.
import { CATEGORIAS_HOSPEDAJES, CATEGORIA_HOSPEDAJE_LABEL } from "../app/booking/tipos";
import {
  CATEGORIAS_RESTAURANTES,
  CATEGORIA_RESTAURANTE_LABEL,
} from "../app/restaurantes/tipos";

const OPCIONES_HOSPEDAJES: OpcionCategoria[] = CATEGORIAS_HOSPEDAJES.map((c) => ({
  id: c,
  label: CATEGORIA_HOSPEDAJE_LABEL[c],
}));

const OPCIONES_RESTAURANTES: OpcionCategoria[] = CATEGORIAS_RESTAURANTES.map((c) => ({
  id: c,
  label: CATEGORIA_RESTAURANTE_LABEL[c],
}));

/**
 * Lista de {id, label} válida para el <select> de categoría y para
 * validar en el server action, según el vertical del negocio.
 */
export function categoriaOptions(vertical: string): OpcionCategoria[] {
  switch (vertical) {
    case "citas":
      return OPCIONES_CITAS;
    case "hospedajes":
      return OPCIONES_HOSPEDAJES;
    case "restaurantes":
      return OPCIONES_RESTAURANTES;
    case "eventos":
    default:
      return OPCIONES_EVENTOS;
  }
}

/**
 * Label legible de una categoría, dado su vertical (fallback razonable
 * si no matchea nada conocido: se muestra el valor crudo).
 */
export function categoriaLabel(vertical: string, categoria: string): string {
  const opcion = categoriaOptions(vertical).find((o) => o.id === categoria);
  return opcion?.label ?? categoria;
}

/** ¿Es válida esta categoria para este vertical? (para validar en el server action) */
export function esCategoriaValida(vertical: string, categoria: string): boolean {
  return categoriaOptions(vertical).some((o) => o.id === categoria);
}

/**
 * Un negocio de Eventos "lugares" o CUALQUIER negocio que no sea Eventos
 * (Citas/Hospedajes/Restaurantes) tiene ubicación física fija: se le
 * pide dirección exacta y ubicación en el mapa, y NO se le pide
 * "cobertura y logística de traslado" (eso es solo para el proveedor
 * móvil de Eventos: alimentacion/animacion/organizacion/decoracion/otros).
 */
export function esUbicacionFija(vertical: string, categoria: string): boolean {
  if (vertical !== "eventos") return true;
  return categoria === "lugares";
}

/**
 * ¿Esta vertical tiene segundo nivel (columna `subcategoria`)?
 *
 * Eventos desde siempre. Citas desde el 28 ago 2026: la 0188 ya
 * autorizaba sus 26 valores en el CHECK, pero esta función decía que
 * no — así que los tres formularios forzaban null al guardar y la
 * grilla de la portada (Peinados, Masajes…) filtraba contra una
 * columna vacía PARA SIEMPRE. Lo cazó la verificación del 28 ago: el
 * dato nacía muerto aunque todo el camino del filtro funcionara.
 *
 * ⚠️ La obligatoriedad es POR VERTICAL, no de esta función: en Eventos
 * el segundo nivel es obligatorio en los formularios (la vitrina se
 * navega por él); en Citas es OPCIONAL — «Barbería» ya es específico, y
 * obligar a elegir entre «corte» y «afeitado» a quien hace los dos
 * sería mentir. Quien valide, que valide con `subcategoriasDe`.
 */
export function usaSubcategoria(vertical: string): boolean {
  return vertical === "eventos" || vertical === "citas";
}

/**
 * Las opciones del segundo nivel de una categoría, según la vertical
 * REAL del negocio. Punto único: antes cada formulario indexaba
 * `SUBCATEGORIAS` (que solo tiene las claves de Eventos) y el día que
 * `usaSubcategoria` abriera otra vertical, eso era `undefined.map` —
 * el propio comentario de editar-form.tsx lo venía advirtiendo.
 */
export function subcategoriasDe(
  vertical: string,
  categoria: string,
): { id: string; label: string }[] {
  if (vertical === "eventos") {
    return SUBCATEGORIAS[categoria as Categoria] ?? [];
  }
  if (vertical === "citas") {
    return SUBCATEGORIAS_CITAS[categoria as CategoriaCita] ?? [];
  }
  return [];
}

/**
 * Fondo para cuando el negocio de Citas todavía no subió su foto
 * principal — mismo estilo (linear-gradient a 160deg, 3 paradas) que
 * CATEGORIA_GRADIENTE usa para Eventos, con una paleta propia por
 * rubro.
 */
const CATEGORIA_CITA_GRADIENTE: Record<CategoriaCita, string> = {
  belleza: "linear-gradient(160deg, #2b1420 0%, #40202f 45%, #1c1116 100%)",
  barberia: "linear-gradient(160deg, #141b26 0%, #1f2c3d 45%, #12161c 100%)",
  unas: "linear-gradient(160deg, #2b1024 0%, #421a38 45%, #180a16 100%)",
  spa: "linear-gradient(160deg, #0f211c 0%, #163a2e 45%, #0c1714 100%)",
  consultorio: "linear-gradient(160deg, #0e1c26 0%, #15303d 45%, #0a141a 100%)",
  otros: "linear-gradient(160deg, #1a1a1a 0%, #2a2a2a 45%, #141414 100%)",
};

/**
 * Ícono de una categoría según el vertical del negocio: Eventos usa
 * exactamente CATEGORIA_ICONO (cero cambios visuales) y Citas su
 * propio set (src/app/citas/iconos.tsx). Hospedajes/Restaurantes y
 * cualquier categoría que no matchee caen en el ícono "otros" de
 * Eventos — mismo fallback que ya usa categoriaOptions.
 */
export function categoriaIcono(vertical: string, categoria: string): React.ReactNode {
  if (vertical === "citas") {
    const cat = (CATEGORIAS_CITAS as readonly string[]).includes(categoria)
      ? (categoria as CategoriaCita)
      : "otros";
    return CATEGORIA_CITA_ICONO[cat];
  }
  const cat = (CATEGORIAS as readonly string[]).includes(categoria)
    ? (categoria as Categoria)
    : "otros";
  return CATEGORIA_ICONO[cat];
}

/**
 * Gradiente de respaldo (sin foto) de una categoría según el vertical
 * del negocio: mismo criterio de fallback que categoriaIcono.
 */
export function categoriaGradiente(vertical: string, categoria: string): string {
  if (vertical === "citas") {
    const cat = (CATEGORIAS_CITAS as readonly string[]).includes(categoria)
      ? (categoria as CategoriaCita)
      : "otros";
    return CATEGORIA_CITA_GRADIENTE[cat];
  }
  const cat = (CATEGORIAS as readonly string[]).includes(categoria)
    ? (categoria as Categoria)
    : "otros";
  return CATEGORIA_GRADIENTE[cat];
}
