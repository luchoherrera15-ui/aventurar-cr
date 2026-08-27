import Link from "next/link";
import { categoriaIcono } from "@/lib/categorias-vertical";
import { IconMail, IconSparkles } from "@/components/icons";
import { leerCenso } from "@/lib/censo-rubros";
import { RUBROS_PORTADA, urlDeRubro } from "@/lib/rubros-portada";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA FILA DE RUBROS CON ÍCONO — la puerta rápida del héroe
 * ════════════════════════════════════════════════════════════════════
 *
 * Reemplaza al par de pestañas «Citas y servicios / Eventos» que había
 * arriba del buscador. Ese control obligaba a elegir una vertical antes
 * de saber qué había adentro — y «vertical» es vocabulario nuestro, no
 * de quien entra a reservar. Con los íconos, la persona ve DIRECTO lo
 * que puede pedir: Uñas, Barbería, Spa, Lugares.
 *
 * ── LOS ÍCONOS Y LOS NOMBRES NO SE ESCRIBEN ACÁ ─────────────────────
 *
 * Salen de `categoriaIcono` y `categoriaOptions`, que es el MISMO par
 * que usan el directorio y las tarjetas de negocio. Escribir una lista
 * a mano acá habría creado una segunda taxonomía que se despega a la
 * primera categoría nueva — y `CLAUDE.md` prohíbe inventar categorías.
 *
 * ── SE ORDENAN POR INVENTARIO REAL ──────────────────────────────────
 *
 * Primero los rubros que TIENEN negocios, y después el resto. No se
 * esconde ninguno: acá la fila es una puerta de exploración, no una
 * promesa de lista llena como sí lo es cada renglón del mega menú. Pero
 * el que tiene algo va adelante, para que el primer clic de alguien que
 * llega caiga en una lista con contenido.
 *
 * El conteo NO se pinta. Con dos negocios en todo el marketplace, un
 * «1» al lado de Barbería dice más de lo que conviene y no ayuda a
 * decidir.
 *
 * Componente de SERVIDOR: el censo se resuelve acá y viaja ya ordenado.
 */

/**
 * ── LOS NUEVE ÍCONOS YA NO SACAN A NADIE DE LA PORTADA ──────────────
 *
 * Antes cada uno era un link a `/citas?categoria=unas` o
 * `/eventos?categoria=lugares`. Pedido del dueño (ago 2026): «quiero
 * que esto YA DEJE DE SER ASÍ, la idea es que TODO se encuentre acá
 * mismo». Ahora apuntan a `/?rubro=…`, que filtra el catálogo de abajo
 * sin cambiar de página.
 *
 * La lista se fue a `@/lib/rubros-portada` porque ahora la leen dos
 * lados que TIENEN que coincidir: acá, para armar los links, y
 * `rieles-catalogo.tsx`, para recortar el catálogo. Con la lista adentro
 * de este archivo, agregar un rubro obligaba a acordarse del otro lado y
 * nada avisaba cuando no se hacía.
 */

/**
 * Lo que Bookea le vende AL NEGOCIO, a la derecha de la línea.
 *
 * No son rubros que alguien reserve: son productos. Por eso van
 * separados y con otro color de disco — mezclarlos con «Uñas» y
 * «Barbería» haría que quien busca dónde cortarse el pelo se tropiece
 * con un producto de software.
 */
const NEGOCIO = [
  { href: "/invitaciones", label: "Invitaciones", Icono: IconMail },
  { href: "/lealtad", label: "Lealtad", Icono: IconSparkles },
];

/* Las clases se declaran una vez: los once discos son el mismo objeto y
   repetir la cadena en dos `map` es cómo se despegan. */
const DISCO_ENVOLTORIO =
  "group flex shrink-0 flex-col items-center gap-2 rounded-2xl px-3 py-2 transition-colors hover:bg-white/70";

const DISCO_BASE =
  "flex h-14 w-14 items-center justify-center rounded-full shadow-[0_6px_18px_-8px_rgba(16,47,82,0.35)] transition-transform duration-200 group-hover:-translate-y-0.5 [&_svg]:h-6 [&_svg]:w-6";

/* El disco es blanco SÓLIDO y no un tinte translúcido: abajo está la
   aurora, que se mueve, y un fondo translúcido haría que el ícono
   cambiara de contraste solo. */
const DISCO = `${DISCO_BASE} bg-white text-[color:var(--navy)]`;

const ROTULO = "whitespace-nowrap text-[12.5px] font-bold text-aventurea-ink";

export default async function RubrosIcono({
  /** El rubro que la URL está filtrando ahora, si hay alguno. */
  activo = null,
}: {
  activo?: string | null;
}) {
  const censo = await leerCenso();

  const conDatos = RUBROS_PORTADA.map((r) => ({
    ...r,
    href: urlDeRubro(r.vertical, r.categoria),
    // La clave del censo es `vertical|categoria|subcategoria`, con los
    // huecos vacíos. Es la misma que arma `claveDeDestino` para el menú.
    cuantos: censo.porClave[`${r.vertical}|${r.categoria}|`] ?? 0,
  }));

  /**
   * ── DOS GRUPOS, SEPARADOS POR LA LÍNEA (pedido del dueño, ago 2026)
   *
   * A la izquierda todo lo de citas —barbería, uñas, belleza, spa,
   * salud—; a la derecha lo de eventos —lugares, catering, música,
   * decoración—. Antes iban los nueve revueltos y ordenados solo por
   * inventario, así que «Lugares» (un salón de fiestas) caía entre
   * «Barbería» y «Uñas»: la fila no dejaba leer que son dos catálogos
   * distintos.
   *
   * ⚠️ EL ORDEN POR INVENTARIO NO SE PERDIÓ, SE METIÓ ADENTRO. Dentro
   * de cada grupo siguen adelante los rubros que TIENEN negocios, para
   * que el primer clic caiga en una lista con contenido. Ordenar el
   * arreglo entero como antes habría deshecho la separación.
   */
  const porInventario = <T extends { cuantos: number }>(lista: T[]) =>
    [...lista].sort((a, b) => (b.cuantos > 0 ? 1 : 0) - (a.cuantos > 0 ? 1 : 0));

  const deCitas = porInventario(conDatos.filter((r) => r.vertical === "citas"));
  const deEventos = porInventario(conDatos.filter((r) => r.vertical === "eventos"));

  return (
    <nav
      aria-label="Rubros para reservar"
      /* Scrollea en horizontal en el teléfono en vez de partirse en dos
         renglones: nueve rubros en dos filas se leen como una lista, y
         esto es una barra de atajos. `scrollbar-width: none` esconde el
         control feo sin quitar el gesto ni el teclado — mismo patrón que
         ya usa el riel de proveedores. */
      className="mt-6 flex justify-start gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center"
      style={{ scrollbarWidth: "none" }}
    >
      {/* ⚠️ ACÁ VIVIÓ UN DISCO «TODOS» DURANTE UNAS HORAS (26 ago 2026).
          El dueño lo pidió como vuelta visible del filtro y él mismo lo
          sacó al verlo: «descuadra todo». Tenía razón — su ícono no
          venía de `categoriaIcono` como el resto y rompía la fila.

          La vuelta queda SOLO en el gesto: el rubro activo apunta a «/»
          y tocarlo de nuevo quita el filtro (ver `DiscoRubro`). Si
          alguien vuelve a pedir «no hay forma de volver a todos», la
          respuesta NO es revivir este disco: es hacer visible el gesto
          (un rótulo bajo el activo, un aro que invite), no sumar una
          ficha que compite con los rubros reales. */}

      {/* IZQUIERDA · lo que se reserva por hora: barbería, uñas, spa… */}
      {deCitas.map((r) => (
        <DiscoRubro key={`${r.vertical}-${r.categoria}`} rubro={r} activo={activo} />
      ))}

      <Separador />

      {/* DERECHA · lo que se reserva por fecha: lugares, catering, música… */}
      {deEventos.map((r) => (
        <DiscoRubro key={`${r.vertical}-${r.categoria}`} rubro={r} activo={activo} />
      ))}

      {/* ── LA TERCERA LÍNEA: LO QUE BOOKEA LE VENDE AL NEGOCIO ──────
          Invitaciones y Lealtad no son rubros que alguien reserve: son
          productos. Sin una línea propia, quien busca dónde cortarse el
          pelo se encontraría «Planes de lealtad» en la misma fila y con
          el mismo peso.

          Vivían en un menú «Más servicios» arriba a la derecha. El dueño
          los bajó a la fila (ago 2026): en el menú casi nadie los abría,
          y son dos de los productos que más le importan. */}
      <Separador />

      {NEGOCIO.map((n) => (
        <Link key={n.href} href={n.href} className={DISCO_ENVOLTORIO}>
          <span
            aria-hidden
            /* Estos dos van en tinte naranja y no en blanco: es la
               misma señal que el resto del sitio usa para lo que es de
               Bookea y no del catálogo. */
            className={`${DISCO_BASE} bg-aventurea-orange-light text-bookea-naranja-fuerte`}
          >
            <n.Icono />
          </span>
          <span className={ROTULO}>{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * La línea vertical que separa dos grupos de la fila.
 *
 * `hidden sm:block`: en el teléfono la fila SCROLLEA en horizontal, así
 * que un separador vertical no separa nada — se lo lleva el mismo
 * gesto que a los íconos y solo roba ancho a la barra de atajos.
 */
function Separador() {
  return (
    <span
      aria-hidden
      className="mx-1 hidden h-12 w-px shrink-0 self-center bg-aventurea-line sm:block"
    />
  );
}

/** Un disco de rubro, con su estado de filtro activo. */
function DiscoRubro({
  rubro,
  activo,
}: {
  rubro: { vertical: string; categoria: string; label?: string; href: string };
  activo: string | null;
}) {
  const esActivo = `${rubro.vertical}-${rubro.categoria}` === activo;
  return (
    <Link
      /* El rubro activo se apaga al volver a tocarlo: sin esto, el único
         modo de quitar el filtro sería encontrar el botón de «quitar»
         que vive abajo, en el catálogo, fuera de la vista. Un filtro que
         se pone con un clic tiene que sacarse con el mismo clic. */
      href={esActivo ? "/" : rubro.href}
      aria-current={esActivo ? "true" : undefined}
      className={`${DISCO_ENVOLTORIO} ${esActivo ? "bg-white/80" : ""}`}
    >
      <span
        aria-hidden
        className={`${DISCO} ${
          esActivo ? "ring-2 ring-[color:var(--navy)] ring-offset-2 ring-offset-transparent" : ""
        }`}
      >
        {categoriaIcono(rubro.vertical, rubro.categoria)}
      </span>
      <span className={`${ROTULO} ${esActivo ? "text-[color:var(--navy)]" : ""}`}>
        {rubro.label}
      </span>
    </Link>
  );
}
