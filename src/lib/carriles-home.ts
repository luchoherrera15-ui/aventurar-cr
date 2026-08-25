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
import { urlDeRubro } from "@/lib/rubros-portada";

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

/**
 * El directorio de cada vertical — LAS QUE TODAVÍA TIENEN UNO.
 *
 * ⚠️ `citas` y `eventos` YA NO ESTÁN, y la ausencia es la información.
 * Sus directorios se borraron en ago 2026 («el marketplace y la única
 * página donde se pueden ver los negocios es bookea.lat»): la portada
 * los muestra y los filtra con `?rubro=`.
 *
 * Que falten hace que `DIRECTORIO[vertical]` devuelva `undefined` para
 * esas dos, y eso es a propósito: quien arma un riel de Citas en la
 * portada NO debe pintar un «Ver todos», porque llevaría a la página en
 * la que ya está parado. Un botón que no va a ningún lado es peor que
 * ningún botón.
 *
 * `restaurantes` y `hospedajes` sí conservan el suyo: son directorios
 * de verdad, con su propia página.
 */
export const DIRECTORIO: Record<string, string> = {
  restaurantes: "/restaurantes",
  hospedajes: "/hospedajes",
};

/**
 * CÓMO SE LLAMA CADA VERTICAL DE CARA AL PÚBLICO.
 *
 * Un solo mapa para todo el sitio: lo lee el carril de cierre («Más en
 * …»), el riel de la portada y la fila de íconos de arriba
 * (`@/components/home/grupos-categorias`). Tres copias de estos cuatro
 * nombres serían tres verdades el día que el dueño renombre una.
 *
 * ⚠️ «citas» dice «Salud y belleza» a propósito. La vertical se llama
 * `citas` en la base y en la URL, pero esa palabra no le dice a nadie
 * qué se reserva ahí: barbería, uñas, spa y consultorios. El nombre lo
 * eligió el dueño y ya era el que usaba la portada.
 */
export const NOMBRE_VERTICAL: Record<string, string> = {
  eventos: "Eventos",
  citas: "Salud y belleza",
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
export function verticalDe(rancho: Rancho): string {
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

/**
 * El nombre público de una categoría, para quien no está armando un
 * carril: lo usa la portada para decir «Todavía no hay negocios de
 * barbería» cuando un filtro no devuelve nada.
 *
 * Es un envoltorio de `tituloDeCategoria` y no una copia: dos mapas de
 * etiquetas son dos verdades el día que alguien renombre una fila.
 */
export function etiquetaDeCategoria(vertical: string, categoria: string): string {
  return tituloDeCategoria(vertical, categoria);
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

  /**
   * De dónde sale el «Ver todo» de cada fila.
   *
   * ⚠️ Citas y Eventos YA NO tienen directorio: su catálogo es la
   * portada. Sin esta bifurcación las filas emitían `/?categoria=…`,
   * que la portada NO lee —lee `?rubro=`— y el enlace habría mostrado
   * el catálogo entero sin filtrar: exactamente el enlace que promete
   * una lista y entrega otra.
   */
  const enLaPortada = vertical === "citas" || vertical === "eventos";
  const verTodoDe = (cat: string) =>
    enLaPortada
      ? urlDeRubro(vertical, cat)
      : `${DIRECTORIO[vertical] ?? "/"}?categoria=${encodeURIComponent(cat)}`;
  const directorio = DIRECTORIO[vertical] ?? "/";

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
        verTodoHref: verTodoDe(padre),
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
      verTodoHref: verTodoDe(categoria),
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
        verTodoHref: enLaPortada ? "/" : directorio,
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

/* ═════════════════════════════════════════════════════════════════
   EL REPARTO POR VERTICAL — los rieles de la PORTADA
   ═════════════════════════════════════════════════════════════════

   `agruparEnCarriles` (arriba) abre una fila POR RUBRO dentro de UNA
   vertical: es lo que quiere un directorio, donde el visitante ya
   eligió a qué vino. La portada quiere lo contrario, y así lo pidió el
   dueño:

     «Un carril que diga Eventos y salga todo en general. Un carril que
      diga Salud y belleza y salgan barberías, uñas, estilistas, todo en
      el mismo riel.»

   O sea: CUATRO filas, una por vertical, cada una con todos sus rubros
   revueltos adentro. El rubro específico no se pierde — cada tarjeta lo
   lleva escrito encima de la foto (`RanchoCard`).

   ── POR QUÉ ACÁ Y NO EN UN MÓDULO NUEVO ─────────────────────────────
   Porque todo lo que necesita ya vive en este archivo: `DIRECTORIO`,
   `NOMBRE_VERTICAL`, `verticalDe`, `ordenar` y `TOPE_CARRIL`. Un módulo
   aparte tendría que importarlos o —lo más probable— volver a
   escribirlos.

   ── EL UMBRAL ES 1, Y ES DISTINTO AL DE ARRIBA A PROPÓSITO ──────────
   `MIN_CARRIL` vale 3 porque una fila «Uñas» con una sola tarjeta,
   entre otras cinco filas llenas, grita que ese rubro está vacío. Acá
   no hay comparación posible: son las CUATRO verticales del
   marketplace, y si Hospedajes tiene un solo negocio publicado,
   esconderlo significa que ese negocio —que pagó por estar— no aparece
   en la portada. La regla que sí se respeta es la otra: una vertical
   SIN negocios no dibuja su fila (se devuelve fuera de la lista), en
   vez de un riel vacío con flechas muertas.
*/

/**
 * El orden en que la portada apila sus filas. Fijo y no «por cantidad»:
 * el orden de las secciones de una portada no puede bailar entre dos
 * visitas según quién publicó ayer.
 */
export const ORDEN_VERTICALES = [
  // "citas" primero (pedido del dueño, ago 2026: "pon Barberías al
  // inicio, de primero que Eventos" — el riel de esa vertical se
  // titula "Salud y belleza" y agrupa barberías, uñas, spas...).
  "citas",
  "eventos",
  "hospedajes",
  "restaurantes",
] as const;

export type RielVertical = {
  /** Estable y única: sirve de `key` en React. */
  vertical: string;
  /** El encabezado de la fila («Salud y belleza»). */
  titulo: string;
  /**
   * CUÁNTOS NEGOCIOS TIENE DE VERDAD ESA VERTICAL, antes del tope de la
   * fila. Es el número que se pinta al lado del título, y es el mismo
   * que el visitante va a contar del otro lado del «Ver todos» — porque
   * sale de la misma lista de aprobados que alimenta al directorio.
   */
  total: number;
  /** Las tarjetas que se pintan, ya ordenadas y recortadas. */
  items: Rancho[];
  /** El directorio de la vertical. */
  /** El directorio de la vertical, si todavía tiene uno propio.
   *  `undefined` en Citas y Eventos: su catálogo ES la portada, así que
   *  no hay «Ver todos» que llevar a ningún lado. */
  verTodoHref?: string;
};

/**
 * Reparte los negocios publicados en una fila por vertical.
 *
 * Función PURA sobre la lista que la portada ya trajo: cero consultas
 * nuevas. Las verticales sin negocios no salen en el resultado, así que
 * quien la llama no tiene que acordarse de saltearlas.
 *
 * @param todos    Los aprobados y pintables de TODAS las verticales.
 * @param superIds Los súper destacados (0169): van primeros en su fila.
 */
/**
 * ════════════════════════════════════════════════════════════════════
 *  EL FILTRO DE LOS ÍCONOS DE LA PORTADA (`/?rubro=`)
 * ════════════════════════════════════════════════════════════════════
 *
 * Vive ACÁ y no en la portada por una razón concreta: `normalizarDe` es
 * privada de este archivo, y es la que hace que la categoría cruda de la
 * base caiga en el mismo cajón en el que la pone cada directorio.
 *
 * ⚠️ SIN ESA NORMALIZACIÓN EL FILTRO MIENTE. Un negocio guardado con una
 * categoría vieja o con un alias que `normalizarCategoria` reescribe
 * aparece en el riel de «Lugares» pero NO habría aparecido al filtrar
 * por «lugares» — el visitante ve el negocio en la portada, toca el
 * ícono de su rubro, y el negocio desaparece. Es exactamente el mismo
 * desajuste que el comentario de `normalizarDe` advierte para el «Ver
 * todo» de cada fila.
 *
 * Se compara además la vertical, no solo la categoría: la clave de la
 * URL es la categoría porque hoy las nueve son distintas entre sí, pero
 * el filtro real usa las dos para seguir siendo correcto el día que se
 * repita una en otra vertical.
 */
export function filtrarPorRubro(
  todos: Rancho[],
  rubro: { vertical: string; categoria: string; subcategoria?: string },
): Rancho[] {
  const buscada = normalizarDe(rubro.vertical, rubro.categoria);
  return todos.filter((r) => {
    if (verticalDe(r) !== rubro.vertical) return false;
    const cruda = (r as { categoria?: string | null }).categoria ?? "";
    if (normalizarDe(rubro.vertical, cruda) !== buscada) return false;
    /* La subcategoría solo la traen los destinos de Eventos (ver
       `LEE_SUBCATEGORIA` en taxonomia-navegacion.ts). Cuando viene, el
       recorte es DENTRO de la categoría ya filtrada: sin este segundo
       paso, entrar por «Ranchos para fiestas» en el mega menú devolvía
       todos los Lugares, que es justo el enlace que promete una lista y
       entrega otra. */
    if (!rubro.subcategoria) return true;
    const sub = (r as { subcategoria?: string | null }).subcategoria ?? "";
    return sub === rubro.subcategoria;
  });
}

export function agruparPorVertical(
  todos: Rancho[],
  superIds: string[] = [],
): RielVertical[] {
  const supers = new Set(superIds);

  const porVertical = new Map<string, Rancho[]>();
  for (const r of todos) {
    const v = verticalDe(r);
    const lista = porVertical.get(v);
    if (lista) lista.push(r);
    else porVertical.set(v, [r]);
  }

  // ── Primero las conocidas, EN SU ORDEN FIJO ──────────────────────
  //
  // ── Y DESPUÉS, LO QUE NO ESTABA EN LA LISTA ──────────────────────
  //
  // `ORDEN_VERTICALES` es una constante escrita a mano; `ranchos.vertical`
  // es una columna de la base cuyo CHECK ya se amplió DOS veces (la 0055
  // agregó 'citas' y 'hospedajes', la 0076 agregó 'restaurantes'). El día
  // que se amplíe una tercera, un `for` que solo recorre la constante
  // dejaría a esos negocios FUERA DE LA PORTADA sin un solo error: ni un
  // riel, ni un log, nada. Es exactamente el fallo que este archivo
  // promete no cometer unas líneas más arriba («Ningún negocio publicado
  // puede quedar invisible»).
  //
  // Así que la vuelta se da sobre las conocidas MÁS lo que de verdad
  // llegó en los datos. Una vertical nueva sale al final, con el nombre
  // crudo de la columna si nadie le puso uno bonito y con el «Ver todos»
  // apuntando a Eventos: feo, sí, pero visible — y quien lo vea sabe de
  // inmediato que falta darla de alta en `NOMBRE_VERTICAL` y `DIRECTORIO`.
  const conocidas = new Set<string>(ORDEN_VERTICALES);
  const orden = [
    ...ORDEN_VERTICALES,
    ...[...porVertical.keys()].filter((v) => !conocidas.has(v)).sort(),
  ];

  const rieles: RielVertical[] = [];
  for (const vertical of orden) {
    const propios = porVertical.get(vertical);
    // La regla de oro: una fila sin negocios NO se dibuja.
    if (!propios || propios.length === 0) continue;

    rieles.push({
      vertical,
      titulo: NOMBRE_VERTICAL[vertical] ?? vertical,
      total: propios.length,
      items: ordenar(propios, supers).slice(0, TOPE_CARRIL),
      // Sin directorio propio no hay «Ver todos»: ver DIRECTORIO.
      verTodoHref: DIRECTORIO[vertical],
    });
  }

  return rieles;
}

/**
 * ¿Se dibuja el riel transversal «Recién publicados»?
 *
 * Ese riel es un ATAJO: junta lo último que entró en las cuatro
 * verticales para que nadie tenga que recorrer cuatro filas buscando lo
 * nuevo. Un atajo solo vale la pena si ahorra camino.
 *
 * Con el directorio como está hoy —dos negocios aprobados, uno de
 * Eventos y uno de Salud y belleza— ese riel mostraría EXACTAMENTE las
 * mismas dos tarjetas que las dos filas de abajo, una encima de otra:
 * la portada repetiría el catálogo entero tres veces. Eso no se lee
 * como abundancia, se lee como relleno, que es justo lo que esta
 * portada evita.
 *
 * Por eso pide las dos cosas a la vez:
 *
 *   · MÁS DE UNA FILA debajo que recorrer (si no, el atajo y la fila
 *     son la misma lista con dos nombres distintos).
 *   · `MIN_CARRIL` × 2 negocios publicados — o sea, suficiente fondo
 *     para que «lo más nuevo» no sea, literalmente, «todo».
 *
 * Nadie tiene que tocar código el día que se cumpla: la fila aparece
 * sola cuando entren los negocios.
 */
export function hayFondoParaRecienPublicados(
  pintables: number,
  rieles: number,
): boolean {
  return rieles >= 2 && pintables >= MIN_CARRIL * 2;
}
