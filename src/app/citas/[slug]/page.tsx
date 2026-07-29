import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import { IconChatBubble, IconClock, IconPin, IconStar } from "@/components/icons";
import { fmtColones } from "@/lib/finanzas";
import {
  CATEGORIA_CITA_LABEL,
  DIAS_SEMANA_LABEL,
  etiquetaMinutos,
  horaBonita,
  horarioDeDetalles,
  normalizarCategoriaCita,
} from "../tipos";
import type { Rancho, RanchoItem } from "@/app/mi-rancho/types";

type Miembro = {
  id: string;
  nombre: string;
  rol: string | null;
  foto_url: string | null;
};

type Resena = { calificacion: number; comentario: string | null; created_at: string };

/**
 * La mini-página de un negocio de citas — su "sitio" dentro de Bookea
 * (bookea.lat/citas/unaskathy): servicios con precio y duración,
 * equipo con fotos, reseñas, horario y ubicación. Todo desemboca en
 * el flujo de reserva, sin salir de acá.
 */
export default async function NegocioCitasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Por slug (la URL bonita) y si no, por id — para negocios recién
  // creados que aún no tienen slug.
  let { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("slug", slug)
    .eq("vertical", "citas")
    .eq("estado", "aprobado")
    .maybeSingle();
  if (!data && /^[0-9a-f-]{36}$/.test(slug)) {
    ({ data } = await supabase
      .from("ranchos")
      .select("*")
      .eq("id", slug)
      .eq("vertical", "citas")
      .eq("estado", "aprobado")
      .maybeSingle());
  }

  const negocio = data as unknown as (Rancho & { vertical: string }) | null;
  if (!negocio) notFound();

  const [{ data: itemsData }, { data: equipoData }, { data: califData }, { data: resenasData }] =
    await Promise.all([
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", negocio.id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, rol, foto_url")
        .eq("rancho_id", negocio.id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("calificaciones_rancho")
        .select("promedio, total")
        .eq("rancho_id", negocio.id)
        .maybeSingle(),
      supabase
        .from("resenas")
        .select("calificacion, comentario, created_at")
        .eq("rancho_id", negocio.id)
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

  const items = (itemsData ?? []) as (RanchoItem & { duracion_minutos: number | null })[];
  const equipo = (equipoData ?? []) as Miembro[];
  const calif = califData as { promedio: number; total: number } | null;
  const resenas = (resenasData ?? []) as Resena[];
  const horario = horarioDeDetalles(negocio.detalles);
  const categoria = normalizarCategoriaCita(negocio.categoria);
  const ubicacion = [negocio.canton, negocio.provincia].filter(Boolean).join(", ");
  const rutaBase = `/citas/${negocio.slug ?? negocio.id}`;

  // Agrupar servicios por sección del catálogo.
  const grupos = new Map<string, typeof items>();
  items.forEach((i) => {
    const g = i.grupo?.trim() || "Servicios";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(i);
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(175deg,#ffffff_0%,#f3fbfa_38%,#e9f6f5_100%)]">
      <SiteHeader breadcrumb="Citas y Reservas" />

      <section className="mx-auto max-w-[1000px] px-6 py-8">
        <Link href="/citas" className="text-[13px] font-bold text-aventurea-ink-soft hover:text-[#1f7a74]">
          ← Todos los negocios
        </Link>

        {/* ---------- Presentación ---------- */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#dceeec] bg-white shadow-[0_14px_44px_-24px_rgba(21,70,67,0.35)]">
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="relative aspect-[16/10] bg-[#e6f6f5] md:aspect-auto md:min-h-[300px]">
              {negocio.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
                <img src={negocio.foto_url} alt={negocio.nombre} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[#5dc4be]">
                  <IconClock className="h-14 w-14" />
                </span>
              )}
            </div>
            <div className="flex flex-col p-6 sm:p-7">
              <span className="w-fit rounded-full bg-[#e6f6f5] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[#1f7a74]">
                {CATEGORIA_CITA_LABEL[categoria]}
              </span>
              <h1 className="mt-2.5 text-[clamp(24px,3vw,32px)] font-black leading-tight tracking-[-0.6px] text-aventurea-ink">
                {negocio.nombre}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-aventurea-ink-soft">
                {calif && calif.total > 0 && (
                  <span className="flex items-center gap-1 font-bold text-aventurea-ink">
                    <IconStar className="h-4 w-4 text-aventurea-orange" />
                    {calif.promedio.toFixed(1)}
                    <span className="font-semibold text-aventurea-ink-soft">
                      ({calif.total} {calif.total === 1 ? "reseña" : "reseñas"})
                    </span>
                  </span>
                )}
                {ubicacion && (
                  <span className="flex items-center gap-1.5">
                    <IconPin className="h-3.5 w-3.5 text-[#2b8a84]" /> {ubicacion}
                  </span>
                )}
              </div>
              {negocio.descripcion && (
                <p className="mt-3 text-[14px] leading-relaxed text-aventurea-ink-soft">
                  {negocio.descripcion}
                </p>
              )}
              <div className="mt-auto flex flex-wrap gap-2.5 pt-5">
                <a
                  href="#servicios"
                  className="rounded-xl bg-aventurea-orange px-6 py-3 text-[14px] font-bold text-white hover:bg-aventurea-orange-dark"
                >
                  Reservar una cita
                </a>
                <Link
                  href={`/mensajes/consulta/${negocio.id}`}
                  className="flex items-center gap-2 rounded-xl border border-[#dceeec] bg-white px-5 py-3 text-[14px] font-bold text-aventurea-ink hover:border-[#5dc4be]"
                >
                  <IconChatBubble className="h-4 w-4 text-[#1f7a74]" /> Consultar
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Servicios ---------- */}
        <div id="servicios" className="mt-8 scroll-mt-24">
          <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">Servicios</h2>
          {items.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-[#dceeec] bg-white p-6 text-[13.5px] text-aventurea-ink-soft">
              Este negocio todavía no publicó sus servicios — consultale por el chat.
            </p>
          ) : (
            [...grupos.entries()].map(([grupo, lista]) => (
              <div key={grupo} className="mt-4">
                {grupos.size > 1 && (
                  <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[#2b8a84]">
                    {grupo}
                  </h3>
                )}
                <div className="overflow-hidden rounded-2xl border border-[#dceeec] bg-white">
                  {lista.map((s, i) => (
                    <div
                      key={s.id}
                      className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 ${i > 0 ? "border-t border-[#eef6f5]" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-bold text-aventurea-ink">{s.nombre}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-aventurea-ink-soft">
                          <IconClock className="h-3.5 w-3.5 text-[#2b8a84]" />
                          {etiquetaMinutos(s.duracion_minutos ?? 30)}
                          {s.descripcion ? ` · ${s.descripcion}` : ""}
                        </p>
                      </div>
                      <p className="text-[14.5px] font-extrabold text-aventurea-ink">
                        {s.precio !== null ? fmtColones(s.precio) : "Consultar"}
                      </p>
                      <Link
                        href={`${rutaBase}/reservar?servicio=${s.id}`}
                        className="rounded-xl border border-[#1f7a74] px-4 py-2 text-[13px] font-bold text-[#1f7a74] transition-colors hover:bg-[#1f7a74] hover:text-white"
                      >
                        Reservar
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ---------- Equipo ---------- */}
        {equipo.length > 0 && (
          <div className="mt-9">
            <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">El equipo</h2>
            <div className="mt-3 flex flex-wrap gap-5">
              {equipo.map((m) => (
                <div key={m.id} className="flex w-[104px] flex-col items-center text-center">
                  {m.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
                    <img
                      src={m.foto_url}
                      alt={m.nombre}
                      className="h-20 w-20 rounded-full border-2 border-white object-cover shadow-md"
                    />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white bg-[#1f7a74] text-[26px] font-extrabold text-white shadow-md">
                      {m.nombre.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="mt-2 text-[13px] font-bold leading-tight text-aventurea-ink">{m.nombre}</p>
                  {m.rol && <p className="text-[11.5px] text-aventurea-ink-soft">{m.rol}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Reseñas + Horario ---------- */}
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          <div>
            <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">Reseñas</h2>
            {resenas.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-[#dceeec] bg-white p-5 text-[13px] text-aventurea-ink-soft">
                Todavía no hay reseñas — sé la primera persona en atenderse acá.
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {resenas.map((r, i) => (
                  <div key={i} className="rounded-2xl border border-[#dceeec] bg-white p-4">
                    <span className="flex items-center gap-0.5 text-aventurea-orange">
                      {Array.from({ length: r.calificacion }, (_, j) => (
                        <IconStar key={j} className="h-3.5 w-3.5" />
                      ))}
                    </span>
                    {r.comentario && (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink">
                        “{r.comentario}”
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">Horario</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#dceeec] bg-white">
              {horario ? (
                DIAS_SEMANA_LABEL.map((dia, dow) => {
                  const d = horario[String(dow)];
                  return (
                    <div
                      key={dia}
                      className={`flex items-center justify-between px-5 py-2.5 text-[13px] ${dow > 0 ? "border-t border-[#eef6f5]" : ""}`}
                    >
                      <span className="font-bold text-aventurea-ink">{dia}</span>
                      {d ? (
                        <span className="text-aventurea-ink-soft">
                          {horaBonita(d.abre)} – {horaBonita(d.cierra)}
                        </span>
                      ) : (
                        <span className="font-semibold text-aventurea-ink-soft/60">Cerrado</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="p-5 text-[13px] text-aventurea-ink-soft">
                  Horario por consultar — escribile al negocio por el chat.
                </p>
              )}
            </div>
            {negocio.direccion_exacta && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl border border-[#dceeec] bg-white p-4 text-[13px] leading-relaxed text-aventurea-ink-soft">
                <IconPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2b8a84]" />
                {negocio.direccion_exacta}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
