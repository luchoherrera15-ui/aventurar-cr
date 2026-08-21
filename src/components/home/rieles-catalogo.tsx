import RielProveedores from "@/components/riel-proveedores";
import type { Calificacion } from "@/components/rancho-card";
import {
  TOPE_CARRIL,
  agruparPorVertical,
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
 *        · `calificaciones` — la tarjeta solo pinta estrellas si le
 *          llega una calificación. Un mapa vacío es exactamente
 *          «todavía nadie reseñó», que es la verdad.
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
const SIN_CALIFICACIONES = new Map<string, Calificacion>();
const SIN_DISPONIBILIDAD = new Map<string, string | null>();

export default function RielesCatalogo({
  pintables,
  totalPorVertical,
  favoritosIds,
  sesionActiva,
}: CatalogoPortada) {
  const rieles = agruparPorVertical(pintables);

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
          calificaciones={SIN_CALIFICACIONES}
          proximasLibres={SIN_DISPONIBILIDAD}
          favoritosIds={favoritos}
          sesionActiva={sesionActiva}
          // SIN la unidad del precio: la fila mezcla verticales y
          // `unidad_precio` arrastra el 'evento' por defecto de la 0033,
          // así que «desde ₡1.500 por evento» debajo de una barbería
          // sería falso. El monto sí es cierto.
          conUnidad={false}
          // Es la primera lista de la página: su primera foto es el LCP
          // medido y va con prioridad alta. Ninguna otra la pide, o
          // serían cinco imágenes compitiendo por el mismo ancho de
          // banda.
          prioridad
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
          calificaciones={SIN_CALIFICACIONES}
          proximasLibres={SIN_DISPONIBILIDAD}
          favoritosIds={favoritos}
          sesionActiva={sesionActiva}
          // Adentro de una vertical la unidad SÍ describe lo que se
          // está mirando… salvo en Salud y belleza, donde el 'evento'
          // por defecto de la 0033 sigue pegado a negocios que cobran
          // por servicio. Se muestra solo en Eventos y Hospedajes, que
          // es donde `unidad_precio` significa algo.
          conUnidad={riel.vertical === "eventos" || riel.vertical === "hospedajes"}
          // La primera foto de la página pide prioridad UNA sola vez.
          prioridad={!conRecientes && i === 0}
        />
      ))}
    </div>
  );
}
