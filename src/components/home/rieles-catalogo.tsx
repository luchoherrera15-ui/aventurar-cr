import Link from "next/link";
import RielProveedores from "@/components/riel-proveedores";
import type { Calificacion } from "@/components/rancho-card";
import type { RubroPortada } from "@/lib/rubros-portada";
import {
  TOPE_CARRIL,
  agruparPorRubro,
  etiquetaDeCategoria,
  filtrarPorRubro,
  hayFondoParaRecienPublicados,
} from "@/lib/carriles-home";
import type { CatalogoPortada } from "@/app/home-datos";

/**
 * ============================================================
 * EL CUERPO DE LA PORTADA — un riel por vertical
 * ============================================================
 *
 * Lo que el dueño pidió, en una línea: «Todo el resto: los negocios que
 * tenemos registrados, POR CARRIL. Un carril que diga Eventos y salga
 * todo en general. Un carril que diga Salud y belleza y salgan
 * barberías, uñas, estilistas, todo en el mismo riel.»
 *
 * Así que acá NO hay una fila por rubro (eso es lo que hace
 * `agruparEnCarriles`, y es lo correcto DENTRO de un directorio). Hay
 * una fila por VERTICAL, con todos sus rubros revueltos adentro, y cada
 * tarjeta lleva su rubro específico escrito encima de la foto —eso ya
 * lo resuelve `RanchoCard`, no hace falta separarlos en filas.
 *
 * Componente de SERVIDOR: compone `RielProveedores` (que sí es cliente,
 * por las flechas y el scroll) y le pasa datos ya calculados. Sin
 * estado, sin efectos y sin una sola consulta propia — la lista llega
 * entera desde `leerCatalogoPortada()`.
 *
 * ── LAS DOS REGLAS DE ORO ────────────────────────────────────────
 *
 *   1. UNA FILA SIN NEGOCIOS NO SE DIBUJA. Lo resuelve
 *      `agruparPorVertical`, que ni siquiera devuelve las verticales
 *      vacías. Hoy eso deja dos filas (Eventos y Salud y belleza) y no
 *      cuatro con dos huecos.
 *
 *   2. NADA INVENTADO. Ni estrellas, ni «4,2 km», ni «+500 negocios».
 *      En producción `resenas` tiene CERO filas, `favoritos` cero, y no
 *      hay ubicación del visitante. Los dos mapas que `RielProveedores`
 *      pide van VACÍOS a propósito:
 *
 *        · `calificaciones` — DEJÓ DE IR VACÍO (27 ago 2026). Cuando
 *          se escribió esto, `resenas` tenía cero filas y un mapa vacío
 *          era la verdad. Hoy hay reseñas reales y la nota que se pinta
 *          sale de `calificaciones_rancho`, que las agrega — sigue
 *          siendo verdad, solo que ahora existe. Un negocio sin reseñas
 *          sigue saliendo sin estrellas.
 *        · `proximasLibres` — saber qué fecha tiene libre un Lugar
 *          cuesta una consulta a `disponibilidad_rancho`, y la portada
 *          no la hace. Con el mapa vacío la tarjeta omite el chip, en
 *          vez de decir «Agotado» sin haber preguntado. El dato
 *          completo está a un clic, en /eventos.
 *
 * ── CÓMO ESCALA ──────────────────────────────────────────────────
 * Con 2 negocios: dos filas cortas, alineadas a la izquierda, sin
 * flechas (no hay desborde que justificarlas) y con su conteo real al
 * lado del título. Con 200: las mismas cuatro filas, cada una recortada
 * a `TOPE_CARRIL` tarjetas, con flechas, y el «Ver todos» llevando al
 * directorio donde están las que no entraron. Ni una línea de código
 * cambia en el medio.
 */

/**
 * Los dos mapas vacíos, declarados UNA vez a nivel de módulo y no
 * dentro del render: son inmutables y compartidos, así que crear cinco
 * `new Map()` por request sería tirar basura al recolector en la URL
 * más visitada del sitio.
 */
const SIN_DISPONIBILIDAD = new Map<string, string | null>();

// Tarjetas "un poco más pequeñas" que las del directorio (pedido del
// dueño, ago 2026): acá cada riel mezcla varias tarjetas por vertical y
// la portada ya trae el buscador + "Explorá por rubro" debajo, así que
// no hace falta que cada tarjeta pelee por el mismo ancho que en
// /eventos. Se pasa como prop a `RielProveedores` — el directorio real
// sigue con su tamaño de siempre.
/**
 * ⚠️ 16/10 Y NO 4/3 — ES LA MITAD DEL PEDIDO, NO UN CAPRICHO.
 *
 * Pedido del dueño (26 ago 2026): «estos cards podés hacerlos un poco
 * más rectangulares y anchos; la altura está bien».
 *
 * Las dos mitades se pelean. La foto manda el alto de la tarjeta, así
 * que ensanchar la tarjeta SOLA la hubiera hecho más alta:
 *
 *     250 px de ancho a 4/3   →  187,5 px de foto
 *     300 px de ancho a 4/3   →  225,0 px de foto   (+37,5 — más alta)
 *     300 px de ancho a 16/10 →  187,5 px de foto   (IGUAL)
 *
 * O sea que la proporción no es un detalle estético: es lo único que
 * deja cumplir «más ancha» y «la altura está bien» a la vez.
 */
const ANCHO_TARJETA_PORTADA = "clamp(250px, 72vw, 360px)";
// El `sizes` sube con el ancho: si se queda en 250 el navegador baja
// una foto para 250 y la estira a 300, y se ve blanda justo en la
// pantalla más visitada del sitio.
const SIZES_TARJETA_PORTADA = "(max-width: 471px) 72vw, 360px";

export default function RielesCatalogo({
  pintables,
  totalPorVertical,
  calificaciones,
  favoritosIds,
  sesionActiva,
  rubro = null,
}: CatalogoPortada & {
  /** El rubro que pidió la URL (`?rubro=`), o null si no hay filtro. */
  rubro?: RubroPortada | null;
}) {
  /**
   * ── EL FILTRO DE LOS ÍCONOS DEL HÉROE ─────────────────────────────
   *
   * Se recorta ANTES de agrupar, no después, y la diferencia se ve: si
   * se filtrara cada riel ya armado, quedarían filas vacías dibujadas
   * con su título y su conteo. Filtrando antes, `agruparPorVertical` ni
   * siquiera devuelve las verticales que no tienen nada —que es la
   * regla de oro nº 1 de este archivo— y la portada muestra solo la
   * fila del rubro pedido.
   *
   * El filtro en sí lo hace `filtrarPorRubro` (carriles-home.ts) y no
   * un `.filter()` escrito acá: la categoría cruda de la base tiene que
   * pasar por la MISMA normalización que aplica cada riel, o un negocio
   * guardado con un alias aparecería en la fila de «Lugares» y
   * desaparecería al tocar el ícono de Lugares.
   */
  // El Map que piden las tarjetas, armado del array serializable que
  // baja del catálogo (ver el porqué del array en home-datos.ts).
  const mapaCalificaciones = new Map<string, Calificacion>(
    (calificaciones ?? []).map((c) => [c.rancho_id, c]),
  );

  const enFoco = rubro ? filtrarPorRubro(pintables, rubro) : pintables;

  // ⚠️ POR RUBRO Y NO POR VERTICAL (pedido del dueño, 26 ago 2026):
  // «separá los carriles: Uñas un riel, Barbería un riel».
  //
  // «Salud y belleza» es vocabulario NUESTRO y mete en la misma fila a
  // un salón de uñas, una barbería y un consultorio. Arriba, la fila de
  // íconos ya dice «Uñas / Barbería / Spa»: tener los dos idiomas en la
  // misma pantalla obliga a traducir entre ellos.
  const rieles = agruparPorRubro(enFoco);

  /**
   * FILTRO PUESTO Y CERO RESULTADOS: hay que decirlo, no desaparecer.
   *
   * Sin este caso, tocar «Uñas» sin ninguna uñería publicada dejaba la
   * portada sin catálogo y sin explicación — el visitante ve el ícono
   * marcado, el resto en blanco, y no tiene forma de saber si filtró
   * bien, si algo falló, o si el sitio está vacío. Con dos negocios en
   * todo el marketplace, este es el camino MÁS probable, no el borde.
   */
  if (rubro && rieles.length === 0) {
    return (
      <div className="rounded-3xl border border-aventurea-line bg-aventurea-cream-2 px-6 py-12 text-center">
        <p className="text-[15px] font-bold text-aventurea-ink">
          {/* El nombre sale del catálogo real (`etiquetaDeCategoria`) y
              no de la URL: `?rubro=citas-belleza` diría «belleza», pero
              la fila se llama «Salones de belleza». Los nueve del héroe
              traen su propia etiqueta corta, que es la que se ve en el
              ícono — para el resto manda el nombre de la fila. */}
          Todavía no hay negocios de{" "}
          {(rubro.label ?? etiquetaDeCategoria(rubro.vertical, rubro.categoria)).toLowerCase()}{" "}
          publicados.
        </p>
        <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          Estamos sumando negocios cada semana. Mientras tanto podés ver todo lo
          que sí hay publicado.
        </p>
        <Link
          href="/#catalogo"
          className="presionable mt-6 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-extrabold text-white transition-colors"
          style={{ background: "var(--navy)" }}
        >
          Ver todo el catálogo
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  // Sin un solo negocio publicado no hay catálogo que mostrar. La
  // portada sigue de pie: arriba queda el buscador con sus rubros, y
  // abajo la franja «Explorá por rubro» y el llamado a publicar.
  if (rieles.length === 0) return null;

  const favoritos = new Set(favoritosIds);

  // El riel transversal solo se dibuja cuando aporta algo que las filas
  // de abajo no muestran ya — el porqué completo está en
  // `hayFondoParaRecienPublicados`.
  const conRecientes = hayFondoParaRecienPublicados(
    pintables.length,
    rieles.length,
  );
  // `pintables` ya viene ordenado por `created_at` descendente desde la
  // consulta: «lo más nuevo» es literalmente el principio de la lista.
  const recientes = conRecientes ? pintables.slice(0, TOPE_CARRIL) : [];

  return (
    <div className="flex flex-col gap-5 sm:gap-7">
      {conRecientes && (
        <RielProveedores
          titulo="Recién publicados"
          subtitulo="Lo último que se sumó al directorio, de todas las categorías."
          items={recientes}
          // SIN «Ver todos»: no existe una página que liste las cuatro
          // verticales juntas, y mandar a /eventos desde una fila que
          // mezcla barberías con salones sería un enlace que promete una
          // lista y entrega otra. Todo lo que hay acá vuelve a aparecer,
          // ordenado, en la fila de su vertical.
          calificaciones={mapaCalificaciones}
          proximasLibres={SIN_DISPONIBILIDAD}
          favoritosIds={favoritos}
          sesionActiva={sesionActiva}
          // SIN la unidad del precio: la fila mezcla verticales y
          // `unidad_precio` arrastra el 'evento' por defecto de la 0033,
          // así que «desde ₡1.500 por evento» debajo de una barbería
          // sería falso. El monto sí es cierto.
          // Es la primera lista de la página: su primera foto es el LCP
          // medido y va con prioridad alta. Ninguna otra la pide, o
          // serían cinco imágenes compitiendo por el mismo ancho de
          // banda.
          prioridad
          anchoTarjeta={ANCHO_TARJETA_PORTADA}
          sizesTarjeta={SIZES_TARJETA_PORTADA}
        />
      )}

      {rieles.map((riel, i) => (
        <RielProveedores
          key={riel.vertical}
          titulo={riel.titulo}
          // El conteo sale de `totalPorVertical` y no de `riel.total`:
          // el primero cuenta lo que el directorio de destino LISTA
          // (aprobados, «en configuración» incluidos) y el segundo solo
          // lo que este riel puede pintar. Ver el tipo `CatalogoPortada`.
          // El `??` es por si una vertical nueva no llegó al mapa.
          conteo={totalPorVertical[riel.vertical] ?? riel.total}
          items={riel.items}
          verTodoHref={riel.verTodoHref}
          verTodoTexto="Ver todos →"
          calificaciones={mapaCalificaciones}
          proximasLibres={SIN_DISPONIBILIDAD}
          favoritosIds={favoritos}
          sesionActiva={sesionActiva}
          // Adentro de una vertical la unidad SÍ describe lo que se
          // está mirando… salvo en Salud y belleza, donde el 'evento'
          // por defecto de la 0033 sigue pegado a negocios que cobran
          // por servicio. Se muestra solo en Eventos y Hospedajes, que
          // es donde `unidad_precio` significa algo.
          // La primera foto de la página pide prioridad UNA sola vez.
          prioridad={!conRecientes && i === 0}
          anchoTarjeta={ANCHO_TARJETA_PORTADA}
          sizesTarjeta={SIZES_TARJETA_PORTADA}
        />
      ))}
    </div>
  );
}
