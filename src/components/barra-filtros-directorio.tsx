import Link from "next/link";
import { IconCompass, IconSearch } from "@/components/icons";

/**
 * La barra de los directorios: buscador y, debajo, la fila de
 * categorías.
 *
 * Los chips son los mismos de /eventos (CategoriaTab): píldora con el
 * ícono en su burbuja naranja, navy cuando está activa. La fila
 * scrollea en horizontal, así que 6 categorías o 18 ocupan siempre una
 * sola línea de pantalla.
 *
 * Sin conteos a propósito: el "(4)" de cada categoría no ayudaba a
 * decidir y llenaba la barra de paréntesis.
 *
 * Todo con <Link> y un form GET — cero JavaScript, la página sigue
 * siendo un server component.
 */

export type OpcionCategoria = {
  /** El valor que va en ?categoria= */
  valor: string;
  label: string;
  icono: React.ReactNode;
};

export default function BarraFiltrosDirectorio({
  ruta,
  placeholder,
  ariaLabel,
  categoria,
  busqueda,
  opciones,
  resultados,
}: {
  /** "/citas", "/restaurantes"... — a dónde apunta el form y los chips. */
  ruta: string;
  placeholder: string;
  /** El aria-label del input de búsqueda. */
  ariaLabel: string;
  /** La categoría aplicada, si hay alguna. */
  categoria?: string;
  busqueda: string;
  /** Las categorías en su orden oficial. */
  opciones: OpcionCategoria[];
  /** Cuántos quedaron — solo se muestra cuando hay búsqueda. */
  resultados: number;
}) {
  /** La URL del directorio conservando la búsqueda al cambiar de chip. */
  const url = (cat: string | undefined): string => {
    const p = new URLSearchParams();
    if (cat) p.set("categoria", cat);
    if (busqueda) p.set("q", busqueda);
    const query = p.toString();
    return query ? `${ruta}?${query}` : ruta;
  };

  return (
    <>
      <form method="get" action={ruta} className="relative mx-auto max-w-[640px]">
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-aventurea-ink-soft" />
        <input
          type="search"
          name="q"
          aria-label={ariaLabel}
          defaultValue={busqueda}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-aventurea-line bg-white pl-11 pr-4 text-[13.5px] text-aventurea-ink shadow-sm transition-shadow placeholder:text-zinc-500 hover:shadow-md focus:border-aventurea-navy focus:outline-none"
        />
      </form>

      {/* La fila de categorías. El degradado de la derecha avisa que
          hay más para el lado cuando la fila no cabe entera. */}
      <div className="relative mt-3">
        <div className="flex gap-2.5 overflow-x-auto py-1 lg:justify-center">
          <ChipCategoria
            href={url(undefined)}
            label="Todos"
            icono={<IconCompass />}
            activo={!categoria}
          />
          {opciones.map((o) => (
            <ChipCategoria
              key={o.valor}
              href={url(o.valor)}
              label={o.label}
              icono={o.icono}
              activo={categoria === o.valor}
            />
          ))}
          {/* Relleno para que el degradado no tape el último chip. */}
          <div className="w-2 shrink-0" aria-hidden />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-aventurea-cream-2 to-transparent lg:hidden"
        />
      </div>

      {/* Solo cuando se buscó algo: cuántos hay y cómo soltar la
          búsqueda. Sin búsqueda, la barra queda limpia. */}
      {busqueda && (
        <p className="mt-2 text-center text-[12.5px] font-semibold text-aventurea-ink-soft">
          {resultados} {resultados === 1 ? "resultado" : "resultados"} para “
          {busqueda}”{" "}
          <Link
            href={categoria ? `${ruta}?categoria=${categoria}` : ruta}
            className="font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange"
          >
            limpiar
          </Link>
        </p>
      )}
    </>
  );
}

/**
 * Chip de categoría con el ícono en su burbuja naranja — el mismo de
 * la barra de /eventos, pero con <Link> en vez de botón porque acá el
 * filtro vive en la URL.
 */
function ChipCategoria({
  href,
  label,
  icono,
  activo,
}: {
  href: string;
  label: string;
  icono: React.ReactNode;
  activo: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border pl-1.5 pr-4 transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-aventurea-surface text-aventurea-ink hover:border-aventurea-navy"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px] ${
          activo
            ? "bg-white/15 text-white"
            : "bg-aventurea-sky/10 text-aventurea-orange"
        }`}
      >
        {icono}
      </span>
      <span className="text-[13px] font-bold">{label}</span>
    </Link>
  );
}
