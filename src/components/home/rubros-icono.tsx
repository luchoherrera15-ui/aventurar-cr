import Link from "next/link";
import { categoriaIcono } from "@/lib/categorias-vertical";
import { urlDirectorio } from "@/lib/url-directorio";
import { leerCenso } from "@/lib/censo-rubros";

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

/** Qué rubros se ofrecen, y de qué vertical es cada uno. */
const RUBROS: { vertical: string; categoria: string; label: string }[] = [
  { vertical: "citas", categoria: "unas", label: "Uñas" },
  { vertical: "citas", categoria: "belleza", label: "Belleza" },
  { vertical: "citas", categoria: "barberia", label: "Barbería" },
  { vertical: "citas", categoria: "spa", label: "Spa" },
  { vertical: "citas", categoria: "consultorio", label: "Salud" },
  { vertical: "eventos", categoria: "lugares", label: "Lugares" },
  { vertical: "eventos", categoria: "alimentacion", label: "Catering" },
  { vertical: "eventos", categoria: "animacion", label: "Música" },
  { vertical: "eventos", categoria: "decoracion", label: "Decoración" },
];

const DIRECTORIO: Record<string, string> = {
  citas: "/citas",
  eventos: "/eventos",
};

export default async function RubrosIcono() {
  const censo = await leerCenso();

  const conOrden = RUBROS.map((r) => ({
    ...r,
    href: urlDirectorio(DIRECTORIO[r.vertical] ?? "/eventos", { categoria: r.categoria }),
    // La clave del censo es `vertical|categoria|subcategoria`, con los
    // huecos vacíos. Es la misma que arma `claveDeDestino` para el menú.
    cuantos: censo.porClave[`${r.vertical}|${r.categoria}|`] ?? 0,
  })).sort((a, b) => (b.cuantos > 0 ? 1 : 0) - (a.cuantos > 0 ? 1 : 0));

  return (
    <nav
      aria-label="Rubros para reservar"
      /* Scrollea en horizontal en el teléfono en vez de partirse en dos
         renglones: nueve rubros en dos filas se leen como una lista, y
         esto es una barra de atajos. `scrollbar-width: none` esconde el
         control feo sin quitar el gesto ni el teclado — mismo patrón que
         ya usa el riel de proveedores. */
      className="mt-8 flex justify-start gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center"
      style={{ scrollbarWidth: "none" }}
    >
      {conOrden.map((r) => (
        <Link
          key={`${r.vertical}-${r.categoria}`}
          href={r.href}
          className="group flex shrink-0 flex-col items-center gap-2 rounded-2xl px-3 py-2 transition-colors hover:bg-white/70"
        >
          <span
            aria-hidden
            /* El disco es blanco sólido y no un tinte translúcido: abajo
               está la aurora, que se mueve, y un fondo translúcido haría
               que el ícono cambiara de contraste solo. */
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[color:var(--navy)] shadow-[0_6px_18px_-8px_rgba(16,47,82,0.35)] transition-transform duration-200 group-hover:-translate-y-0.5 [&_svg]:h-6 [&_svg]:w-6"
          >
            {categoriaIcono(r.vertical, r.categoria)}
          </span>
          <span className="whitespace-nowrap text-[12.5px] font-bold text-aventurea-ink">
            {r.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
