import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Bloque, EsqueletoCard, EsqueletoFiltros } from "../esqueleto";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import SelectorVertical from "@/components/selector-vertical";
import BarraFiltrosDirectorio from "@/components/barra-filtros-directorio";
import { CATEGORIA_RESTAURANTE_ICONO } from "./iconos";
import { IconCloche, IconPin, IconStar } from "@/components/icons";
import {
  CATEGORIAS_RESTAURANTES,
  CATEGORIA_RESTAURANTE_LABEL,
  RANGO_PRECIO_LABEL,
  normalizarCategoriaRestaurante,
  opcionesDeDetalles,
  type CategoriaRestaurante,
} from "./tipos";
import type { Rancho } from "../mi-negocio/types";

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

/**
 * El armazón de /restaurantes. Mismo criterio que /eventos y /citas: el
 * contenido va detrás de un `<Suspense>` para que el `<head>` con los
 * preloads de CSS y JS salga sin esperar a Supabase.
 *
 * `<Suspense>` y no `loading.tsx`: un `loading.tsx` acá también taparía
 * /restaurantes/[slug] y ahí el armazón saldría antes del `notFound()`.
 * Verificado contra el servidor local: con el loading.tsx puesto,
 * `/restaurantes/no-existe` respondía 200 en vez de 404.
 */
export default async function RestaurantesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const catParam = unSolo(params.categoria);
  const categoriaSel = (CATEGORIAS_RESTAURANTES as readonly string[]).includes(
    catParam ?? "",
  )
    ? (catParam as CategoriaRestaurante)
    : undefined;
  const busquedaSel = (unSolo(params.q) ?? "").trim();

  return (
    <div className="relative min-h-screen bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Restaurantes" />

      <section className="relative mx-auto max-w-[1100px] px-4 pb-10 pt-4 sm:px-6">
        <h1 className="sr-only">Restaurantes — reservá mesa y pedí para recoger</h1>
        <div className="mb-4">
          <SelectorVertical />
        </div>

        {/* La altura reservada es lo que evita que el pie de página
            salte. Medido con red a 700 kbps y CPU 4×: el esqueleto de
            dos filas ocupaba 944 px y el contenido real de hoy —la
            sección todavía no tiene restaurantes— 513 px, así que al
            llegar el contenido el <footer> subía 431 px de golpe y el
            CLS de /restaurantes daba 0,1213 (Google pide < 0,1). Era
            la única ruta del sitio con CLS distinto de 0.
            Con el esqueleto de UNA fila y este min-h, los dos estados
            ocupan lo mismo y el CLS vuelve a 0,000. */}
        <div className="min-h-[592px]">
          <Suspense
            key={`${categoriaSel ?? ""}|${busquedaSel}`}
            fallback={<EsqueletoRestaurantes />}
          >
            <ContenidoRestaurantes categoria={categoriaSel} busqueda={busquedaSel} />
          </Suspense>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/**
 * Calca la vista por defecto: filas horizontales por categoría.
 *
 * UNA fila, no dos. Un esqueleto no puede prometer más de lo que la
 * página entrega: con dos filas dibujaba ocho tarjetas en una sección
 * que hoy está vacía, y al llegar el contenido real el pie de página
 * subía 431 px (CLS 0,1213). Una fila deja el esqueleto en la misma
 * altura que reserva el contenedor de arriba.
 */
function EsqueletoRestaurantes() {
  return (
    <>
      <EsqueletoFiltros />
      <div className="mt-6">
        <section>
          <Bloque className="h-5 w-[190px]" />
          <div className="mt-3.5 flex gap-4 overflow-hidden pb-2 pt-0.5">
            {Array.from({ length: 4 }, (_, i) => (
              <EsqueletoCard key={i} className="w-[270px] shrink-0 sm:w-[300px]" />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

async function ContenidoRestaurantes({
  categoria,
  busqueda,
}: {
  categoria: CategoriaRestaurante | undefined;
  busqueda: string;
}) {
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
    <>
        {/* Buscador + la fila de categorías — la misma pieza que /citas.
            Las 18 de comida caben en una línea porque la fila scrollea
            en horizontal. */}
        <BarraFiltrosDirectorio
          ruta="/restaurantes"
          ariaLabel="Buscar restaurantes por nombre, zona o tipo de comida"
          placeholder='Buscá por nombre, zona o comida — ej. "mariscos" o "Escazú"'
          categoria={categoria}
          busqueda={busqueda}
          resultados={filtrados.length}
          opciones={CATEGORIAS_RESTAURANTES.map((c) => ({
            valor: c,
            label: CATEGORIA_RESTAURANTE_LABEL[c],
            icono: CATEGORIA_RESTAURANTE_ICONO[c],
          }))}
        />

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
            <Link href="/mi-negocio/nuevo/restaurantes" className="btn-naranja mt-6">
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
    </>
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
      className={`group overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)] transition-all hover:-translate-y-1 hover:border-aventurea-navy/50 hover:shadow-[0_20px_44px_-20px_rgba(22,41,94,0.4)] ${className}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-aventurea-blue-light">
        {n.foto_url ? (
          <Image
            src={n.foto_url}
            alt={n.nombre}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 300px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-aventurea-navy/40">
            <IconCloche className="h-10 w-10" />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
          {CATEGORIA_RESTAURANTE_LABEL[n.categoria]}
        </span>
        <span className="absolute right-3 top-3 flex items-center gap-1.5">
          {rangoPrecio && (
            <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-aventurea-navy backdrop-blur">
              {RANGO_PRECIO_LABEL[rangoPrecio]}
            </span>
          )}
          {n.slug?.startsWith("demo-") && (
            <span className="rounded-lg bg-amber-400 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
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
    <span className="rounded-lg bg-aventurea-navy/10 px-2.5 py-1 text-[11px] font-bold text-aventurea-navy">
      {texto}
    </span>
  );
}

