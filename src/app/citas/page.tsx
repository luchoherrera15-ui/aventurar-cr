import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SelectorVertical from "@/components/selector-vertical";
import { IconClock, IconPin, IconSearch, IconStar } from "@/components/icons";
import {
  CATEGORIAS_CITAS,
  CATEGORIA_CITA_LABEL,
  normalizarCategoriaCita,
} from "./tipos";
import type { Rancho } from "../mi-rancho/types";

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
 */
/** Para buscar sin pelear con tildes: "peluquería" encuentra "peluqueria". */
function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string }>;
}) {
  const { categoria, q } = await searchParams;
  const busqueda = (q ?? "").trim();
  const supabase = await createClient();

  const [{ data: negociosData }, { data: califData }] = await Promise.all([
    supabase
      .from("ranchos")
      .select("id, nombre, slug, categoria, descripcion, provincia, canton, foto_url, precio_desde")
      .eq("vertical", "citas")
      .eq("estado", "aprobado")
      .order("created_at", { ascending: false }),
    supabase.from("calificaciones_rancho").select("rancho_id, promedio, total"),
  ]);

  type Fila = Pick<
    Rancho,
    "id" | "nombre" | "slug" | "descripcion" | "provincia" | "canton" | "foto_url" | "precio_desde"
  > & { categoria: string };

  const negocios = ((negociosData ?? []) as Fila[]).map((n) => ({
    ...n,
    categoria: normalizarCategoriaCita(n.categoria),
  }));
  const califPorNegocio = new Map(
    ((califData ?? []) as Calificacion[]).map((c) => [c.rancho_id, c]),
  );

  const porCategoria = categoria
    ? negocios.filter((n) => n.categoria === categoria)
    : negocios;

  // El buscador filtra por nombre, zona, rubro o descripción.
  const aguja = normalizarBusqueda(busqueda);
  const filtrados = aguja
    ? porCategoria.filter((n) =>
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
    : porCategoria;

  const conteo: Record<string, number> = {};
  negocios.forEach((n) => {
    conteo[n.categoria] = (conteo[n.categoria] ?? 0) + 1;
  });

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

        {/* El buscador de agendas: filtra por nombre, zona o rubro.
            Es un form GET — Enter busca, sin JavaScript de por medio. */}
        <form method="get" action="/citas" className="mx-auto max-w-[640px]">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-aventurea-ink-soft" />
            <input
              type="search"
              name="q"
              defaultValue={busqueda}
              placeholder='Buscá por nombre, zona o rubro — ej. "uñas" o "Moravia"'
              className="h-12 w-full rounded-full border border-aventurea-line bg-white pl-11 pr-4 text-[13.5px] text-aventurea-ink placeholder:text-zinc-400 focus:border-aventurea-navy focus:outline-none"
            />
          </div>
        </form>

        {/* Categorías */}
        <div className="mt-4 flex flex-wrap gap-2">
          <ChipCategoria
            href={busqueda ? `/citas?q=${encodeURIComponent(busqueda)}` : "/citas"}
            activo={!categoria}
            label={`Todos (${negocios.length})`}
          />
          {CATEGORIAS_CITAS.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
            <ChipCategoria
              key={c}
              href={`/citas?categoria=${c}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ""}`}
              activo={categoria === c}
              label={`${CATEGORIA_CITA_LABEL[c]} (${conteo[c]})`}
            />
          ))}
        </div>

        {filtrados.length === 0 && negocios.length > 0 ? (
          <div className="bento bento-blanco mt-10 p-10 text-center shadow-sm">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              No encontramos nada con esa búsqueda
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Probá con otra palabra, otra zona, o quitá los filtros.
            </p>
            <Link href="/citas" className="btn-contorno mt-6">
              Ver todos los negocios
            </Link>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bento bento-blanco mt-10 p-10 text-center shadow-sm">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Los primeros negocios están por llegar
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Estamos abriendo esta sección. ¿Tenés un salón, barbería, spa o
              consultorio? Publicalo gratis y recibí reservas en línea con tu
              propia página.
            </p>
            <Link
              href="/mi-rancho/nuevo"
              className="btn-naranja mt-6"
            >
              Publicar mi negocio
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((n) => {
              const calif = califPorNegocio.get(n.id);
              const href = n.slug ? `/citas/${n.slug}` : `/citas/${n.id}`;
              const ubicacion = [n.canton, n.provincia].filter(Boolean).join(", ");
              return (
                <Link
                  key={n.id}
                  href={href}
                  className="group overflow-hidden rounded-[24px] border border-aventurea-line bg-white shadow-[0_10px_36px_-20px_rgba(22,41,94,0.3)] transition-all hover:-translate-y-1 hover:border-aventurea-navy/50 hover:shadow-[0_20px_44px_-20px_rgba(22,41,94,0.4)]"
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
                        <IconClock className="h-10 w-10" />
                      </span>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy backdrop-blur">
                      {CATEGORIA_CITA_LABEL[n.categoria]}
                    </span>
                    {n.slug?.startsWith("demo-") && (
                      <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-900 shadow-sm">
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
            })}
          </div>
        )}

        {/* Sin secciones informativas: esta página son las cards de los
            negocios y nada más (la invitación a publicar vive en
            /publicar y en el estado vacío). */}
      </section>
    </div>
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
