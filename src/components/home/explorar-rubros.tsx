import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { GRUPOS } from "@/components/home/grupos-categorias";

/**
 * ============================================================
 * «EXPLORÁ POR RUBRO» — la franja que llena la portada sin mentir
 * ============================================================
 *
 * EL PROBLEMA QUE RESUELVE. La portada es un catálogo, y hoy el
 * catálogo tiene DOS negocios aprobados. Los rieles de arriba se pintan
 * cortos y honestos, pero debajo quedaba media pantalla en blanco. Las
 * salidas fáciles eran todas mentira: sembrar negocios de mentira,
 * fotos de banco de imágenes, «+500 proveedores», estrellas de reseñas
 * que no existen. Todas prohibidas por CLAUDE.md, y con razón: un
 * número inventado en la primera pantalla es la mentira más cara del
 * sitio.
 *
 * LA SALIDA HONESTA. Los RUBROS sí existen: son la taxonomía real que
 * la columna `ranchos.categoria` acepta, y cada uno tiene un directorio
 * de verdad del otro lado del clic. Esta franja los pone todos a la
 * vista —36 puertas reales— y los presenta como lo que son: algo para
 * EXPLORAR, no un inventario.
 *
 * ⚠️ POR ESO EL COPY NO PROMETE NEGOCIOS. Dice «Entrá al rubro que
 * buscás» y no «Encontrá barberías cerca tuyo». Un rubro sin negocios
 * publicados lleva a un directorio que dice honestamente que todavía no
 * hay nada — y ese es el único mensaje que esta franja puede sostener
 * hasta que el directorio se llene. Tampoco lleva conteos: poner «0» en
 * 30 de 36 tiles sería subrayar el vacío, y poner el número solo donde
 * es alto sería elegir qué verdad se cuenta.
 *
 * ── DE DÓNDE SALEN LOS RUBROS ────────────────────────────────────
 * De `GRUPOS` (@/components/home/grupos-categorias), la MISMA lista que
 * alimenta los desplegables de la barra de arriba. No hay una segunda
 * copia: si mañana se agrega un rubro a la taxonomía, aparece en los
 * dos lados a la vez.
 *
 * Componente de SERVIDOR: son links y CSS, cero estado. No manda un
 * byte de JavaScript a la portada. (De paso, 36 enlaces internos con
 * texto propio en la URL más indexada del sitio no le hacen mal a
 * nadie.)
 */

export default function ExplorarRubros() {
  return (
    <section aria-labelledby="explorar-rubros">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2
            id="explorar-rubros"
            className="text-[21px] font-bold leading-tight tracking-tight text-aventurea-ink"
          >
            Explorá por rubro
          </h2>
          <p className="mt-1 max-w-[62ch] text-[14px] text-aventurea-ink-soft">
            Entrá al rubro que buscás y mirá lo que hay publicado hoy en cada
            directorio.
          </p>
        </div>
      </div>

      {/* `items-start`: Restaurantes trae 18 rubros y Hospedajes seis.
          Sin esto, las cuatro tarjetas se estirarían a la altura de la
          más larga y quedarían tres cajas medio vacías. */}
      <div className="mt-4 grid items-start gap-3.5 sm:grid-cols-2">
        {GRUPOS.map((g) => (
          <div
            key={g.id}
            className="rounded-2xl border border-aventurea-line bg-white p-4 sm:p-5"
          >
            <Link
              href={g.base}
              className="group flex items-center gap-2.5 text-[15px] font-extrabold text-aventurea-ink hover:text-aventurea-navy"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-sky/10 text-aventurea-orange [&_svg]:h-[17px] [&_svg]:w-[17px]">
                <g.Icono />
              </span>
              {g.label}
              <IconChevronRight className="h-3.5 w-3.5 text-aventurea-orange transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <div className="mt-3.5 flex flex-wrap gap-2">
              {g.rubros.map((r) => (
                <Link
                  key={r.id}
                  href={`${g.base}?categoria=${r.id}`}
                  className="flex items-center gap-1.5 rounded-lg border border-aventurea-line bg-aventurea-cream-2 px-2.5 py-1.5 text-[12.5px] font-bold text-aventurea-ink transition-colors hover:border-aventurea-navy hover:bg-white"
                >
                  <span
                    aria-hidden
                    className="shrink-0 text-aventurea-orange [&_svg]:h-[14px] [&_svg]:w-[14px]"
                  >
                    {r.icono}
                  </span>
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
