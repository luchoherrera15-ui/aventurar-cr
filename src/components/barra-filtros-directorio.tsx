import Link from "next/link";
import { IconFiltro, IconSearch, IconX } from "@/components/icons";

/**
 * La barra de filtros de los directorios: buscador + botón de filtros.
 *
 * Nace de un problema concreto: las categorías salían como una tira de
 * chips y comían dos o tres líneas de pantalla antes de que el
 * visitante viera un solo negocio. Acá las categorías viven dentro de
 * un panel y afuera solo queda lo que está usando de verdad — la
 * búsqueda y los filtros aplicados, cada uno con su ✕.
 *
 * El panel es un <details> nativo: se abre sin una gota de JavaScript,
 * así que la página sigue siendo un server component.
 *
 * La usan /citas y /restaurantes; sirve igual para cualquier
 * directorio que filtre por una categoría y una búsqueda.
 */

export type OpcionCategoria = {
  /** El valor que va en ?categoria= */
  valor: string;
  label: string;
  conteo: number;
};

export default function BarraFiltrosDirectorio({
  ruta,
  placeholder,
  ariaLabel,
  tituloPanel,
  quitarCategoria,
  categoria,
  labelCategoria,
  busqueda,
  opciones,
  totalSinFiltro,
  resultados,
}: {
  /** "/citas", "/restaurantes"... — a dónde apunta el form y los links. */
  ruta: string;
  placeholder: string;
  /** El aria-label del input de búsqueda. */
  ariaLabel: string;
  /** El encabezado dentro del panel: "Tipo de comida", "Servicio"... */
  tituloPanel: string;
  /** El aria-label del ✕ de la categoría: "Quitar el filtro de comida". */
  quitarCategoria: string;
  /** La categoría aplicada, si hay alguna. */
  categoria?: string;
  /** Su nombre legible, para el chip. */
  labelCategoria?: string;
  busqueda: string;
  /** Las categorías con al menos un resultado, en su orden oficial. */
  opciones: OpcionCategoria[];
  /** Cuántos hay sin filtrar por categoría — el conteo de "Todos". */
  totalSinFiltro: number;
  /** Cuántos quedaron después de aplicar todo. */
  resultados: number;
}) {
  /**
   * La URL del directorio con la combinación pedida de categoría y
   * búsqueda. Cada filtro se puede cambiar o soltar sin arrastrar al
   * otro, que es lo que hace que los ✕ de los chips funcionen.
   */
  const urlFiltro = (cat: string | undefined, q: string): string => {
    const p = new URLSearchParams();
    if (cat) p.set("categoria", cat);
    if (q) p.set("q", q);
    const query = p.toString();
    return query ? `${ruta}?${query}` : ruta;
  };

  return (
    <>
      <div className="mx-auto flex max-w-[720px] items-stretch gap-2">
        <form method="get" action={ruta} className="relative flex-1">
          {categoria && (
            <input type="hidden" name="categoria" value={categoria} />
          )}
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-aventurea-ink-soft" />
          <input
            type="search"
            name="q"
            aria-label={ariaLabel}
            defaultValue={busqueda}
            placeholder={placeholder}
            className="h-12 w-full rounded-[14px] border border-aventurea-line bg-white pl-11 pr-4 text-[13.5px] text-aventurea-ink shadow-sm transition-shadow placeholder:text-zinc-500 hover:shadow-md focus:border-aventurea-navy/50 focus:outline-none"
          />
        </form>

        <details className="relative shrink-0">
          <summary
            className={`flex h-12 cursor-pointer list-none items-center gap-2 rounded-[14px] border px-4 text-[13.5px] font-bold transition-colors [&::-webkit-details-marker]:hidden ${
              categoria
                ? "border-aventurea-navy bg-aventurea-navy text-white"
                : "border-aventurea-line bg-white text-aventurea-ink hover:border-aventurea-navy"
            }`}
          >
            <IconFiltro className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {categoria && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-aventurea-navy">
                1
              </span>
            )}
          </summary>

          <div className="absolute right-0 z-30 mt-2 w-[min(88vw,430px)] rounded-2xl border border-aventurea-line bg-white p-4 shadow-[0_24px_60px_-24px_rgba(22,41,94,0.45)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
              {tituloPanel}
            </p>
            <div className="mt-3 grid max-h-[46vh] grid-cols-2 gap-1.5 overflow-y-auto">
              <OpcionFiltro
                href={urlFiltro(undefined, busqueda)}
                activo={!categoria}
                label="Todos"
                conteo={totalSinFiltro}
              />
              {opciones.map((o) => (
                <OpcionFiltro
                  key={o.valor}
                  href={urlFiltro(o.valor, busqueda)}
                  activo={categoria === o.valor}
                  label={o.label}
                  conteo={o.conteo}
                />
              ))}
            </div>
          </div>
        </details>
      </div>

      {/* Lo que está aplicado, a la vista y con su ✕ para soltarlo:
          si el filtro se esconde en el panel, tiene que notarse acá. */}
      {(categoria || busqueda) && (
        <div className="mx-auto mt-3 flex max-w-[720px] flex-wrap items-center gap-2">
          {busqueda && (
            <ChipActivo
              texto={`“${busqueda}”`}
              href={urlFiltro(categoria, "")}
              quitar="Quitar la búsqueda"
            />
          )}
          {categoria && labelCategoria && (
            <ChipActivo
              texto={labelCategoria}
              href={urlFiltro(undefined, busqueda)}
              quitar={quitarCategoria}
            />
          )}
          <span className="text-[12.5px] font-semibold text-aventurea-ink-soft">
            {resultados} {resultados === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      )}
    </>
  );
}

/** Una opción del panel: nombre a la izquierda, cuántos hay a la
 *  derecha. Fila y no chip, para que las largas entren ordenadas. */
function OpcionFiltro({
  href,
  activo,
  label,
  conteo,
}: {
  href: string;
  activo: boolean;
  label: string;
  conteo: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12.5px] font-bold transition-colors ${
        activo
          ? "bg-aventurea-navy text-white"
          : "bg-aventurea-cream-2 text-aventurea-ink hover:bg-aventurea-blue-light hover:text-aventurea-navy"
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`shrink-0 text-[11.5px] font-extrabold ${
          activo ? "text-white/70" : "text-aventurea-ink-soft"
        }`}
      >
        {conteo}
      </span>
    </Link>
  );
}

/** Un filtro aplicado, con su ✕ para soltarlo. El href apunta al
 *  directorio SIN ese filtro (conservando el otro). */
function ChipActivo({
  texto,
  href,
  quitar,
}: {
  texto: string;
  href: string;
  quitar: string;
}) {
  return (
    <Link
      href={href}
      aria-label={quitar}
      title={quitar}
      className="group inline-flex items-center gap-1.5 rounded-full border border-aventurea-navy bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-navy transition-colors hover:bg-aventurea-navy hover:text-white"
    >
      {texto}
      <IconX className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
    </Link>
  );
}
