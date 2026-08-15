import { IconCheck } from "@/components/icons";

type Grupo = {
  titulo: string;
  items: { id: string; label: string }[];
};

/**
 * Las amenidades del lugar, como ficha técnica: TODOS los grupos a la
 * vista al mismo tiempo, cada uno en su tarjeta con su título y su
 * conteo.
 *
 * Antes eran tabs y solo se abría el grupo elegido. Se veía ordenado,
 * pero escondía la información justo donde más pesa: quien está por
 * alquilar un lugar quiere barrer de un vistazo si hay piscina, cocina
 * equipada y parqueo — no ir descubriendo grupo por grupo. Mostrarlo
 * todo también hace que un lugar bien equipado se vea bien equipado.
 *
 * Sin estado, así que es un componente de servidor: no manda JavaScript
 * al navegador.
 *
 * (El archivo conserva su nombre viejo para no romper imports.)
 */
export default function AmenidadesLista({
  grupos,
  enColumna = false,
}: {
  grupos: Grupo[];
  /** true = vive dentro de la columna angosta del portal. */
  enColumna?: boolean;
}) {
  const total = grupos.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <p className="text-[13px] text-aventurea-ink-soft">
        <strong className="font-extrabold text-aventurea-ink">{total}</strong>{" "}
        {total === 1 ? "amenidad" : "amenidades"} en {grupos.length}{" "}
        {grupos.length === 1 ? "categoría" : "categorías"}
      </p>

      <div
        className={`mt-4 grid gap-3 ${
          enColumna
            ? "sm:grid-cols-2"
            : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        }`}
      >
        {grupos.map((g) => (
          <div
            key={g.titulo}
            className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5 shadow-[0_10px_28px_-20px_rgba(22,41,94,0.5)]"
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-aventurea-line pb-2.5">
              <h3 className="text-[11.5px] font-extrabold uppercase tracking-[0.13em] text-aventurea-navy">
                {g.titulo}
              </h3>
              <span className="text-[11px] font-extrabold text-aventurea-ink-soft/70">
                {g.items.length}
              </span>
            </div>

            <ul className="mt-3 grid gap-2">
              {g.items.map((i) => (
                <li
                  key={i.id}
                  className="flex items-start gap-2 text-[13px] leading-snug text-aventurea-ink"
                >
                  <IconCheck className="mt-[3px] h-3.5 w-3.5 shrink-0 text-aventurea-green" />
                  {i.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
