import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";
import { pedirFilas } from "@/lib/ranchos-publicos";
import {
  claveDeDestino,
  hrefDeDestino,
  type ColumnaNav,
  type Destino,
  type Puerta,
} from "@/components/nav/taxonomia-navegacion";

/**
 * ============================================================
 * EL CENSO DE RUBROS — cuántos negocios hay detrás de cada enlace
 * ============================================================
 *
 * El menú de Bookea se arma contra esto y no contra una lista escrita a
 * mano. Decisión del dueño (ago 2026): la taxonomía se declara ENTERA en
 * `@/components/nav/taxonomia-navegacion`, pero **una entrada sin
 * negocios no se lista**. Así el menú crece solo a medida que entran
 * negocios —sin tocar código— y nunca hay un enlace que abra una lista
 * vacía.
 *
 * ── LA REGLA DE VISIBILIDAD, UNA SOLA VEZ ────────────────────────
 *
 *   estado = 'aprobado'   lo pendiente, rechazado o pausado no se ve.
 *   en_marketplace ≠ false  la fila es una ficha del directorio y no un
 *                         cliente de Bookea Lealtad (0187).
 *
 * El segundo filtro importa más de lo que parece: hoy, de las filas de
 * `ranchos`, la mayoría son cuentas de Lealtad que nunca se ofrecieron
 * como proveedores. Sin él, el menú contaría negocios que el directorio
 * no muestra.
 *
 * `!== false` y no `=== true`, igual que en el tablero del admin: si la
 * 0187 no está corrida en esta base la propiedad llega `undefined` y el
 * censo daría cero en todo.
 *
 * ── DECISIONES QUE NO SON OBVIAS ─────────────────────────────────
 *
 * · **`createAnonClient()` y no `createClient()`.** Los conteos son
 *   datos públicos, idénticos para todo visitante: no dependen de quién
 *   mira. Al no tocar cookies, la ruta que lo use puede quedar cacheada
 *   en el borde en vez de volverse dinámica (ver el comentario de
 *   `createAnonClient` en @/lib/supabase/server).
 *
 * · **`cache()` de React y no `unstable_cache`.** Este repo corre Next
 *   16.3.0, donde `unstable_cache` está reemplazado por `use cache`, y
 *   no hay ni un uso previo en el código. `cache()` deduplica por render
 *   —el mismo patrón de `@/lib/negocio-propio`— y con este catálogo
 *   alcanza de sobra.
 *
 * · **Tres columnas, jamás `select("*")`.** La misma fila de `ranchos`
 *   guarda el SINPE y la cuenta bancaria del proveedor, y ya se filtró
 *   dos veces (ver el comentario largo de @/lib/ranchos-publicos).
 *
 * · **NO se llama desde `site-header.tsx`.** Ese componente se monta en
 *   decenas de pantallas y la mayoría no muestra un solo contador. Lo
 *   lee la página que dibuja el menú y lo baja como prop.
 *
 * · **NO TIRA NUNCA.** Si la consulta falla, el censo vuelve vacío. Un
 *   menú corto es un mal menor; una portada caída por un dato decorativo
 *   no.
 */

/** Lo mínimo que hace falta para contar. Ni una columna de cobro. */
const COLUMNAS_CENSO = "vertical, categoria, subcategoria";

/**
 * La columna JOVEN: la trajo la 0187 y este código puede llegar a una
 * base que todavía no la tenga. Nombrarla en un `select` explícito
 * contra una base sin migrar hace fallar la consulta ENTERA, así que va
 * por el camino tolerante de `pedirFilas` — el mismo que ya usan los
 * directorios para `pais`.
 */
const COLUMNAS_CENSO_JOVENES = "en_marketplace";

export type Censo = {
  /**
   * `vertical|categoria|subcategoria` → cuántos negocios visibles hay.
   * Las claves parciales también están: `citas||` es «toda la vertical
   * de Citas» y `citas|barberia|` es «la categoría barbería completa».
   * La arma `claveDeDestino()`, que es la misma función que usa el menú
   * para preguntar.
   */
  porClave: Record<string, number>;
  /** Cuántos negocios visibles hay en total. */
  total: number;
};

export const CENSO_VACIO: Censo = { porClave: {}, total: 0 };

type FilaCenso = {
  vertical?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  /** 0187. `undefined` si la migración no está corrida en esta base. */
  en_marketplace?: boolean | null;
};

/**
 * Cuántos negocios visibles hay por vertical y por rubro.
 *
 * Se cuenta en memoria sobre una sola consulta: el reparto por rubro en
 * la base costaría una ida por rubro, y la lista completa de fichas del
 * directorio entra holgada en un solo viaje.
 */
/**
 * ⚠️ DOS CAPAS DE CACHÉ, Y CADA UNA HACE OTRA COSA.
 *
 * El `cache()` de React (afuera) deduplica DENTRO de una misma visita:
 * si tres componentes piden el censo, viaja uno. El `unstable_cache`
 * (adentro) comparte ENTRE visitas: la primera paga el viaje a Supabase
 * y las siguientes leen de la caché de datos de Vercel hasta 60 s.
 *
 * Antes solo estaba la primera capa, así que CADA visita a la portada
 * repetía esta consulta — con la base en otra región, parte de la
 * lentitud que reportó el dueño (26 ago 2026). El conteo de rubros
 * puede llevar hasta un minuto de atraso sin que nadie lo note; el TTFB
 * de cada visita, no.
 */
const leerCensoCacheado = unstable_cache(
  async (): Promise<Censo> => leerCensoDeLaBase(),
  ["censo-rubros"],
  { revalidate: 60, tags: ["catalogo-portada"] },
);

export const leerCenso = cache(async function leerCenso(): Promise<Censo> {
  try {
    return await leerCensoCacheado();
  } catch {
    // La caché de datos puede no estar disponible (build, entornos sin
    // soporte): se cae al viaje directo, que es lo que siempre hubo.
    return leerCensoDeLaBase();
  }
});

async function leerCensoDeLaBase(): Promise<Censo> {
  let filas: FilaCenso[];
  try {
    const supabase = createAnonClient();
    filas = (await pedirFilas(
      (columnas) =>
        supabase.from("ranchos").select(columnas).eq("estado", "aprobado"),
      COLUMNAS_CENSO,
      COLUMNAS_CENSO_JOVENES,
    )) as FilaCenso[];
  } catch {
    return CENSO_VACIO;
  }

  const porClave: Record<string, number> = {};
  let total = 0;

  for (const fila of filas) {
    if (fila.en_marketplace === false) continue;
    // El mismo default de siempre para una fila vieja sin vertical
    // (`verticalDe` en @/lib/carriles-home hace exactamente esto): antes
    // de que existieran las otras tres, todo era Eventos.
    const vertical = fila.vertical ?? "eventos";
    const categoria = fila.categoria ?? "";
    const subcategoria = fila.subcategoria ?? "";

    total += 1;
    // Un negocio suma en las TRES claves que lo contienen: su vertical,
    // su categoría y su rubro exacto. Así la misma tabla contesta
    // «¿cuántos hay en Citas?» y «¿cuántos en Barbería?» sin recorrerla
    // de nuevo.
    sumar(porClave, `${vertical}||`);
    if (categoria) sumar(porClave, `${vertical}|${categoria}|`);
    if (categoria && subcategoria) {
      sumar(porClave, `${vertical}|${categoria}|${subcategoria}`);
    }
  }

  return { porClave, total };
}

function sumar(mapa: Record<string, number>, clave: string): void {
  mapa[clave] = (mapa[clave] ?? 0) + 1;
}

/** Cuántos negocios visibles hay detrás de un destino del menú. */
export function contarDestino(censo: Censo, destino: Destino): number {
  const clave = claveDeDestino(destino);
  if (!clave) return 0;
  return censo.porClave[clave] ?? 0;
}

/**
 * La puerta podada: solo las entradas que llevan a algún lado Y que
 * tienen al menos un negocio detrás.
 *
 * Las dos condiciones son necesarias y ninguna sobra:
 *
 *   · sin href  → el destino existe en la base pero el directorio
 *                 todavía no lo filtra: el enlace mostraría la lista
 *                 entera (ver los estados de `Destino`).
 *   · sin negocios → el enlace abriría una lista vacía.
 *
 * Devuelve `null` cuando no queda nada: la puerta sigue existiendo —su
 * botón lleva a su ruta— pero su panel se arma con el CTA de captación
 * en vez de con una columna de enlaces muertos.
 */
export function puertaConInventario(puerta: Puerta, censo: Censo): Puerta | null {
  const columnas: ColumnaNav[] = puerta.columnas
    .map((columna) => ({
      ...columna,
      verTodo:
        columna.verTodo && visible(columna.verTodo, censo) ? columna.verTodo : undefined,
      entradas: columna.entradas.filter((e) => visible(e.destino, censo)),
    }))
    .filter((columna) => columna.entradas.length > 0);

  if (columnas.length === 0) return null;
  return { ...puerta, columnas };
}

/** Las cinco puertas podadas. Las que quedan sin nada salen de la lista. */
export function puertasConInventario(puertas: Puerta[], censo: Censo): Puerta[] {
  return puertas
    .map((p) => puertaConInventario(p, censo))
    .filter((p): p is Puerta => p !== null);
}

function visible(destino: Destino, censo: Censo): boolean {
  return hrefDeDestino(destino) !== null && contarDestino(censo, destino) > 0;
}
