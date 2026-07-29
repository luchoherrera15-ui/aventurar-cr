import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import { IconClock, IconPin, IconStar } from "@/components/icons";
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
export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
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

  const filtrados = categoria
    ? negocios.filter((n) => n.categoria === categoria)
    : negocios;

  const conteo: Record<string, number> = {};
  negocios.forEach((n) => {
    conteo[n.categoria] = (conteo[n.categoria] ?? 0) + 1;
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(175deg,#ffffff_0%,#f3fbfa_38%,#e9f6f5_100%)]">
      <SiteHeader breadcrumb="Citas y Reservas" />

      <section className="mx-auto max-w-[1100px] px-6 py-10">
        <p className="flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.2em] text-[#2b8a84]">
          <IconClock className="h-3.5 w-3.5" /> Citas y Reservas
        </p>
        <h1 className="mt-2 text-[clamp(26px,3.5vw,38px)] font-black tracking-[-0.8px] text-aventurea-ink">
          Reservá tu cita en línea
        </h1>
        <p className="mt-2 max-w-[56ch] text-[14.5px] leading-relaxed text-aventurea-ink-soft">
          Elegí el negocio, el servicio, la hora y con quién querés atenderte —
          la cita queda confirmada al instante, sin llamadas.
        </p>

        {/* Categorías */}
        <div className="mt-6 flex flex-wrap gap-2">
          <ChipCategoria href="/citas" activo={!categoria} label={`Todos (${negocios.length})`} />
          {CATEGORIAS_CITAS.filter((c) => (conteo[c] ?? 0) > 0).map((c) => (
            <ChipCategoria
              key={c}
              href={`/citas?categoria=${c}`}
              activo={categoria === c}
              label={`${CATEGORIA_CITA_LABEL[c]} (${conteo[c]})`}
            />
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-[#dceeec] bg-white p-10 text-center shadow-sm">
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Los primeros negocios están por llegar
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
              Estamos abriendo esta sección. ¿Tenés un salón, barbería, spa o
              consultorio? Publicalo gratis y recibí reservas en línea con tu
              propia página.
            </p>
            <Link
              href="/publicar"
              className="mt-6 inline-flex rounded-xl bg-aventurea-navy px-6 py-3 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
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
                  className="group overflow-hidden rounded-3xl border border-[#dceeec] bg-white shadow-[0_10px_36px_-20px_rgba(21,70,67,0.3)] transition-all hover:-translate-y-1 hover:border-[#5dc4be] hover:shadow-[0_20px_44px_-20px_rgba(21,70,67,0.4)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#e6f6f5]">
                    {n.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- fotos remotas de Supabase
                      <img
                        src={n.foto_url}
                        alt={n.nombre}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[#5dc4be]">
                        <IconClock className="h-10 w-10" />
                      </span>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[#1f7a74] backdrop-blur">
                      {CATEGORIA_CITA_LABEL[n.categoria]}
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
                        <IconPin className="h-3.5 w-3.5 text-[#2b8a84]" /> {ubicacion}
                      </p>
                    )}
                    {n.descripcion && (
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                        {n.descripcion}
                      </p>
                    )}
                    <p className="mt-3 border-t border-[#e8f3f2] pt-3 text-[13px] font-extrabold text-aventurea-orange">
                      Ver servicios y reservar →
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Invitación al proveedor */}
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#dceeec] bg-white/70 px-6 py-5 backdrop-blur">
          <div>
            <h2 className="text-[15px] font-extrabold text-aventurea-ink">
              ¿Atendés con citas?
            </h2>
            <p className="mt-1 text-[13px] text-aventurea-ink-soft">
              Salones, barberías, spas, consultorios — publicá tu negocio gratis
              y recibí reservas en línea con tu propia página.
            </p>
          </div>
          <Link
            href="/publicar"
            className="rounded-xl bg-aventurea-orange px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-orange-dark"
          >
            Publicar mi negocio
          </Link>
        </div>
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
          ? "border-[#1f7a74] bg-[#1f7a74] text-white"
          : "border-[#dceeec] bg-white text-aventurea-ink-soft hover:border-[#5dc4be] hover:text-[#1f7a74]"
      }`}
    >
      {label}
    </Link>
  );
}
