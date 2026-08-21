import Link from "next/link";
import { IconCompass, IconSearch } from "@/components/icons";
import { PAIS_POR_DEFECTO, paisDe } from "@/lib/paises";
import { urlDirectorio } from "@/lib/url-directorio";

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
  pais,
  provincia,
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
  /**
   * El país que se está mirando, en ISO alfa-2 minúscula. Ausente (o
   * "cr") = Costa Rica: la barra se ve EXACTAMENTE igual que siempre y
   * el parámetro no aparece en ninguna URL. Solo se arrastra cuando el
   * visitante está mirando otro país, para que tocar una categoría no
   * lo devuelva a Costa Rica sin avisar.
   */
  pais?: string;
  /**
   * La región aplicada — el "¿Dónde?" del buscador de la portada, que
   * llega por `?provincia=`. Si no viene, la barra se ve igual que
   * siempre: ni el aviso ni el parámetro existen.
   */
  provincia?: string;
  /** Las categorías en su orden oficial. */
  opciones: OpcionCategoria[];
  /** Cuántos quedaron — solo se muestra cuando hay búsqueda. */
  resultados: number;
}) {
  /**
   * El país ya resuelto, para poder decir "ver todo Panamá" en vez de
   * "ver todo el país" y para saber si hay que emitir `?pais=`.
   */
  const paisActual = paisDe(pais);
  const esPaisPorDefecto = paisActual.codigo === PAIS_POR_DEFECTO;

  /**
   * La URL del directorio cambiando SOLO lo que se pide y conservando
   * el resto. Que los chips se llevaran puesta la provincia era el peor
   * de los dos males posibles: el visitante llegaba filtrado por zona,
   * tocaba una categoría y el filtro desaparecía sin decir nada. Con el
   * país pasa lo mismo, y peor: perderlo devuelve al visitante a otro
   * país entero.
   *
   * Para soltar un filtro se pasa la cadena vacía (`{ prov: "" }`), no
   * `undefined`: un `undefined` explícito dispararía el valor por
   * defecto y no borraría nada.
   *
   * Costa Rica nunca se emite; de eso se encarga `urlDirectorio`, que
   * es el mismo armador que usan las páginas de /citas y /restaurantes
   * para sus enlaces de "Ver todos" — así las dos mitades de la misma
   * pantalla no pueden producir URLs con forma distinta.
   */
  const url = (cambios: { cat?: string; q?: string; prov?: string } = {}): string =>
    urlDirectorio(ruta, {
      categoria: cambios.cat ?? categoria,
      q: cambios.q ?? busqueda,
      pais: paisActual.codigo,
      provincia: cambios.prov ?? provincia,
    });

  return (
    <>
      <form method="get" action={ruta} className="relative mx-auto max-w-[640px]">
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        {/* Sin esto, buscar dentro de una provincia la soltaba: el form
            GET reemplaza la query entera con lo que lleve adentro. El
            país corre el mismo riesgo, y por eso viaja igual — pero
            solo cuando NO es Costa Rica, para no ensuciar la URL de
            todas las búsquedas de hoy. */}
        {!esPaisPorDefecto && (
          <input type="hidden" name="pais" value={paisActual.codigo} />
        )}
        {provincia && <input type="hidden" name="provincia" value={provincia} />}
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

      {/* La fila de categorías. Los degradados de los costados avisan
          que hay más para ese lado cuando la fila no cabe entera —en
          las dos direcciones, porque `justify-[safe_center]` puede
          centrar la fila y dejar desborde a la izquierda también. */}
      <div className="relative mt-3">
        <div
          className="flex gap-2.5 overflow-x-auto py-1 lg:justify-[safe_center]"
          style={{ scrollbarWidth: "none" }}
        >
          <ChipCategoria
            href={url({ cat: "" })}
            label="Todos"
            icono={<IconCompass />}
            activo={!categoria}
          />
          {opciones.map((o) => (
            <ChipCategoria
              key={o.valor}
              href={url({ cat: o.valor })}
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
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-aventurea-cream-2 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-aventurea-cream-2 to-transparent"
        />
      </div>

      {/* Solo cuando se buscó algo: cuántos hay y cómo soltar la
          búsqueda. Sin búsqueda, la barra queda limpia. */}
      {busqueda && (
        <p className="mt-2 text-center text-[12.5px] font-semibold text-aventurea-ink-soft">
          {resultados} {resultados === 1 ? "resultado" : "resultados"} para “
          {busqueda}”{" "}
          <Link
            href={url({ q: "" })}
            className="font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange"
          >
            limpiar
          </Link>
        </p>
      )}

      {/* El filtro de zona SE VE. Un filtro que achica la lista sin
          decirlo se lee como "aquí no hay casi nada", y la persona se
          va del sitio creyendo que el directorio está vacío. */}
      {provincia && (
        <p className="mt-2 text-center text-[12.5px] font-semibold text-aventurea-ink-soft">
          Mostrando solo{" "}
          <span className="font-extrabold text-aventurea-ink">{provincia}</span>{" "}
          <Link
            href={url({ prov: "" })}
            className="font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange"
          >
            {/* "todo el país" servía cuando el país era uno solo y era
                obvio cuál. Con varios hay que NOMBRARLO: soltar la zona
                deja al visitante viendo Panamá entero, y tiene que
                saberlo antes de tocar. */}
            ver todo {paisActual.nombre}
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
