import { IconCloche } from "@/components/icons";
import type { RanchoItem } from "@/app/mi-negocio/types";

/**
 * El menú (o catálogo) del negocio como contenido PRINCIPAL de su
 * página — no un accesorio del formulario de reserva.
 *
 * Antes el catálogo solo existía adentro del flujo de reserva: para
 * ver qué vendía el negocio había que empezar a reservar. Ahora la
 * página se lee como la carta de un local — foto, nombre, descripción
 * y precio, agrupado por sección — y reservar es un botón aparte.
 *
 * Los ítems sin foto no dejan un hueco: cae una tarjeta de solo texto,
 * porque un menú a medio ilustrar es lo normal mientras el dueño sube
 * sus fotos.
 */

function fmtColones(n: number) {
  return "₡" + Number(n).toLocaleString("es-CR");
}

/** Agrupa respetando el orden de aparición (que ya viene por `orden`). */
function porGrupo(items: RanchoItem[]) {
  const grupos: { nombre: string | null; items: RanchoItem[] }[] = [];
  for (const item of items) {
    const clave = item.grupo?.trim() || null;
    const ultimo = grupos.find((g) => g.nombre === clave);
    if (ultimo) ultimo.items.push(item);
    else grupos.push({ nombre: clave, items: [item] });
  }
  return grupos;
}

function TarjetaItem({ item }: { item: RanchoItem }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface shadow-sm transition-shadow hover:shadow-[0_10px_30px_rgba(16,26,44,0.10)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-aventurea-cream-2">
        {item.foto_url ? (
          // Las fotos del catálogo son URLs públicas de Supabase Storage,
          // de tamaño ya acotado por el panel del dueño: next/image no
          // aporta acá.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.foto_url}
            alt={item.nombre}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-aventurea-line [&_svg]:h-10 [&_svg]:w-10">
            <IconCloche />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[14.5px] font-bold leading-snug text-aventurea-ink">
          {item.nombre}
        </h3>
        {item.descripcion && (
          <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
            {item.descripcion}
          </p>
        )}
        <p className="mt-3 text-[15px] font-bold text-aventurea-navy">
          {item.precio !== null ? fmtColones(item.precio) : "A cotizar"}
          {item.precio !== null && item.unidad && (
            <span className="ml-1 text-[11.5px] font-normal text-aventurea-ink-soft">
              {item.unidad}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}

export default function MenuServicio({
  items,
  etiqueta,
  nombreRancho,
}: {
  items: RanchoItem[];
  /** "Menú", "Paquetes", "Catálogo"… según la categoría del negocio. */
  etiqueta: string;
  nombreRancho: string;
}) {
  if (items.length === 0) return null;

  const grupos = porGrupo(items);
  // Con un solo grupo (o ninguno) no hace falta encabezar la sección:
  // el título de arriba ya dice qué es.
  const conEncabezados = grupos.length > 1 || !!grupos[0]?.nombre;

  return (
    <section id="menu" className="border-t border-aventurea-line bg-aventurea-surface py-14">
      <div className="mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
          {etiqueta} de {nombreRancho}
        </p>
        <h2 className="titulo mt-2 text-[26px] text-aventurea-ink sm:text-[30px]">
          Lo que servimos
        </h2>
        <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          Todo se arma a la medida de tu evento. Elegí lo que te guste y
          cotizalo al reservar tu fecha.
        </p>

        <div className="mt-9 flex flex-col gap-11">
          {grupos.map((g, i) => (
            <div key={g.nombre ?? `grupo-${i}`}>
              {conEncabezados && (
                <h3 className="mb-4 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.14em] text-aventurea-ink">
                  {g.nombre ?? "Otros"}
                  <span aria-hidden className="h-px flex-1 bg-aventurea-line" />
                </h3>
              )}
              <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
                {g.items.map((item) => (
                  <TarjetaItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
