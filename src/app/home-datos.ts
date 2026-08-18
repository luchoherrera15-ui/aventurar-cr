import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";
import { leerSuperDestacados } from "@/lib/destacados";
import { enConfiguracion, normalizarCategoria, type Rancho } from "@/app/mi-negocio/types";
import { normalizarCategoriaCita } from "@/app/citas/tipos";
import { urlDirectorio } from "@/lib/url-directorio";
// Solo el TIPO: el carrusel es un módulo "use client" y un import de
// valor lo arrastraría al servidor. Mismo criterio que @/lib/destacados.
import type { NegocioDestacado } from "@/components/carrusel-super-destacados";

/**
 * ============================================================
 * LOS DATOS DE LA PORTADA — una sola función, una sola tanda
 * ============================================================
 *
 * `/` es la URL más visitada del sitio y la que Google usa para
 * calificar la velocidad. Por eso acá hay UNA función y no cinco
 * consultas repartidas entre componentes: cada ida y vuelta a Supabase
 * desde Vercel cuesta ~55 ms medidos, y escritas como `await` seguidos
 * esas idas se suman al primer byte. En /eventos, juntarlas en un solo
 * `Promise.all` ahorró ~165 ms (ver el comentario de
 * src/app/eventos/page.tsx); la portada hace exactamente lo mismo.
 *
 * ⚠️ NUNCA `select("*")` SOBRE `ranchos`. La misma fila guarda el SINPE
 * y la cuenta bancaria del proveedor, y con `*` esas columnas terminan
 * serializadas dentro del HTML público — pasó de verdad, dos veces (ver
 * el comentario largo de @/lib/ranchos-publicos). Acá se pide
 * COLUMNAS_CARD, que no incluye ninguna columna de cobro. Si una
 * tarjeta necesita un campo nuevo, se suma allá, no acá.
 *
 * Este módulo es de SERVIDOR (importa el cliente de Supabase, que lee
 * cookies) y NEUTRO: no lleva "use client" ni exporta nada que un
 * componente de cliente pueda importar. Quien lo consuma —
 * src/app/home-secciones.tsx y src/app/page.tsx— tiene que seguir
 * siendo componente de servidor.
 */

/**
 * Cuántas tarjetas entran como mucho en el riel «Lo nuevo en Bookea».
 * El riel es horizontal: más de una docena nadie las desliza, y cada
 * una es una foto más que bajar en la portada.
 */
const TOPE_NUEVOS = 12;

/**
 * Cuántas tarjetas entran en la tira «Negocios destacados» de arriba.
 * Cuatro, como la maqueta — es el número de columnas de la grilla, y
 * una quinta obligaría a inventar un control para llegar a ella.
 */
const TOPE_PEEK = 4;

/**
 * A qué directorio manda cada vertical. Se usa para el «Ver todo» del
 * riel y para el link de la vitrina de respaldo.
 *
 * ⚠️ La ruta importa: `/{slug}` sirve a Eventos y Hospedajes, pero para
 * Citas y Restaurantes es un 307 (src/app/[slug]/page.tsx los redirige
 * a su sección). Desde la portada eso sería un viaje de ida y vuelta
 * extra en la URL más visitada del sitio. Es el mismo criterio de
 * `hrefDeNegocio` en carrusel-super-destacados.tsx; está repetido acá
 * —y no importado— porque aquel vive dentro de un módulo "use client",
 * y exportar ayudantes desde un "use client" rompe el build en
 * silencio. Si algún día se unifica, el lugar es un módulo neutro.
 */
const DIRECTORIO_POR_VERTICAL: Record<string, string> = {
  eventos: "/eventos",
  citas: "/citas",
  restaurantes: "/restaurantes",
  hospedajes: "/hospedajes",
};

/**
 * La vertical de un negocio, con el default de siempre.
 *
 * Va como función y no como `r.vertical ?? "eventos"` suelto porque el
 * tipo `Rancho` declara `vertical?: "eventos" | "citas" | "hospedajes"`
 * —sin "restaurantes", que llegó después— y comparar contra
 * "restaurantes" sería un error de compilación aunque en la base ese
 * valor exista y llegue en la fila. Acá se ensancha a `string` en un
 * solo lugar, en vez de sembrar casts por todo el archivo.
 */
export function verticalDe(rancho: Rancho): string {
  return (rancho as { vertical?: string }).vertical ?? "eventos";
}

/**
 * La ficha de un negocio, sin pasar por el redirect de `/{slug}`.
 *
 * La implementación se mudó a @/lib/ruta-negocio, que es NEUTRO y por
 * lo tanto lo puede importar también la tarjeta —un componente de
 * cliente que no puede leer este archivo, porque acá se importa el
 * Supabase de servidor—. Estaba escrita palabra por palabra dos veces
 * (acá y en el carrusel) y le FALTABA justamente a la tarjeta, que
 * enlazaba a `/{slug}` para todos y se comía un 307 en Citas y
 * Restaurantes.
 *
 * Se re-exporta con el mismo nombre para no tocar a quien ya la
 * importaba desde acá.
 */
export { rutaDeNegocio } from "@/lib/ruta-negocio";

/** Cuántos negocios publicados hay por categoría, dentro de una vertical. */
export type ConteosPorCategoria = Record<string, number>;

/**
 * Una provincia con negocios publicados, para los chips de «Descubrí
 * algo cerca de vos».
 *
 * ⚠️ ES EL SUSTITUTO HONESTO DEL MOSAICO DE PROVINCIAS DE LA MAQUETA.
 * Aquel pedía cinco fotos que no existen (y que serían de banco de
 * imágenes) y prometía cobertura en cinco provincias sin haberla
 * verificado. Esto cuenta la columna `provincia` sobre la misma lista
 * que ya trajimos: cero consultas nuevas, cero fotos, y el número que
 * se muestra es exactamente el que la persona va a encontrar del otro
 * lado del clic.
 */
export type ProvinciaConNegocios = {
  provincia: string;
  cantidad: number;
  /** El directorio de la vertical que más pesa en esa provincia. */
  href: string;
};

export type DatosHome = {
  /**
   * El riel «Lo nuevo en Bookea»: aprobados, sin los que están «en
   * configuración», del más nuevo al más viejo. Incluye los negocios de
   * muestra —se quedan publicados a propósito— porque `RanchoCard` les
   * pinta el aviso «Demo» con el criterio compartido de @/lib/demo.
   */
  nuevos: Rancho[];
  /** Los súper destacados (0169) para el carrusel del héroe. */
  destacados: NegocioDestacado[];
  /**
   * El negocio que ocupa la vitrina cuando NO hay súper destacados
   * (nivel B del degradado, §3.2 del plan). `null` cuando la vitrina
   * curada sí tiene con qué pintarse, o cuando no hay ningún negocio
   * pintable con foto.
   */
  respaldoVitrina: Rancho | null;
  /**
   * La tira «Negocios destacados» de arriba de la portada (la sección
   * `business-peek` de la maqueta). Filas completas y no
   * `NegocioDestacado`: la tarjeta muestra la subcategoría, la insignia
   * «Nuevo» y la de «★ Destacado», y ninguna de las tres viaja en la
   * consulta acotada del carrusel.
   */
  vitrinaPeek: Rancho[];
  /**
   * Si `vitrinaPeek` sale de los súper destacados que el admin eligió a
   * mano (0169) o si se completó con lo último publicado. Decide el
   * encabezado: llamar «elegidos a mano» a los últimos que entraron
   * sería afirmar una curaduría que no existe.
   */
  peekCurado: boolean;
  /** A dónde manda el «Ver todos» de esa tira. */
  verTodoPeek: string;
  /** Para las grillas de categoría: cuántos negocios hay en cada una. */
  conteos: { citas: ConteosPorCategoria; eventos: ConteosPorCategoria };
  /** A dónde manda el «Ver todo» del riel: la vertical que más pesa. */
  verTodoNuevos: string;
  /** Las provincias con negocios publicados, de más a menos. */
  porProvincia: ProvinciaConNegocios[];
  favoritosIds: string[];
  sesionActiva: boolean;
};

/**
 * El directorio de la vertical que más aporta a una lista.
 *
 * No existe una página que liste las cuatro verticales juntas, así que
 * un riel del marketplace entero no tiene un «Ver todo» único. Se elige
 * el de la vertical dominante; si empatan o la lista está vacía,
 * Eventos, que es el directorio más grande y el que ya recibe el resto
 * de los enlaces del sitio. No queda cojo porque los cuatro directorios
 * llevan arriba el `SelectorVertical`: quien toque «Ver todo» aterriza
 * en la lista más parecida a lo que estaba mirando.
 */
function directorioDominante(lista: Rancho[]): string {
  const porVertical: Record<string, number> = {};
  for (const r of lista) {
    const v = verticalDe(r);
    porVertical[v] = (porVertical[v] ?? 0) + 1;
  }
  let dominante = "eventos";
  for (const [v, cantidad] of Object.entries(porVertical)) {
    if (cantidad > (porVertical[dominante] ?? 0)) dominante = v;
  }
  return DIRECTORIO_POR_VERTICAL[dominante] ?? "/eventos";
}

/**
 * Todo lo que la portada le pide a la base, de una sola vez.
 *
 * NO TIRA NUNCA. Si una consulta falla —la 0169 sin correr, un tropiezo
 * de red— la lista que corresponda llega vacía y la sección
 * simplemente no se pinta (ver los umbrales en home-secciones.tsx). La
 * portada no puede caerse por un dato decorativo.
 */
export async function leerDatosHome(): Promise<DatosHome> {
  const supabase = await createClient();

  const [
    { data },
    destacados,
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("ranchos")
      .select(COLUMNAS_CARD)
      .eq("estado", "aprobado")
      // Los más nuevos primero: es el único orden que los datos
      // sostienen hoy. No hay reseñas (cero filas en `resenas`) ni
      // favoritos, así que «lo mejor valorado» no existe y «lo más
      // popular» tampoco — de ahí que la sección se llame «Lo nuevo».
      .order("created_at", { ascending: false }),

    // Los hasta 10 que el admin eligió a mano (0169). La función vive
    // en @/lib/destacados y ya trae adentro el filtro de «en
    // configuración» y el degradado cuando la columna no existe en esta
    // base: devuelve [] y la portada sigue viva. Entra en esta tanda
    // porque devuelve una promesa como las demás.
    leerSuperDestacados(supabase),

    // Para un visitante anónimo esto no sale a la red (corta con
    // AuthSessionMissingError), así que no le cuesta nada a la mayoría
    // de las visitas; con sesión, viaja en paralelo con el resto.
    supabase.auth.getUser(),
  ]);

  // Las tarjetas piden el tipo `Rancho` completo pero solo leen las
  // columnas de COLUMNAS_CARD (verificado campo por campo en
  // ranchos-publicos.ts) — de ahí el cast.
  const aprobados = (data ?? []) as unknown as Rancho[];

  // ── Los conteos por categoría ────────────────────────────────────
  //
  // Se calculan en memoria sobre la lista que ya trajimos: cero
  // consultas extra, y siempre coinciden con lo que el visitante va a
  // encontrar del otro lado del clic.
  //
  // POR QUÉ SE CUENTA TODO LO APROBADO (demos y «en configuración»
  // incluidos): el número está debajo de una tarjeta que enlaza a
  // `/citas?categoria=…`, y ese directorio lista exactamente eso. Si
  // acá descontáramos los de muestra, la tarjeta diría «2 negocios» y
  // la página siguiente mostraría cuatro. Un conteo que no cuadra con
  // su destino es peor que no poner conteo.
  const conteos = {
    citas: {} as ConteosPorCategoria,
    eventos: {} as ConteosPorCategoria,
  };
  for (const r of aprobados) {
    const vertical = verticalDe(r);
    // Se normaliza igual que en cada directorio (una categoría vieja o
    // con typo cae en "otros" allá también), o el conteo apuntaría a un
    // filtro que no devuelve a ese negocio.
    if (vertical === "citas") {
      const id = normalizarCategoriaCita(r.categoria);
      conteos.citas[id] = (conteos.citas[id] ?? 0) + 1;
    } else if (vertical === "eventos") {
      const id = normalizarCategoria(r.categoria);
      conteos.eventos[id] = (conteos.eventos[id] ?? 0) + 1;
    }
  }

  // ── Lo que se puede pintar como tarjeta ──────────────────────────
  //
  // «En configuración» es una publicación que se ve en el directorio
  // pero no se puede abrir (la card le pone un velo y le corta el
  // link). En un riel de la portada sería una promesa que no se cumple:
  // el clic no lleva a ninguna parte. Se saca.
  const pintables = aprobados.filter((r) => !enConfiguracion(r.detalles));

  // ── El respaldo de la vitrina (nivel B del degradado) ────────────
  //
  // Solo existe cuando NO hay súper destacados. Pide foto porque el
  // nivel B es un banner a toda página: sin foto quedaría un gradiente
  // gigante con un nombre encima.
  const respaldoVitrina =
    destacados.length > 0 ? null : (pintables.find((r) => !!r.foto_url) ?? null);

  // Si el respaldo se está pintando, se saca del riel: quedaría
  // congelado arriba y repetido como primera tarjeta justo debajo, y
  // con ocho negocios publicados repetir uno se nota de inmediato. Los
  // súper destacados, en cambio, SÍ pueden repetirse en el riel: el
  // carrusel rota y funciona como vitrina, no como listado.
  const nuevos = pintables
    .filter((r) => r.id !== respaldoVitrina?.id)
    .slice(0, TOPE_NUEVOS);

  // ── A dónde va el «Ver todo» del riel ────────────────────────────
  //
  // (Hoy, con los datos de producción, la vertical dominante del riel
  // manda a /citas.) La regla completa está en `directorioDominante`.
  const verTodoNuevos = directorioDominante(nuevos);

  // ── LA TIRA «NEGOCIOS DESTACADOS» (sección `business-peek`) ──────
  //
  // CERO CONSULTAS NUEVAS. `leerSuperDestacados` ya trajo los ids que
  // el admin marcó a mano (0169); con esos ids se eligen las filas
  // COMPLETAS que ya están en `pintables`, que traen subcategoría,
  // `destacado_orden` y `created_at` — tres campos que la consulta
  // acotada del carrusel no pide y que la tarjeta de la tira sí usa.
  //
  // El degradado tiene dos escalones, igual que el resto de la portada:
  //   · CURADA  — alcanzan los súper destacados → «Elegidos a mano».
  //   · RELLENO — no alcanzan, se completa con lo último publicado →
  //               «Recién publicados», que es lo que de verdad son.
  //
  // El componente (`NegociosDestacados`) es el único que decide si la
  // sección se pinta o no — hoy con 1 negocio pintable alcanza (ver
  // `MIN_DESTACADOS`, pedido explícito del dueño). Acá no se recorta
  // por cantidad, solo por el tope de cuatro tarjetas.
  const idsCurados = new Set(destacados.map((d) => d.id));
  const curados = pintables.filter((r) => idsCurados.has(r.id));
  const vitrinaPeek = [
    ...curados,
    ...pintables.filter((r) => !idsCurados.has(r.id)),
  ].slice(0, TOPE_PEEK);
  const peekCurado = curados.length >= TOPE_PEEK;
  const verTodoPeek = directorioDominante(vitrinaPeek);

  // ── LAS PROVINCIAS CON NEGOCIOS ──────────────────────────────────
  //
  // Se cuenta sobre `pintables` y no sobre `aprobados`: el chip lleva a
  // un directorio filtrado por zona, y anunciar una provincia cuyo
  // único negocio no se puede abrir es mandar a una lista muerta.
  //
  // Solo las que TIENEN algo. Ninguna provincia se pinta «por
  // completar el mapa»: la maqueta dibujaba cinco con foto y esta
  // portada no promete cobertura que no exista.
  const provincias = new Map<string, Rancho[]>();
  for (const r of pintables) {
    const nombre = (r.provincia ?? "").trim();
    if (!nombre) continue;
    const lista = provincias.get(nombre);
    if (lista) lista.push(r);
    else provincias.set(nombre, [r]);
  }
  const porProvincia: ProvinciaConNegocios[] = [...provincias.entries()]
    .map(([provincia, lista]) => ({
      provincia,
      cantidad: lista.length,
      // La vertical que más pesa EN ESA PROVINCIA: mandar a /eventos
      // una provincia donde todo lo publicado son barberías dejaría al
      // visitante en una lista vacía.
      href: urlDirectorio(directorioDominante(lista), { provincia }),
    }))
    // De más a menos, y a igual cantidad por nombre: el orden tiene que
    // ser estable entre dos visitas o los chips bailan sin motivo.
    .sort((a, b) => b.cantidad - a.cantidad || a.provincia.localeCompare(b.provincia, "es"));

  // La única consulta que no puede ir en la tanda de arriba: necesita
  // el id de la sesión. Solo la paga quien tiene sesión abierta.
  let favoritosIds: string[] = [];
  if (user) {
    const { data: favData } = await supabase
      .from("favoritos")
      .select("rancho_id")
      .eq("cliente_id", user.id);
    favoritosIds = (favData ?? []).map((f) => f.rancho_id as string);
  }

  return {
    nuevos,
    destacados,
    respaldoVitrina,
    vitrinaPeek,
    peekCurado,
    verTodoPeek,
    conteos,
    verTodoNuevos,
    porProvincia,
    favoritosIds,
    sesionActiva: !!user,
  };
}
