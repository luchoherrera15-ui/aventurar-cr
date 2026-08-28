import Link from "next/link";
import { categoriaIcono } from "@/lib/categorias-vertical";
import {
  IconCera,
  IconCrema,
  IconLabial,
  IconMail,
  IconOjoPestanas,
  IconPeine,
  IconPiedras,
  IconSparkles,
  IconVapor,
} from "@/components/icons";
import { RUBROS_PORTADA, urlDeRubro, type RubroPortada } from "@/lib/rubros-portada";
import { SUBCATEGORIA_CITA_LABEL } from "@/app/citas/subcategorias";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA GRILLA DE RUBROS CON ÍCONO — la puerta rápida del héroe
 * ════════════════════════════════════════════════════════════════════
 *
 * Reemplaza al par de pestañas «Citas y servicios / Eventos» que había
 * arriba del buscador, y desde el 28 ago 2026 va en DOS CARRILES
 * (pedido del dueño, con dibujo encima de la captura: «más o menos como
 * se ven los cuadros rojos… la lista de iconos igual, de dos carriles»).
 * Una sola fila con dieciocho discos scrolleaba media pantalla; en dos
 * pisos la misma oferta cabe en el ancho del buscador.
 *
 * ── CUATRO GRUPOS, SEPARADOS POR LA LÍNEA DE SIEMPRE ────────────────
 *
 *   Belleza y barbería │ Spa y salud │ Eventos │ Para tu negocio
 *
 * El ejemplo del dueño, literal: «Salud Belleza (ahí dentro irán
 * pestañas, uñas, pelo, depilación, cabello y peinado, barbería,
 * estética); luego por otra división… tipo masajes y esas cosas». Los
 * dos últimos grupos son los que ya existían: eventos, y los dos
 * productos que Bookea le vende al negocio.
 *
 * ── CADA DISCO NUEVO FILTRA DE VERDAD ───────────────────────────────
 *
 * Los discos finos (Pestañas, Peinados, Depilación…) no son adorno:
 * cada uno es una SUBCATEGORÍA real de la 0188 y arma su URL con
 * `urlDeRubro(vertical, categoria, sub)` — el mismo embudo del mega
 * menú. `rubroDeParametro` ya lee `?sub=` y `filtrarPorRubro` ya
 * recorta por ella, así que acá no se agregó ni una regla de filtro.
 * Un id con typo revienta el build (ver `sub()`), no una pantalla.
 *
 * ── LOS IDS NO SE ESCRIBEN DOS VECES ────────────────────────────────
 *
 * Las categorías salen de `RUBROS_PORTADA` (por `dePortada`) y las
 * subcategorías se validan contra `SUBCATEGORIA_CITA_LABEL`: escribir
 * una lista propia acá es exactamente cómo esta fila se despegaría de
 * la taxonomía — y `CLAUDE.md` prohíbe inventar categorías.
 *
 * ── EL ORDEN YA NO LO DECIDE EL CENSO ───────────────────────────────
 *
 * La versión de una fila ordenaba por inventario («el primer clic debe
 * caer en una lista con contenido»). Con la grilla curada el principio
 * se cumple por diseño: Uñas y Lugares —los únicos rubros con negocios
 * hoy— encabezan su grupo. Un orden dinámico además rompería las
 * PAREJAS: en `grid-flow-col` cada dos entradas consecutivas son una
 * columna, y (Uñas/Pestañas), (Barbería/Peinados) están emparejados a
 * propósito.
 *
 * Componente de SERVIDOR, y ya no async: al soltar el censo no queda
 * nada que esperar.
 */

type Disco = RubroPortada & {
  /** El trazo propio de una subcategoría; las categorías caen en
   *  `categoriaIcono`, el mismo reparto de siempre. */
  icono?: React.ReactNode;
};

/** La entrada de `RUBROS_PORTADA` de esta categoría — ids de una sola
 *  fuente. Si la categoría no está en la lista, es un typo de este
 *  archivo y el build tiene que decirlo. */
function dePortada(categoria: string): RubroPortada {
  const r = RUBROS_PORTADA.find((x) => x.categoria === categoria);
  if (!r) throw new Error(`Rubro desconocido en la grilla del héroe: ${categoria}`);
  return r;
}

/**
 * Un disco de subcategoría. El label se puede acortar para el rótulo
 * («Pestañas» por «Cejas y pestañas», «Estética» por «Tratamientos
 * faciales», «Sauna» por «Sauna y jacuzzi» — palabras del dueño), pero
 * el ID es el de la base, letra por letra, y un id inventado tira el
 * build acá mismo en vez de producir un filtro que nunca encuentra nada.
 */
function sub(
  categoria: string,
  id: string,
  label: string,
  icono: React.ReactNode,
): Disco {
  if (!(id in SUBCATEGORIA_CITA_LABEL)) {
    throw new Error(`Subcategoría desconocida en la grilla del héroe: ${id}`);
  }
  return { ...dePortada(categoria), subcategoria: id, label, icono };
}

/* En `grid-flow-col grid-rows-2`, cada DOS entradas consecutivas forman
   una columna: el orden de estas listas es (arriba, abajo), (arriba,
   abajo)… Las parejas están elegidas, no heredadas. */

/** Carril 1 · lo que el dueño llamó «Salud Belleza»: 4 columnas. */
const BELLEZA: Disco[] = [
  dePortada("unas"),
  sub("belleza", "cejas_pestanas", "Pestañas", <IconOjoPestanas />),
  dePortada("barberia"),
  sub("belleza", "peinados", "Peinados", <IconPeine />),
  dePortada("belleza"),
  sub("belleza", "maquillaje", "Maquillaje", <IconLabial />),
  sub("belleza", "depilacion", "Depilación", <IconCera />),
  sub("belleza", "tratamientos_faciales", "Estética", <IconCrema />),
];

/** Carril 2 · «masajes y esas cosas», más Salud: 2 columnas. */
const BIENESTAR: Disco[] = [
  dePortada("spa"),
  sub("spa", "masajes", "Masajes", <IconPiedras />),
  dePortada("consultorio"),
  sub("spa", "sauna_jacuzzi", "Sauna", <IconVapor />),
];

/** Carril 3 · lo de eventos, igual que siempre: 2 columnas. */
const EVENTOS: Disco[] = [
  dePortada("lugares"),
  dePortada("alimentacion"),
  dePortada("animacion"),
  dePortada("decoracion"),
];

/**
 * Lo que Bookea le vende AL NEGOCIO, a la derecha de la última línea.
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

/* Las clases se declaran una vez: todos los discos son el mismo objeto
   y repetir la cadena en dos `map` es cómo se despegan. */
const DISCO_ENVOLTORIO =
  "group flex shrink-0 flex-col items-center gap-1.5 rounded-2xl px-2.5 py-1.5 transition-colors hover:bg-white/70";

const DISCO_BASE =
  "flex h-12 w-12 items-center justify-center rounded-full shadow-[0_6px_18px_-8px_rgba(16,47,82,0.35)] transition-transform duration-200 group-hover:-translate-y-0.5 [&_svg]:h-[22px] [&_svg]:w-[22px]";

/* El disco es blanco SÓLIDO y no un tinte translúcido: abajo está la
   aurora, que se mueve, y un fondo translúcido haría que el ícono
   cambiara de contraste solo. */
const DISCO = `${DISCO_BASE} bg-white text-[color:var(--navy)]`;

const ROTULO = "whitespace-nowrap text-[12px] font-bold text-aventurea-ink";

/** Los dos pisos de un grupo. `gap-y-1` corto: las dos filas son la
 *  misma lista, no dos listas. */
const GRUPO = "grid grid-flow-col grid-rows-2 gap-y-1";

export default function RubrosIcono({
  /** El rubro que la URL está filtrando ahora — `vertical-categoria`,
   *  con `|sub` pegado si el filtro trae subcategoría. Lo arma
   *  `page.tsx` con la MISMA forma que `claveDe` acá abajo. */
  activo = null,
}: {
  activo?: string | null;
}) {
  return (
    <nav
      aria-label="Rubros para reservar"
      /* Scrollea en horizontal en el teléfono: la grilla de dos pisos
         viaja ENTERA como una sola pieza. `scrollbar-width: none`
         esconde el control feo sin quitar el gesto ni el teclado —
         mismo patrón que el riel de proveedores. El `w-max mx-auto` de
         adentro centra la grilla cuando sobra ancho y deja scrollear
         cuando falta. */
      className="mt-6 overflow-x-auto pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {/* ⚠️ ACÁ VIVIÓ UN DISCO «TODOS» DURANTE UNAS HORAS (26 ago 2026).
          El dueño lo pidió como vuelta visible del filtro y él mismo lo
          sacó al verlo: «descuadra todo». La vuelta queda SOLO en el
          gesto: el disco activo apunta a «/» y tocarlo de nuevo quita
          el filtro (ver `DiscoRubro`). Si alguien vuelve a pedir «no
          hay forma de volver a todos», la respuesta NO es revivir ese
          disco: es hacer visible el gesto, no sumar una ficha que
          compite con los rubros reales. */}
      <div className="mx-auto flex w-max items-stretch gap-0.5 px-2 sm:gap-1.5">
        <div className={GRUPO}>
          {BELLEZA.map((r) => (
            <DiscoRubro key={claveDe(r)} rubro={r} activo={activo} />
          ))}
        </div>

        <Separador />

        <div className={GRUPO}>
          {BIENESTAR.map((r) => (
            <DiscoRubro key={claveDe(r)} rubro={r} activo={activo} />
          ))}
        </div>

        <Separador />

        <div className={GRUPO}>
          {EVENTOS.map((r) => (
            <DiscoRubro key={claveDe(r)} rubro={r} activo={activo} />
          ))}
        </div>

        {/* ── LA ÚLTIMA LÍNEA: LO QUE BOOKEA LE VENDE AL NEGOCIO ─────
            Vivían en un menú «Más servicios» arriba a la derecha. El
            dueño los bajó a la fila (ago 2026): en el menú casi nadie
            los abría, y son dos de los productos que más le importan.
            En la grilla ocupan una sola columna, cerrando la fila. */}
        <Separador />

        <div className={GRUPO}>
          {NEGOCIO.map((n) => (
            <Link key={n.href} href={n.href} className={DISCO_ENVOLTORIO}>
              <span
                aria-hidden
                /* Estos dos van en tinte naranja y no en blanco: es la
                   misma señal que el resto del sitio usa para lo que es
                   de Bookea y no del catálogo. */
                className={`${DISCO_BASE} bg-aventurea-orange-light text-bookea-naranja-fuerte`}
              >
                <n.Icono />
              </span>
              <span className={ROTULO}>{n.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

/** La clave de estado de un disco — la misma forma que arma `page.tsx`
 *  para `activo`, así que comparar strings ES comparar filtros. */
function claveDe(r: Disco): string {
  return `${r.vertical}-${r.categoria}${r.subcategoria ? `|${r.subcategoria}` : ""}`;
}

/**
 * La línea vertical que separa dos grupos.
 *
 * Antes iba `hidden sm:block` porque en una fila que scrollea una raya
 * suelta no separaba nada. Con la grilla de dos pisos sí: cruza los dos
 * carriles de punta a punta y se lee como el borde del grupo, también
 * en el teléfono.
 */
function Separador() {
  return (
    <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-aventurea-line" />
  );
}

/** Un disco de rubro, con su estado de filtro activo. */
function DiscoRubro({
  rubro,
  activo,
}: {
  rubro: Disco;
  activo: string | null;
}) {
  const esActivo = claveDe(rubro) === activo;
  return (
    <Link
      /* El disco activo se apaga al volver a tocarlo: sin esto, el único
         modo de quitar el filtro sería encontrar el botón de «quitar»
         que vive abajo, en el catálogo, fuera de la vista. Un filtro que
         se pone con un clic tiene que sacarse con el mismo clic. */
      href={esActivo ? "/" : urlDeRubro(rubro.vertical, rubro.categoria, rubro.subcategoria)}
      aria-current={esActivo ? "true" : undefined}
      className={`${DISCO_ENVOLTORIO} ${esActivo ? "bg-white/80" : ""}`}
    >
      <span
        aria-hidden
        className={`${DISCO} ${
          esActivo ? "ring-2 ring-[color:var(--navy)] ring-offset-2 ring-offset-transparent" : ""
        }`}
      >
        {rubro.icono ?? categoriaIcono(rubro.vertical, rubro.categoria)}
      </span>
      <span className={`${ROTULO} ${esActivo ? "text-[color:var(--navy)]" : ""}`}>
        {rubro.label}
      </span>
    </Link>
  );
}
