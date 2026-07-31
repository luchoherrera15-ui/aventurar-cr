import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import { IconChatBubble, IconClock, IconPin, IconStar } from "@/components/icons";
import AgendaNegocio from "./agenda-negocio";
import EquipoNegocio from "./equipo-negocio";
import TarjetaReservaSticky from "./tarjeta-reserva-sticky";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISOCR } from "@/lib/fechas";
import {
  CATEGORIA_CITA_LABEL,
  horarioDeDetalles,
  normalizarCategoriaCita,
} from "../tipos";
import { linkGoogleMaps, type Rancho, type RanchoItem } from "@/app/mi-rancho/types";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const [
    { data: itemsData },
    { data: equipoData },
    { data: califData },
    { data: resenasData },
    { data: perfil },
  ] = await Promise.all([
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
      user
        ? supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const items = (itemsData ?? []) as (RanchoItem & { duracion_minutos: number | null })[];
  const equipo = (equipoData ?? []) as Miembro[];
  const calif = califData as { promedio: number; total: number } | null;
  const resenas = (resenasData ?? []) as Resena[];
  const horario = horarioDeDetalles(negocio.detalles);
  const categoria = normalizarCategoriaCita(negocio.categoria);
  const ubicacion = [negocio.canton, negocio.provincia].filter(Boolean).join(", ");
  const rutaBase = `/citas/${negocio.slug ?? negocio.id}`;

  // Los contadores del negocio (citas agendadas, clientes atendidos y
  // citas por persona del equipo) salen con la service key: la
  // política de reservas solo deja ver las propias, y acá se exponen
  // únicamente números agregados — nunca datos de nadie.
  const admin = createAdminClient();
  let citasTotales = 0;
  let clientesAtendidos = 0;
  const citasPorMiembro: Record<string, number> = {};
  if (admin) {
    const { data: filasCitas } = await admin
      .from("reservas")
      .select("cliente_id, correo, fecha, miembro_id")
      .eq("rancho_id", negocio.id)
      .eq("estado", "confirmada")
      .not("hora_inicio", "is", null);
    const hoy = hoyISOCR();
    const filas = (filasCitas ?? []) as {
      cliente_id: string | null;
      correo: string | null;
      fecha: string;
      miembro_id: string | null;
    }[];
    citasTotales = filas.length;
    const atendidas = filas.filter((f) => f.fecha < hoy);
    clientesAtendidos = new Set(
      atendidas.map((f) => f.cliente_id ?? f.correo).filter(Boolean),
    ).size;
    for (const f of atendidas) {
      if (f.miembro_id) {
        citasPorMiembro[f.miembro_id] = (citasPorMiembro[f.miembro_id] ?? 0) + 1;
      }
    }
  }

  const resumen = {
    fotoUrl: negocio.foto_url,
    promedio: calif?.promedio ?? null,
    totalResenas: calif?.total ?? null,
    ubicacion: ubicacion || null,
  };
  // Un solo paquete de props para las tres puertas de la agenda
  // (servicios, tarjeta sticky y perfil del equipo).
  const agendaProps = {
    ranchoId: negocio.id,
    rutaBase,
    nombreNegocio: negocio.nombre,
    items,
    equipo,
    horario,
    sesionActiva: !!user,
    nombreInicial: perfil?.nombre ?? "",
    resumen,
  };
  const comoLlegar = linkGoogleMaps(
    negocio.latitud,
    negocio.longitud,
    [negocio.nombre, negocio.direccion_exacta, negocio.canton, negocio.provincia, "Costa Rica"]
      .filter(Boolean)
      .join(", "),
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(175deg,#ffffff_0%,#f5f8fd_38%,#e9f0fb_100%)]">
      <SiteHeader breadcrumb="Citas y Reservas" />

      <section className="mx-auto max-w-[1000px] px-6 py-8">
        <Link href="/citas" className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy">
          ← Todos los negocios
        </Link>

        {/* ---------- Presentación ---------- */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-aventurea-line bg-white shadow-[0_14px_44px_-24px_rgba(22,41,94,0.35)]">
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="relative aspect-[16/10] bg-aventurea-blue-light md:aspect-auto md:min-h-[300px]">
              {negocio.foto_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto remota de Supabase
                <img src={negocio.foto_url} alt={negocio.nombre} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-aventurea-navy">
                  <IconClock className="h-14 w-14" />
                </span>
              )}
            </div>
            <div className="flex flex-col p-6 sm:p-7">
              <span className="w-fit rounded-lg bg-aventurea-blue-light px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-aventurea-navy">
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
                    <IconPin className="h-3.5 w-3.5 text-aventurea-navy" /> {ubicacion}
                  </span>
                )}
              </div>
              {/* Los números que dan confianza: cuánto se mueve el
                  negocio dentro de Bookea. */}
              {(citasTotales > 0 || clientesAtendidos > 0) && (
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <span className="rounded-xl bg-[#f4f7fd] px-3.5 py-2 text-[12px] font-semibold text-aventurea-ink-soft">
                    <strong className="mr-1 text-[14px] font-extrabold text-aventurea-ink">
                      {citasTotales}
                    </strong>
                    cita{citasTotales === 1 ? "" : "s"} agendada{citasTotales === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-xl bg-[#f4f7fd] px-3.5 py-2 text-[12px] font-semibold text-aventurea-ink-soft">
                    <strong className="mr-1 text-[14px] font-extrabold text-aventurea-ink">
                      {clientesAtendidos}
                    </strong>
                    cliente{clientesAtendidos === 1 ? "" : "s"} atendido{clientesAtendidos === 1 ? "" : "s"}
                  </span>
                </div>
              )}
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
                  className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-5 py-3 text-[14px] font-bold text-aventurea-ink hover:border-aventurea-navy"
                >
                  <IconChatBubble className="h-4 w-4 text-aventurea-navy" /> Consultar
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Contenido + la tarjeta que acompaña el scroll ----------
            El horario y la dirección ya no son secciones sueltas: viven
            en la tarjeta sticky de la derecha, que sigue el scroll con
            "Reservar ahora" siempre a la vista (patrón Fresha). */}
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <AgendaNegocio {...agendaProps} />

            {equipo.length > 0 && (
              <EquipoNegocio
                equipo={equipo}
                citasPorMiembro={citasPorMiembro}
                agenda={agendaProps}
              />
            )}

            {/* ---------- Reseñas ---------- */}
            <div className="mt-9">
              <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-aventurea-ink">Reseñas</h2>
              {resenas.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-aventurea-line bg-white p-5 text-[13px] text-aventurea-ink-soft">
                  Todavía no hay reseñas — sé la primera persona en atenderse acá.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {resenas.map((r, i) => (
                    <div key={i} className="rounded-2xl border border-aventurea-line bg-white p-4">
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
          </div>

          <TarjetaReservaSticky
            categoriaLabel={CATEGORIA_CITA_LABEL[categoria]}
            direccion={negocio.direccion_exacta}
            comoLlegarHref={comoLlegar}
            agenda={agendaProps}
          />
        </div>
      </section>
    </div>
  );
}
