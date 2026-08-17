import {
  CATEGORIAS,
  CATEGORIA_DE_SUBCATEGORIA,
  CATEGORIA_LABEL,
  SUBCATEGORIAS,
  SUBCATEGORIA_LABEL,
  normalizarCategoria,
  type Rancho,
} from "@/app/mi-negocio/types";
import {
  CATEGORIAS_CITAS,
  CATEGORIA_CITA_LABEL,
  normalizarCategoriaCita,
} from "@/app/citas/tipos";
import { categoriaOptions } from "@/lib/categorias-vertical";

/**
 * ============================================================
 * EL REPARTO POR RUBRO DE UNA LISTA DE NEGOCIOS
 * ============================================================
 *
 * Una función pura que agarra los negocios aprobados de una vertical y
 * decide en qué filas se muestran: «Salones de belleza», «Ranchos para
 * fiestas», «Más en Eventos»… La usan el directorio de Citas
 * (src/app/citas/page.tsx) y la portada, que tienen que estar de
 * acuerdo sobre cómo se llama cada fila y cuántas tarjetas hacen falta
 * para abrirla.
 *
 * ⚠️ MÓDULO NEUTRO. Sin `"use client"`, sin `next/headers`, sin JSX y
 * sin Supabase: lo importan páginas de servidor y podría importarlo un
 * componente de cliente. Nada de lo que se agregue acá puede tocar la
 * red ni la fecha del sistema — de eso depende que se pueda probar
 * entero con filas de mentira (ver carriles-home.test.ts).
 *
 * ── LA REGLA QUE ORDENA TODO ─────────────────────────────────────
 * Con el directorio todavía chico, una fila que se pinta «como sea»
 * queda peor que una fila ausente: un carril con una sola tarjeta grita
 * que no hay nada. De ahí los dos umbrales:
 *
 *   · MIN_CARRIL       — cuántas tarjetas necesita una fila para existir.
 *   · MIN_PARA_CARRILES— cuántas filas necesita la pantalla para que el
 *                        formato de carriles tenga sentido. Con una sola
 *                        fila, mejor una grilla quieta.
 *
 * ── Y LA REGLA QUE LA COMPENSA ───────────────────────────────────
 * Ningún negocio publicado puede quedar invisible por no llegar al
 * mínimo de su rubro: todo lo que sobra se junta en el carril de cierre
 * «Más en …». La única poda es `TOPE_CARRIL`, y lo que corta sigue a un
 * clic detrás del «Ver todo» de esa misma fila.
 */

/** El mínimo para que una fila se vea deliberada y no vacía. */
export const MIN_CARRIL = 3;

/**
 * Cuántas filas hacen falta para que la pantalla se arme con carriles.
 * Con una sola, la lista se lee como «esto es todo el catálogo» y queda
 * mejor una grilla centrada (el nivel B).
 */
export const MIN_PARA_CARRILES = 2;

/**
 * Tope de tarjetas por fila. Un riel horizontal más largo que esto no
 * lo desliza nadie, y cada tarjeta es una foto más que bajar. Lo que se
 * corta no desaparece del sitio: el «Ver todo» de la fila lleva al
 * directorio filtrado por ese mismo rubro.
 */
export const TOPE_CARRIL = 12;

/**
 * Tope de filas en pantalla. El carril de cierre CUENTA para el tope:
 * si las filas candidatas se pasan, las últimas no se evaporan — caen
 * dentro de «Más en …», que ocupa el último lugar.
 */
export const TOPE_CARRILES = 6;

/**
 * Títulos «vendedores» de las filas de Citas.
 *
 * Se escribieron para el directorio de Citas y la portada arma sus
 * carriles con los MISMOS: dos copias del mapa son dos verdades el día
 * que alguien renombre una fila. El chip de filtro sigue usando el
 * label corto (`CATEGORIA_CITA_LABEL`) — «Belleza» adentro de un chip,
 * «Salones de belleza» como encabezado de una fila.
 */
export const TITULO_FILA: Record<string, string> = {
  belleza: "Salones de belleza",
  barberia: "Barberías",
  unas: "Uñas",
  spa: "Spa y masajes",
  consultorio: "Consultorios médicos",
  otros: "Otros servicios",
};

/** Por qué eje se abrió la fila. */
export type EjeCarril = "categoria" | "subcategoria" | "resto";

export type Carril = {
  /** Estable y única dentro del panel: sirve de `key` en React. */
  clave: string;
  eje: EjeCarril;
  titulo: string;
  items: Rancho[];
  /** El directorio ya filtrado por ese rubro. */
  verTodoHref: string;
};

export type PanelCarriles = {
  /**
   * A · hay carriles.
   * B · hay negocios pero no alcanzan para carriles → grilla quieta.
   * C · no hay nada de esta vertical.
   */
  nivel: "A" | "B" | "C";
  carriles: Carril[];
  /** Los negocios del nivel B. Vacío en A y en C. */
  sueltos: Rancho[];
};

/** El directorio de cada vertical. */
const DIRECTORIO: Record<string, string> = {
  eventos: "/eventos",
  citas: "/citas",
  restaurantes: "/restaurantes",
  hospedajes: "/hospedajes",
};

/** Cómo se nombra la vertical dentro de «Más en …». */
const NOMBRE_VERTICAL: Record<string, string> = {
  eventos: "Eventos",
  citas: "Citas",
  restaurantes: "Restaurantes",
  hospedajes: "Hospedajes",
};

/**
 * La vertical de una fila, con el default de siempre.
 *
 * Está escrito así —y no `r.vertical ?? "eventos"`— porque el tipo
 * `Rancho` declara la columna sin "restaurantes", que llegó después:
 * comparar contra ese valor sería un error de compilación aunque en la
 * base exista y llegue en la fila.
 */
function verticalDe(rancho: Rancho): string {
  return (rancho as { vertical?: string }).vertical ?? "eventos";
}

/** El orden oficial de las categorías de una vertical. */
function ordenCategorias(vertical: string): readonly string[] {
  if (vertical === "citas") return CATEGORIAS_CITAS;
  if (vertical === "eventos") return CATEGORIAS;
  return categoriaOptions(vertical).map((o) => o.id);
}

/**
 * La categoría con la que se agrupa una fila cruda. Es la MISMA
 * normalización que aplica cada directorio: si acá cayera distinto, el
 * «Ver todo» de la fila llevaría a un filtro que no devuelve a esos
 * negocios.
 */
function normalizarDe(vertical: string, categoria: string): string {
  if (vertical === "citas") return normalizarCategoriaCita(categoria);
  if (vertical === "eventos") return normalizarCategoria(categoria);
  return categoria;
}

/** El encabezado de la fila de una categoría. */
function tituloDeCategoria(vertical: string, categoria: string): string {
  if (vertical === "citas") {
    return (
      TITULO_FILA[categoria] ??
      CATEGORIA_CITA_LABEL[categoria as keyof typeof CATEGORIA_CITA_LABEL] ??
      categoria
    );
  }
  if (vertical === "eventos") {
    return CATEGORIA_LABEL[categoria as keyof typeof CATEGORIA_LABEL] ?? categoria;
  }
  return categoriaOptions(vertical).find((o) => o.id === categoria)?.label ?? categoria;
}

/**
 * El orden DENTRO de una fila, en tres escalones:
 *
 *   1. Los súper destacados (0169), que el admin eligió a mano.
 *   2. `destacado_orden` ascendente. `null` es «no destacado», NO cero:
 *      un negocio sin marca nunca le gana el puesto a uno marcado.
 *   3. `created_at` descendente — lo último publicado adelante, que es
 *      el único orden que los datos sostienen hoy (no hay reseñas ni
 *      ranking de reservas).
 *
 * Devuelve una copia: la función es pura y quien llama puede estar
 * pasando el mismo arreglo a otra pantalla.
 */
function ordenar(items: Rancho[], superIds: Set<string>): Rancho[] {
  return [...items].sort((a, b) => {
    const superA = superIds.has(a.id) ? 0 : 1;
    const superB = superIds.has(b.id) ? 0 : 1;
    if (superA !== superB) return superA - superB;

    const ordenA = a.destacado_orden ?? Number.POSITIVE_INFINITY;
    const ordenB = b.destacado_orden ?? Number.POSITIVE_INFINITY;
    if (ordenA !== ordenB) return ordenA - ordenB;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Reparte los negocios de una vertical en filas por rubro.
 *
 * @param todos      Los aprobados de TODAS las verticales; acá se filtra.
 * @param vertical   Qué vertical se está armando.
 * @param superIds   Los súper destacados: van primeros dentro de su fila.
 * @param escondidos Los que ya se están viendo QUIETOS arriba (la
 *                   vitrina del héroe). Se sacan del reparto: un negocio
 *                   congelado en un banner y repetido tres centímetros
 *                   más abajo se nota de inmediato. Los que ROTAN en un
 *                   carrusel no van acá — ese es un escaparate, no una
 *                   lista, y sí pueden volver a aparecer.
 */
export function agruparEnCarriles(
  todos: Rancho[],
  vertical: string,
  superIds: string[] = [],
  escondidos: string[] = [],
): PanelCarriles {
  const fuera = new Set(escondidos);
  const supers = new Set(superIds);

  const propios = todos.filter((r) => verticalDe(r) === vertical && !fuera.has(r.id));
  if (propios.length === 0) return { nivel: "C", carriles: [], sueltos: [] };

  const directorio = DIRECTORIO[vertical] ?? "/eventos";

  // ── Se agrupa por categoría normalizada ──────────────────────────
  const porCategoria = new Map<string, Rancho[]>();
  for (const r of propios) {
    const cat = normalizarDe(vertical, r.categoria);
    const lista = porCategoria.get(cat);
    if (lista) lista.push(r);
    else porCategoria.set(cat, [r]);
  }

  const carriles: Carril[] = [];
  const colocados = new Set<string>();

  // Se recorre la taxonomía en su orden oficial, no el orden en que la
  // base devolvió las filas: así «Lugares» va siempre antes que
  // «Alimentación», entre en la lista primero o último.
  for (const categoria of ordenCategorias(vertical)) {
    const deLaCategoria = porCategoria.get(categoria);
    if (!deLaCategoria || deLaCategoria.length === 0) continue;

    // ── LA REGLA DE DOS NIVELES ────────────────────────────────────
    //
    // Una SUBcategoría con suficientes negocios abre su propia fila,
    // antes que la de su categoría padre: «Ranchos para fiestas» dice
    // mucho más que «Lugares», y el día que haya tres publicados la
    // fila aparece sola, sin que nadie escriba una línea.
    //
    // Solo si la taxonomía la conoce: una `subcategoria` vieja o con
    // typo que quedó en la base no puede convertirse en un encabezado
    // con el id crudo a la vista.
    const subsDeLaCategoria = SUBCATEGORIAS[categoria as keyof typeof SUBCATEGORIAS] ?? [];
    for (const sub of subsDeLaCategoria) {
      const items = deLaCategoria.filter(
        (r) => r.subcategoria === sub.id && !colocados.has(r.id),
      );
      if (items.length < MIN_CARRIL) continue;
      if (!SUBCATEGORIA_LABEL[sub.id]) continue;

      for (const r of items) colocados.add(r.id);
      // El directorio NO filtra por subcategoría: el «Ver todo» manda a
      // la categoría padre, que sí existe como filtro. Mejor una lista
      // más ancha que un enlace a un filtro inexistente.
      const padre = CATEGORIA_DE_SUBCATEGORIA[sub.id] ?? categoria;
      carriles.push({
        clave: `sub:${sub.id}`,
        eje: "subcategoria",
        titulo: SUBCATEGORIA_LABEL[sub.id],
        items: ordenar(items, supers).slice(0, TOPE_CARRIL),
        verTodoHref: `${directorio}?categoria=${encodeURIComponent(padre)}`,
      });
    }

    // ── Y lo que quedó de la categoría, si todavía alcanza ─────────
    const resto = deLaCategoria.filter((r) => !colocados.has(r.id));
    if (resto.length < MIN_CARRIL) continue;

    for (const r of resto) colocados.add(r.id);
    carriles.push({
      clave: `cat:${categoria}`,
      eje: "categoria",
      titulo: tituloDeCategoria(vertical, categoria),
      items: ordenar(resto, supers).slice(0, TOPE_CARRIL),
      verTodoHref: `${directorio}?categoria=${encodeURIComponent(categoria)}`,
    });
  }

  // ── El carril de cierre: nadie queda invisible ────────────────────
  let visibles = carriles;
  let sobrantes = propios.filter((r) => !colocados.has(r.id));

  // Si las filas candidatas se pasan del tope, las últimas no se
  // borran: se vuelcan adentro de «Más en …», que se queda con el
  // último lugar disponible.
  const cupo = sobrantes.length > 0 ? TOPE_CARRILES - 1 : TOPE_CARRILES;
  if (carriles.length > cupo) {
    visibles = carriles.slice(0, TOPE_CARRILES - 1);
    sobrantes = [
      ...carriles.slice(TOPE_CARRILES - 1).flatMap((c) => c.items),
      ...sobrantes,
    ];
  }

  if (sobrantes.length > 0) {
    visibles = [
      ...visibles,
      {
        clave: "resto",
        eje: "resto",
        titulo: `Más en ${NOMBRE_VERTICAL[vertical] ?? "Bookea"}`,
        items: ordenar(sobrantes, supers).slice(0, TOPE_CARRIL),
        verTodoHref: directorio,
      },
    ];
  }

  // ── El nivel ─────────────────────────────────────────────────────
  //
  // Solo cuentan las filas de rubro: «Más en …» sola, o acompañada de
  // una única fila real, no es una pantalla de carriles — es una fila y
  // un cajón de sastre, y se lee mejor como grilla.
  const reales = visibles.filter((c) => c.eje !== "resto").length;
  if (reales >= MIN_PARA_CARRILES) {
    return { nivel: "A", carriles: visibles, sueltos: [] };
  }

  return { nivel: "B", carriles: [], sueltos: ordenar(propios, supers) };
}
