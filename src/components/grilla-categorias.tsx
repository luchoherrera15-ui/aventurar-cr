import Link from "next/link";
import { IconChevronRight } from "./icons";
import {
  categoriaGradiente,
  categoriaIcono,
  categoriaOptions,
} from "@/lib/categorias-vertical";

/**
 * ============================================================
 * LA GRILLA DE CATEGORÍAS DE UNA VERTICAL
 * ============================================================
 *
 * Un bloque de tarjetas grandes —una por categoría— que llevan al
 * directorio ya filtrado: `/citas?categoria=spa`, `/eventos?categoria=
 * lugares`. Los dos directorios ya leen y validan ese parámetro, así
 * que esto no reimplementa ninguna búsqueda: compone una URL.
 *
 * ── DE DÓNDE SALEN LAS CATEGORÍAS ────────────────────────────────
 * De `categoriaOptions(vertical)`, el contrato compartido de
 * src/lib/categorias-vertical.ts. Nunca de una lista escrita a mano
 * acá: inventar categorías está prohibido por CLAUDE.md, y la maqueta
 * de referencia proponía cuatro tarjetas ("Salones", "Catering", "DJ y
 * música", "Foto y video") que en esta base NO son categorías sino
 * SUBcategorías de Eventos. Si mañana se agrega una categoría oficial,
 * aparece sola en esta grilla.
 *
 * ── POR QUÉ GRADIENTES Y NO FOTOS ────────────────────────────────
 * En la base no hay ninguna imagen asociada a una categoría: las fotos
 * son de un negocio, no de un rubro. Las opciones eran inventar fotos
 * de stock (la maqueta usaba Unsplash), robarle la foto a un negocio
 * —que hoy sería la de un negocio de muestra— o usar los gradientes e
 * íconos propios que el sistema ya tiene para cuando un negocio no
 * subió foto. Se usan los propios: es dato cierto, es la estética de la
 * marca, y no promete un local que no existe. El día que haya
 * fotografía por categoría, se cambia acá y en un solo lugar.
 *
 * ── UN COMPONENTE, DOS VERTICALES ────────────────────────────────
 * Citas y Eventos usan esta misma pieza con distinto `vertical`. El
 * helper ya sabe darle a cada una su ícono y su gradiente, así que no
 * hacen falta dos grillas casi iguales que se despeguen con el tiempo.
 *
 * Es un componente de SERVIDOR a propósito: son links y CSS, cero
 * estado. No manda un byte de JavaScript a la portada.
 */

/** Las dos verticales que tienen grilla en la portada. */
type VerticalConGrilla = "citas" | "eventos";

const DIRECTORIO: Record<VerticalConGrilla, string> = {
  citas: "/citas",
  eventos: "/eventos",
};

export default function GrillaCategorias({
  vertical,
  kicker,
  titulo,
  descripcion,
  categorias,
  conteos,
  verTodoHref,
  verTodoTexto = "Ver todas las categorías",
}: {
  vertical: VerticalConGrilla;
  /** El "eyebrow" de la maqueta: dos o tres palabras en mayúsculas. */
  kicker: string;
  titulo: string;
  descripcion?: string;
  /**
   * Qué categorías pintar, por id. Por defecto TODAS las de la
   * vertical: son seis y seis caben en la grilla, así ninguna categoría
   * oficial queda invisible en la portada (la maqueta pintaba cuatro).
   */
  categorias?: string[];
  /**
   * Cuántos negocios publicados hay por categoría, calculado en memoria
   * por `leerDatosHome()`. Opcional: sin conteos la grilla se ve igual,
   * solo sin la línea de abajo.
   */
  conteos?: Record<string, number>;
  verTodoHref: string;
  verTodoTexto?: string;
}) {
  const opciones = categorias
    ? categoriaOptions(vertical).filter((o) => categorias.includes(o.id))
    : categoriaOptions(vertical);

  if (opciones.length === 0) return null;

  const base = DIRECTORIO[vertical];

  return (
    <section>
      {/* El encabezado de la maqueta: kicker + título + bajada a la
          izquierda, y el link de "ver todo" a la derecha. En móvil el
          link baja debajo del texto en vez de apretarse al costado. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0">
          <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-bookea-naranja-fuerte">
            {kicker}
          </p>
          <h2 className="titulo mt-2 text-[clamp(26px,3.4vw,40px)] text-aventurea-navy">
            {titulo}
          </h2>
          {descripcion && (
            <p className="mt-2.5 max-w-[62ch] text-[14px] leading-relaxed text-aventurea-ink-soft">
              {descripcion}
            </p>
          )}
        </div>

        <Link
          href={verTodoHref}
          className="group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-bold text-aventurea-navy underline underline-offset-4 hover:text-aventurea-orange"
        >
          {verTodoTexto}
          <IconChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Seis columnas en escritorio: entran las seis categorías
          oficiales en una sola fila. Dos en teléfono, tres en tableta. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {opciones.map((opcion, i) => {
          const cantidad = conteos?.[opcion.id] ?? 0;
          return (
            <Link
              key={opcion.id}
              href={`${base}?categoria=${encodeURIComponent(opcion.id)}`}
              data-reveal
              style={
                {
                  backgroundImage: categoriaGradiente(vertical, opcion.id),
                  // Tope en 6 como en las cards: más allá, la última
                  // tarjeta entraría tan tarde que se ve como un error.
                  "--reveal-delay": `${Math.min(i, 6) * 60}ms`,
                } as React.CSSProperties
              }
              className="elevar presionable group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl border border-aventurea-navy/10 p-3.5 text-white shadow-[0_10px_30px_-18px_rgba(22,41,94,0.45)] sm:min-h-[180px] lg:min-h-[210px]"
            >
              {/* El gradiente de la categoría ya es oscuro, pero un velo
                  de abajo hacia arriba asegura que el nombre se lea
                  igual si mañana esos gradientes se aclaran. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(6,38,83,0.55)_0%,transparent_60%)]"
              />

              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-aventurea-navy [&_svg]:h-5 [&_svg]:w-5">
                {categoriaIcono(vertical, opcion.id)}
              </span>

              <span className="relative">
                <span className="block text-[14px] font-extrabold leading-tight tracking-tight sm:text-[15px]">
                  {opcion.label}
                </span>
                {/* El conteo SOLO si hay al menos uno. Nunca "0
                    negocios": una categoría vacía se muestra igual
                    —lleva al directorio, que ofrece las demás— pero no
                    hace falta anunciarle al visitante que está vacía. */}
                {cantidad >= 1 && (
                  <span className="mt-1 block text-[11.5px] font-semibold text-white/75">
                    {cantidad} {cantidad === 1 ? "negocio" : "negocios"}
                  </span>
                )}
              </span>

              {/* La flechita se esconde en teléfono, igual que en la
                  maqueta: en una tarjeta de 150px de alto compite con
                  el nombre. */}
              <span
                aria-hidden
                className="absolute bottom-3 right-3 hidden h-7 w-7 items-center justify-center rounded-full bg-white text-aventurea-navy transition-transform group-hover:translate-x-0.5 sm:flex [&_svg]:h-3.5 [&_svg]:w-3.5"
              >
                <IconChevronRight />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
