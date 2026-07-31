import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SelectorVertical from "@/components/selector-vertical";
import { IconCloche, IconPin, IconSearch, IconStar } from "@/components/icons";
import {
  CATEGORIAS_RESTAURANTES,
  CATEGORIA_RESTAURANTE_LABEL,
  RANGO_PRECIO_LABEL,
  normalizarCategoriaRestaurante,
  opcionesDeDetalles,
  type CategoriaRestaurante,
} from "./tipos";
import type { Rancho } from "../mi-rancho/types";

export const metadata: Metadata = {
  title: "Restaurantes",
  description:
    "Descubrí restaurantes, sodas y cafeterías: mirá el menú, reservá tu mesa a la hora que querás y pedí para recoger.",
};

type Calificacion = { rancho_id: string; promedio: number; total: number };

/**
 * El directorio de Restaurantes. Sin filtro se ve una fila por
 * categoría (sodas, cafeterías, mariscos...); al filtrar o buscar
 * pasa al grid clásico — el mismo patrón que Citas.
 */

/** Para buscar sin pelear con tildes: "cafeteria" encuentra "cafetería". */
function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Next entrega string | string[] con parámetros repetidos en la URL. */
function unSolo(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type Fila = Pick<
  Rancho,
  "id" | "nombre" | "slug" | "descripcion" | "provincia" | "canton" | "foto_url" | "precio_desde"
> & { categoria: string; detalles?: unknown };

type Local = Omit<Fila, "categoria"> & { categoria: CategoriaRestaurante };

export default async function RestaurantesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const categoria = unSolo(params.categoria);
  const q = unSolo(params.q);
  const busqueda = (q ?? "").trim();
  const supabase = await createClient();

  const [{ data: localesData }, { data: califData }] = await Promise.all([
    supabase
      .from("ranchos")
      .select(
        "id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, precio_desde, detalles",
      )
      .eq("vertical", "restaurantes")
      .eq("estado", "aprobado")
      .order("created_at", { ascending: false }),
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
  ]);

  const locales: Local[] = ((localesData ?? []) as Fila[]).map((n) => ({
    ...n,
    categoria: normalizarCategoriaRestaurante(n.categoria),
  }));
  const califPorLocal = new Map(
    ((califData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );

  // La búsqueda se aplica antes que la categoría, para que los
  // conteos de los chips prometan justo lo que el clic entrega.
  const aguja = normalizarBusqueda(busqueda);
  const baseBusqueda = aguja
    ? locales.filter((n) =>
        normalizarBusqueda(
          [
            n.nombre,
            n.canton ?? "",
            n.provincia ?? "",
            n.descripcion ?? "",
            CATEGORIA_RESTAURANTE_LABEL[n.categoria],
          ].join(" "),
        ).includes(aguja),
      )
    : locales;

  const filtrados = categoria
    ? baseBusqueda.filter((n) => n.categoria === categoria)
    : baseBusqueda;

  const conteo: Record<string, number> = {};
  baseBusqueda.forEach((n) => {
    conteo[n.categoria] = (conteo[n.categoria] ?? 0) + 1;
  });

  const filas = CATEGORIAS_RESTAURANTES.map((c) => ({
    categoria: c,
    items: locales.filter((n) => n.categoria === c),
  })).filter((f) => f.items.length > 0);

  const vistaFilas = !categoria && !aguja;

  return (
    <div className="relative min-h-screen bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Restaurantes" />

      <section className="relative mx-auto max-w-[1100px] px-4 pb-10 pt-4 sm:px-6">
        <h1 className="sr-only">Restaurantes — reservá mesa y pedí para recoger</h1>
        <div className="mb-4">
          <SelectorVertical activo="restaurantes" />
        </div>

        <form method="get" action="/restaurantes" className="mx-auto max-w-[640px]">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-aventurea-ink-soft" />
            <input
              type="search"
              name="q"
              aria-label="Buscar restaurantes por nombre, zona o tipo de comida"
              defaultValue={busqueda}
              placeholder='Buscá por nombre, zona o comida — ej. "mariscos" o "Escazú"'
              className="h-12 w-full rounded-full border border-aventurea-line bg-white pl-11 pr-4 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400 focus:border-aventurea-navy focus:outline-none"
            />
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <ChipCategoria
            href={busqueda ? `/restaurantes?q=${encodeURIComponent(busqueda)}` : "/restaurantes"}
            activo={!categoria}
            label={`Todos (${baseBusqueda.length})`}
          />
          {CATEGORIAS_RESTAURANTES.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
            <ChipCategoria
              key={c}
              href={`/restaurantes?categoria=${c}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ""}`}
              activo={categoria === c}
              label={`${CATEGORIA_RESTAURANTE_LABEL[c]} (${conteo[c]})`}
            />
          ))}
        </div>

        {filtrados.length === 0 && locales.length > 0 ? (
          <div className="bento bento-blanco mt-10 p-10 text-center shadow-sm">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              No encontramos nada con esa búsqueda
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Probá con otra palabra, otra zona, o quitá los filtros.
            </p>
            <Link href="/restaurantes" className="btn-contorno mt-6">
              Ver todos los restaurantes
            </Link>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bento bento-blanco mt-10 p-10 text-center shadow-sm">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Los primeros restaurantes están por llegar
            </p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Estamos abriendo esta sección. ¿Tenés un restaurante, soda o
              cafetería? Publicalo gratis: mostrás tu menú, recibís reservas de
              mesa y pedidos para recoger, sin comisión por pedido.
            </p>
            <Link href="/mi-rancho/nuevo/restaurantes" className="btn-naranja mt-6">
              Publicar mi restaurante
            </Link>
          </div>
        ) : vistaFilas ? (
          <div className="mt-6 space-y-8">
            {filas.map((f) => (
              <section key={f.categoria}>
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-[17px] font-extrabold tracking-tight text-aventurea-ink">
                    {CATEGORIA_RESTAURANTE_LABEL[f.categoria]}
                    <span className="ml-2 text-[13px] font-bold text-aventurea-ink-soft">
                      ({f.items.length})
                    </span>
                  </h2>
                  <Link
                    href={`/restaurantes?categoria=${f.categoria}`}
                    className="shrink-0 text-[12.5px] font-extrabold text-aventurea-navy hover:text-aventurea-orange"
                  >
                    Ver todos →
                  </Link>
                </div>
                <div className="mt-3.5 flex snap-x gap-4 overflow-x-auto pb-2 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {f.items.map((n) => (
                    <CardLocal
                      key={n.id}
                      local={n}
                      calif={califPorLocal.get(n.id)}
                      className="w-[270px] shrink-0 snap-start sm:w-[300px]"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((n) => (
              <CardLocal key={n.id} local={n} calif={califPorLocal.get(n.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CardLocal({
  local: n,
  calif,
  className = "",
}: {
  local: Local;
  calif?: Calificacion;
  className?: string;
}) {
  const href = n.slug ? `/restaurantes/${n.slug}` : `/restaurantes/${n.id}`;
  const ubicacion = [n.canton, n.provincia].filter(Boolean).join(", ");
  const { aceptaReservaMesa, aceptaPickup, rangoPrecio } = opcionesDeDetalles(n.detalles);

  return (
    <Link
      href={href}
      className={`group overflow-hidden rounded-[24px] border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)] transition-all hover:-translate-y-1 hover:border-aventurea-navy/50 hover:shadow-[0_20px_44px_-20px_rgba(22,41,94,0.4)] ${className}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-aventurea-blue-light">
        {n.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- fotos remotas de Supabase
          <img
            src={n.foto_url}
            alt={n.nombre}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-aventurea-navy/40">
            <IconCloche className="h-10 w-10" />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
          {CATEGORIA_RESTAURANTE_LABEL[n.categoria]}
        </span>
        <span className="absolute right-3 top-3 flex items-center gap-1.5">
          {rangoPrecio && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-aventurea-navy backdrop-blur">
              {RANGO_PRECIO_LABEL[rangoPrecio]}
            </span>
          )}
          {n.slug?.startsWith("demo-") && (
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
              Demo
            </span>
          )}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[15px] font-extrabold leading-snug text-aventurea-ink">
            {n.nombre}
          </p>
          {calif && (
            <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-aventurea-ink">
              <IconStar className="h-3.5 w-3.5 text-aventurea-orange" />
              {calif.promedio.toFixed(1)}
              <span className="font-semibold text-aventurea-ink-soft">({calif.total})</span>
            </span>
          )}
        </div>
        {ubicacion && (
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-aventurea-ink-soft">
            <IconPin className="h-3.5 w-3.5 text-aventurea-navy" /> {ubicacion}
          </p>
        )}

        {/* Lo que se puede hacer acá: reservar mesa, pedir para recoger
            o simplemente mirar el menú. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#e8eef8] pt-3">
          {aceptaReservaMesa && <Etiqueta texto="Reservá mesa" />}
          {aceptaPickup && <Etiqueta texto="Pedí y recogé" />}
          {!aceptaReservaMesa && !aceptaPickup && <Etiqueta texto="Ver el menú" />}
          <span className="ml-auto text-[13px] font-extrabold text-aventurea-orange">
            Ver →
          </span>
        </div>
      </div>
    </Link>
  );
}

function Etiqueta({ texto }: { texto: string }) {
  return (
    <span className="rounded-full bg-aventurea-navy/10 px-2.5 py-1 text-[11px] font-bold text-aventurea-navy">
      {texto}
    </span>
  );
}

function ChipCategoria({
  href,
  activo,
  label,
}: {
  href: string;
  activo: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink-soft hover:border-aventurea-navy hover:text-aventurea-navy"
      }`}
    >
      {label}
    </Link>
  );
}
