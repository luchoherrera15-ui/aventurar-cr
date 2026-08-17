import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_CARD } from "@/lib/ranchos-publicos";
import { leerSuperDestacados } from "@/lib/destacados";
import { enConfiguracion, normalizarCategoria, type Rancho } from "@/app/mi-negocio/types";
import { normalizarCategoriaCita } from "@/app/citas/tipos";
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
  /** Para las grillas de categoría: cuántos negocios hay en cada una. */
  conteos: { citas: ConteosPorCategoria; eventos: ConteosPorCategoria };
  /** A dónde manda el «Ver todo» del riel: la vertical que más pesa. */
  verTodoNuevos: string;
  favoritosIds: string[];
  sesionActiva: boolean;
};

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
  // El riel es de TODO el marketplace, así que no hay un directorio
  // único al que mandar: no existe una página que liste las cuatro
  // verticales juntas. Se elige el de la vertical que más aporta al
  // riel; si empatan o no hay nada, Eventos, que es el directorio más
  // grande y el que ya recibe el resto de los enlaces del sitio.
  //
  // No queda cojo porque los cuatro directorios llevan arriba el
  // `SelectorVertical`: quien toque «Ver todo» aterriza en la lista más
  // parecida a lo que estaba mirando, con las otras verticales a un
  // clic. (Hoy, con los datos de producción: 4 de Citas, 2 de
  // Restaurantes y 1 de Eventos → manda a /citas.)
  const porVertical: Record<string, number> = {};
  for (const r of nuevos) {
    const v = verticalDe(r);
    porVertical[v] = (porVertical[v] ?? 0) + 1;
  }
  let dominante = "eventos";
  for (const [v, cantidad] of Object.entries(porVertical)) {
    if (cantidad > (porVertical[dominante] ?? 0)) dominante = v;
  }
  const verTodoNuevos = DIRECTORIO_POR_VERTICAL[dominante] ?? "/eventos";

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
    conteos,
    verTodoNuevos,
    favoritosIds,
    sesionActiva: !!user,
  };
}
