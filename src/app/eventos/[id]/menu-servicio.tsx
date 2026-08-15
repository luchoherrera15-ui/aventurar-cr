import Image from "next/image";
import {
  IconCafe,
  IconCloche,
  IconHelado,
  IconJugo,
  IconPan,
  IconUtensils,
} from "@/components/icons";
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

/**
 * El ícono que acompaña a cada grupo del menú, elegido por el NOMBRE
 * de la categoría y no por su posición.
 *
 * Va por nombre a propósito: el dueño ordena y renombra sus categorías
 * desde el panel, así que atarlo a la posición haría que "Panadería"
 * apareciera con una taza el día que la suba al primer lugar.
 *
 * Lo que no reconoce cae en los cubiertos, que sirven para cualquier
 * cosa — nunca queda un hueco.
 */
const ICONOS_GRUPO: { claves: string[]; Icono: typeof IconCafe }[] = [
  // Bebidas frías y tés: el vaso. Va PRIMERO para que "Café y té"
  // caiga acá y no repita la taza del grupo de matcha — dos rieles
  // seguidos con el mismo dibujo no ayudan a ubicarse.
  { claves: ['te', 'tes', 'jugo', 'jugos', 'fresco', 'frescos', 'refresco', 'refrescos', 'smoothie', 'smoothies', 'batido', 'batidos', 'limonada', 'limonadas', 'soda', 'sodas', 'frias', 'frios'], Icono: IconJugo },
  { claves: ['pan', 'panaderia', 'reposteria', 'bolleria', 'masa', 'masas'], Icono: IconPan },
  { claves: ['postre', 'postres', 'helado', 'helados', 'dulce', 'dulces', 'torta', 'tortas', 'queque', 'queques'], Icono: IconHelado },
  { claves: ['matcha', 'cafe', 'cafes', 'bebida', 'bebidas', 'latte', 'chocolate', 'infusion', 'infusiones', 'calientes'], Icono: IconCafe },
];

/**
 * Compara por PALABRA y no por texto suelto: buscando "te" adentro de
 * la cadena, "Repostería" se llevaba el vaso de jugo. Se acepta
 * también que la palabra EMPIECE con la clave, para que "panadería"
 * entre por "pan" sin listar cada variante.
 */
function iconoDelGrupo(nombre: string | null) {
  if (!nombre) return IconUtensils;
  const palabras = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const { claves, Icono } of ICONOS_GRUPO) {
    if (palabras.some((w) => claves.some((c) => w === c || w.startsWith(c)))) return Icono;
  }
  return IconUtensils;
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
          <Image
            src={item.foto_url}
            alt={item.nombre}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 320px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
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
    <section
      id="menu"
      className="relative overflow-hidden border-t border-aventurea-line bg-aventurea-surface py-14"
    >
      {/* La taza en marca de agua: sale por el borde derecho de la
          página y se recorta ahí (overflow-hidden), el mismo gesto que
          usan las tarjetas del panel. Decorativa: aria-hidden y sin
          capturar clics. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 top-8 hidden rotate-[10deg] text-aventurea-navy/[0.05] lg:block [&_svg]:h-[340px] [&_svg]:w-[340px]"
      >
        <IconCafe />
      </span>

      <div className="relative z-10 mx-auto max-w-[1080px] px-7">
        <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-sky">
          {etiqueta} de {nombreRancho}
        </p>
        <h2 className="titulo mt-2 text-[26px] text-aventurea-navy sm:text-[30px]">
          Lo que servimos
        </h2>
        <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          Todo se arma a la medida de tu evento. Elegí lo que te guste y
          cotizalo al consultar tu fecha.
        </p>

        <div className="mt-9 flex flex-col gap-11">
          {grupos.map((g, i) => (
            <div key={g.nombre ?? `grupo-${i}`}>
              {conEncabezados &&
                (() => {
                  const IconoGrupo = iconoDelGrupo(g.nombre);
                  return (
                    <h3 className="mb-4 flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-aventurea-ink">
                      {/* El ícono de la categoría: da un golpe de vista
                          para saltar directo a lo que se anda buscando
                          en un menú largo. Decorativo — el nombre al
                          lado ya lo dice todo. */}
                      <span aria-hidden className="shrink-0 text-aventurea-sky">
                        <IconoGrupo className="h-[18px] w-[18px]" />
                      </span>
                      {g.nombre ?? "Otros"}
                      <span aria-hidden className="h-px flex-1 bg-aventurea-line" />
                    </h3>
                  );
                })()}
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
