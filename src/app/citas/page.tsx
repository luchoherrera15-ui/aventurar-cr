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
import { CATEGORIA_CITA_ICONO } from "./iconos";
import { IconClock, IconPin, IconStar } from "@/components/icons";
import {
  CATEGORIAS_CITAS,
  CATEGORIA_CITA_LABEL,
  normalizarCategoriaCita,
  type CategoriaCita,
} from "./tipos";
import type { Rancho } from "../mi-negocio/types";
import { codigoPaisDe, esRegionDe, paisDe, type CodigoPais } from "@/lib/paises";
import { COLUMNAS_PAIS, pedirFilas } from "@/lib/ranchos-publicos";
import { urlCategoria, urlDirectorio } from "@/lib/url-directorio";

export const metadata: Metadata = {
  title: "Citas y Reservas",
  description:
    "Reservá tu cita en salones de belleza, barberías, spas y consultorios: elegí el servicio, la hora y con quién — todo en línea.",
};

type Calificacion = { rancho_id: string; promedio: number; total: number };

/**
 * El directorio de Citas: los negocios que atienden con turno. Mismo
 * esqueleto que el de eventos pero con la estética celeste de esta
 * vertical y categorías propias (belleza, barbería, uñas, spa...).
 *
 * Sin filtro activo, cada categoría es una fila horizontal con sus
 * cards (estilo riel); al filtrar o buscar se pasa al grid clásico.
 */

/** Títulos de las filas del directorio: más vendedores que el label
 *  corto de la categoría (que sigue mandando en badges y formularios). */
const TITULO_FILA: Record<string, string> = {
  belleza: "Salones de belleza",
  barberia: "Barberías",
  unas: "Uñas",
  spa: "Spa y masajes",
  consultorio: "Consultorios médicos",
  otros: "Otros servicios",
};

/** Para buscar sin pelear con tildes: "peluquería" encuentra "peluqueria". */
function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Fila = Pick<
  Rancho,
  | "id"
  | "nombre"
  | "slug"
  | "descripcion"
  | "pais"
  | "provincia"
  | "canton"
  | "foto_url"
  | "precio_desde"
> & { categoria: string };

/** Una fila ya normalizada: la categoría es una de las oficiales. */
type Negocio = Omit<Fila, "categoria"> & { categoria: CategoriaCita };

/** Next entrega string | string[] con parámetros repetidos en la URL. */
function unSolo(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * El armazón de /citas: lo que se pinta sin esperar a la base.
 *
 * Igual que /eventos, el contenido va detrás de un `<Suspense>` para que
 * el `<head>` con los preloads salga de una. Medido en producción antes
 * del cambio: 195 ms de brecha entre que llegaba el documento y que
 * arrancaba el primer CSS/JS, y /citas es además la ruta con más
 * peticiones del sitio (51), así que adelantarle los preloads al
 * navegador es lo que más paga acá. Con `next start` el primer byte
 * quedó en 11 ms y el documento completo en 170 ms.
 *
 * `<Suspense>` y no `loading.tsx`: un `loading.tsx` en este segmento
 * también taparía /citas/[slug], y ahí el armazón saldría antes del
 * `notFound()`. Verificado: con el loading.tsx puesto,
 * `/citas/no-existe-este-negocio` respondía 200; sin él, 404.
 */
export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string | string[];
    q?: string | string[];
    pais?: string | string[];
    provincia?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const categoriaParam = unSolo(params.categoria);
  const categoria = (CATEGORIAS_CITAS as readonly string[]).includes(
    categoriaParam ?? "",
  )
    ? (categoriaParam as CategoriaCita)
    : undefined;
  const busqueda = (unSolo(params.q) ?? "").trim();
  /**
   * EL PAÍS. Sin `?pais=` es Costa Rica —el comportamiento de siempre,
   * y el de todas las URLs que ya están compartidas—, y un código que
   * el catálogo no conoce también cae ahí en vez de vaciar la pantalla.
   */
  const pais = codigoPaisDe(unSolo(params.pais));
  /**
   * El "¿Dónde?" del buscador de la portada llega por acá.
   *
   * Se valida contra las regiones DEL PAÍS elegido —antes eran siempre
   * las 7 provincias de Costa Rica— y lo que no coincida se ignora en
   * vez de filtrar por una cadena inventada: `?provincia=Miami`
   * mostraría cero negocios y parecería que el directorio está vacío.
   * Se compara exacto (con tildes y mayúsculas) porque así se guarda en
   * la base: el valor sale de un `<select>` armado con esta misma lista.
   */
  const provinciaParam = unSolo(params.provincia);
  const provincia = esRegionDe(pais, provinciaParam) ? provinciaParam : undefined;

  return (
    <div className="relative min-h-screen bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Citas y Reservas" />

      <section className="relative mx-auto max-w-[1100px] px-4 pb-10 pt-4 sm:px-6">
        {/* Sin hero: el conmutador de verticales y el buscador — el
            espacio es para las cards. El h1 queda para lectores de
            pantalla y SEO. */}
        <h1 className="sr-only">Citas y Reservas — reservá tu cita en línea</h1>
        <div className="mb-4">
          <SelectorVertical activo="citas" />
        </div>

        <Suspense
          key={`${categoria ?? ""}|${busqueda}|${pais}|${provincia ?? ""}`}
          fallback={<EsqueletoCitas />}
        >
          <ContenidoCitas
            categoria={categoria}
            busqueda={busqueda}
            pais={pais}
            provincia={provincia}
          />
        </Suspense>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Calca la vista por defecto: filas horizontales por categoría. */
function EsqueletoCitas() {
  return (
    <>
      <EsqueletoFiltros />
      <div className="mt-6 space-y-8">
        {Array.from({ length: 2 }, (_, fila) => (
          <section key={fila}>
            <Bloque className="h-5 w-[190px]" />
            <div className="mt-3.5 flex gap-4 overflow-hidden pb-2 pt-0.5">
              {Array.from({ length: 4 }, (_, i) => (
                <EsqueletoCard key={i} className="w-[270px] shrink-0 sm:w-[300px]" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/** Las columnas de siempre. `pais` va aparte: ver COLUMNAS_PAIS. */
const COLUMNAS_CITAS_DIRECTORIO =
  "id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, precio_desde";

async function ContenidoCitas({
  categoria,
  busqueda,
  pais,
  provincia,
}: {
  categoria: CategoriaCita | undefined;
  busqueda: string;
  pais: CodigoPais;
  provincia: string | undefined;
}) {
  const supabase = await createClient();

  const [negociosData, { data: califData }] = await Promise.all([
    // `pedirFilas` pide `pais` y, si la base todavía no tiene la
    // columna, vuelve a pedir sin ella. Una lista explícita que nombre
    // una columna inexistente hace fallar la consulta ENTERA, y acá eso
    // sería el directorio de Citas en blanco.
    pedirFilas(
      (columnas) =>
        supabase
          .from("ranchos")
          .select(columnas)
          .eq("vertical", "citas")
          .eq("estado", "aprobado")
          .order("created_at", { ascending: false }),
      COLUMNAS_CITAS_DIRECTORIO,
      COLUMNAS_PAIS,
    ),
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
  ]);

  const negocios: Negocio[] = (negociosData as unknown as Fila[]).map((n) => ({
    ...n,
    categoria: normalizarCategoriaCita(n.categoria),
  }));
  const califPorNegocio = new Map(
    ((califData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );

  // EL PAÍS MANDA SOBRE TODO LO DEMÁS: es el alcance de la pantalla, no
  // un filtro más. Se aplica antes que la zona, la búsqueda y la
  // categoría, así que los conteos y el "N resultados" hablan siempre
  // de negocios de ESE país.
  //
  // `codigoPaisDe` es lo que hace que esto no rompa nada hoy: mientras
  // la 0170 no esté pegada, las filas traen `pais` en MAYÚSCULA ('CR')
  // —o no lo traen, si la columna no existe— y las tres formas se leen
  // como Costa Rica. Con `?pais=cr` (o sin el parámetro) el filtro deja
  // pasar exactamente los mismos negocios que antes de este cambio.
  const enPais = negocios.filter((n) => codigoPaisDe(n.pais) === pais);

  // La zona se aplica sobre lo anterior: así los conteos de los chips,
  // las filas por categoría y el "N resultados" hablan siempre de la
  // misma lista. Se compara contra la columna `provincia` tal cual la
  // guarda el negocio.
  const enZona = provincia ? enPais.filter((n) => n.provincia === provincia) : enPais;

  // El buscador filtra por nombre, zona, rubro o descripción. Se
  // aplica ANTES que la categoría para que los conteos de los chips
  // prometan exactamente lo que el clic entrega.
  const aguja = normalizarBusqueda(busqueda);
  const baseBusqueda = aguja
    ? enZona.filter((n) =>
        normalizarBusqueda(
          [
            n.nombre,
            n.canton ?? "",
            n.provincia ?? "",
            n.descripcion ?? "",
            CATEGORIA_CITA_LABEL[n.categoria],
          ].join(" "),
        ).includes(aguja),
      )
    : enZona;

  const filtrados = categoria
    ? baseBusqueda.filter((n) => n.categoria === categoria)
    : baseBusqueda;

  const conteo: Record<string, number> = {};
  baseBusqueda.forEach((n) => {
    conteo[n.categoria] = (conteo[n.categoria] ?? 0) + 1;
  });

  // Vista de filas (sin filtro ni búsqueda): una línea por categoría,
  // en el orden oficial, saltando las vacías. Sobre `enZona`, no sobre
  // todos: con una provincia elegida, las filas también son de ahí.
  const filas = CATEGORIAS_CITAS.map((c) => ({
    categoria: c,
    items: enZona.filter((n) => n.categoria === c),
  })).filter((f) => f.items.length > 0);

  const vistaFilas = !categoria && !aguja;

  return (
    <>
        {/* Buscador + la fila de categorías, con el mismo chip de
            /eventos: ícono en burbuja naranja y sin conteos. */}
        <BarraFiltrosDirectorio
          ruta="/citas"
          ariaLabel="Buscar negocios por nombre, zona o rubro"
          placeholder='Buscá por nombre, zona o rubro — ej. "uñas" o "Moravia"'
          categoria={categoria}
          busqueda={busqueda}
          pais={pais}
          provincia={provincia}
          resultados={filtrados.length}
          opciones={CATEGORIAS_CITAS.map((c) => ({
            valor: c,
            label: CATEGORIA_CITA_LABEL[c],
            icono: CATEGORIA_CITA_ICONO[c],
          }))}
        />

        {/* Se compara contra `enPais` y no contra todos los negocios:
            en un país recién abierto la lista está vacía porque todavía
            no hay nadie publicado ahí, no porque la búsqueda no
            encontrara nada — y el mensaje correcto es la invitación a
            publicar, no "probá con otra palabra". */}
        {filtrados.length === 0 && enPais.length > 0 ? (
          <div className="bento bento-blanco mt-10 p-10 text-center shadow-sm">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              No encontramos nada con esa búsqueda
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Probá con otra palabra, otra zona, o quitá los filtros.
            </p>
            {/* Suelta los filtros pero NO el país: quien está mirando
                Panamá quiere ver todo Panamá, no volver a Costa Rica. */}
            <Link href={urlDirectorio("/citas", { pais })} className="btn-contorno mt-6">
              Ver todos los negocios
            </Link>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bento bento-blanco mt-10 p-10 text-center shadow-sm">
            {/* Con el país nombrado: en Costa Rica dice lo de siempre,
                y en un país recién abierto explica POR QUÉ está vacío
                en vez de dar a entender que Bookea entera lo está. */}
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Los primeros negocios de {paisDe(pais).nombre} están por llegar
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Estamos abriendo esta sección. ¿Tenés un salón, barbería, spa o
              consultorio? Publicalo gratis y recibí reservas en línea con tu
              propia página.
            </p>
            <Link
              href="/mi-negocio/nuevo"
              className="btn-naranja mt-6"
            >
              Publicar mi negocio
            </Link>
          </div>
        ) : vistaFilas ? (
          /* Una fila por categoría: título + línea horizontal de cards. */
          <div className="mt-6 space-y-8">
            {filas.map((f) => (
              <section key={f.categoria}>
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-[17px] font-extrabold tracking-tight text-aventurea-ink">
                    {TITULO_FILA[f.categoria] ?? CATEGORIA_CITA_LABEL[f.categoria]}
                    <span className="ml-2 text-[13px] font-bold text-aventurea-ink-soft">
                      ({f.items.length})
                    </span>
                  </h2>
                  <Link
                    // La zona Y EL PAÍS se conservan al abrir una
                    // categoría: si se cayeran acá, "Ver todos"
                    // saltaría de "las barberías de Cartago" a "las de
                    // todo el país" —o directo a otro país— sin avisar.
                    href={urlCategoria("/citas", f.categoria, pais, provincia)}
                    className="shrink-0 text-[12.5px] font-extrabold text-aventurea-navy hover:text-aventurea-orange"
                  >
                    Ver todos →
                  </Link>
                </div>
                <div className="mt-3.5 flex snap-x gap-4 overflow-x-auto pb-2 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {f.items.map((n) => (
                    <CardNegocio
                      key={n.id}
                      negocio={n}
                      calif={califPorNegocio.get(n.id)}
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
              <CardNegocio key={n.id} negocio={n} calif={califPorNegocio.get(n.id)} />
            ))}
          </div>
        )}

        {/* Sin secciones informativas: esta página son las cards de los
            negocios y nada más (la invitación a publicar vive en
            /publicar y en el estado vacío). */}
    </>
  );
}

function CardNegocio({
  negocio: n,
  calif,
  className = "",
}: {
  negocio: Negocio;
  calif?: Calificacion;
  className?: string;
}) {
  const href = n.slug ? `/citas/${n.slug}` : `/citas/${n.id}`;
  const ubicacion = [n.canton, n.provincia].filter(Boolean).join(", ");
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
            <IconClock className="h-10 w-10" />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
          {CATEGORIA_CITA_LABEL[n.categoria]}
        </span>
        {n.slug?.startsWith("demo-") && (
          <span className="absolute right-3 top-3 rounded-lg bg-amber-400 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
            Demo
          </span>
        )}
      </div>
      {/* Cuerpo al estilo Fresha: nombre + nota, ubicación y
          precio — nada de párrafos; la card vende sola. */}
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
        <div className="mt-3 flex items-center justify-between border-t border-[#e8eef8] pt-3">
          <span className="text-[12.5px] text-aventurea-ink-soft">
            {n.precio_desde ? (
              <>
                Desde{" "}
                <strong className="font-extrabold text-aventurea-ink">
                  ₡{Number(n.precio_desde).toLocaleString("es-CR")}
                </strong>
              </>
            ) : (
              "Precios en línea"
            )}
          </span>
          <span className="text-[13px] font-extrabold text-aventurea-orange">
            Reservar →
          </span>
        </div>
      </div>
    </Link>
  );
}

