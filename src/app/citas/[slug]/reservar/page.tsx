import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import ReservarCita from "./reservar-cita";
import { horarioDeDetalles } from "../../tipos";
import { cargarAgendaPro } from "../../agenda-pro";

const CAMPOS_SERVICIO = "id, nombre, precio, duracion_minutos, buffer_min, grupo";
/** Política de reserva (0118). Las pega el dueño a mano en el SQL
 *  Editor, así que este código puede llegar a producción antes que el
 *  esquema: si las columnas no existen todavía se reintenta sin ellas
 *  y la página de reservas sigue en pie, solo que sin política. */
const CAMPOS_POLITICA = "anticipacion_min_horas, anticipacion_max_dias";

async function cargarServicios(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ranchoId: string,
) {
  const consulta = (campos: string) =>
    supabase
      .from("rancho_items")
      .select(campos)
      .eq("rancho_id", ranchoId)
      .eq("activo", true)
      .order("orden", { ascending: true });

  const conPolitica = await consulta(`${CAMPOS_SERVICIO}, ${CAMPOS_POLITICA}`);
  if (!conPolitica.error) return conPolitica;
  return consulta(CAMPOS_SERVICIO);
}

/**
 * El flujo de reserva de una cita: servicio → con quién → día → hora
 * libre → confirmar. La página server junta los datos; la interacción
 * vive en el componente cliente.
 */
export default async function ReservarCitaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string }>;
}) {
  const { slug } = await params;
  const { servicio } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  if (!data) notFound();

  const [
    { data: itemsData },
    { data: seccionesData },
    { data: equipoData },
    { data: califData },
    { data: perfil },
  ] = await Promise.all([
      cargarServicios(supabase, data.id),
      // El orden de las secciones (0119). Si la tabla no existe todavía
      // esto devuelve error y las secciones salen como vengan.
      supabase
        .from("categorias_negocio")
        .select("nombre")
        .eq("rancho_id", data.id)
        .order("orden", { ascending: true }),
      supabase
        .from("equipo_rancho")
        .select("id, nombre, rol, foto_url")
        .eq("rancho_id", data.id)
        .eq("activo", true)
        .order("orden", { ascending: true }),
      supabase
        .from("calificaciones_rancho")
        .select("promedio, total")
        .eq("rancho_id", data.id)
        .maybeSingle(),
      user
        ? supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const agendaPro = await cargarAgendaPro(supabase, data.id);

  const rutaBase = `/citas/${data.slug ?? data.id}`;
  const calif = califData as { promedio: number; total: number } | null;
  const ubicacion = [data.canton, data.provincia].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-[linear-gradient(175deg,#ffffff_0%,#f5f8fd_38%,#e9f0fb_100%)]">
      <SiteHeader breadcrumb="Reservar cita" />
      <section className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
        <Link
          href={rutaBase}
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-navy"
        >
          ← {data.nombre}
        </Link>

        {/* La misma agenda del modal, en su tarjeta: esta ruta queda
            para enlaces directos (correos, compartir). */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_20px_60px_-30px_rgba(22,41,94,0.4)]">
          <ReservarCita
            ranchoId={data.id}
            rutaBase={rutaBase}
            nombreNegocio={data.nombre}
            items={(itemsData ?? []) as never}
            ordenSecciones={((seccionesData ?? []) as { nombre: string }[]).map(
              (s) => s.nombre,
            )}
            equipo={(equipoData ?? []) as never}
            horario={horarioDeDetalles(data.detalles)}
            zonaHoraria={data.zona_horaria ?? "America/Costa_Rica"}
            horariosRecurso={agendaPro.horariosRecurso}
            bloqueos={agendaPro.bloqueos}
            serviciosRecurso={agendaPro.serviciosRecurso}
            sesionActiva={!!user}
            nombreInicial={perfil?.nombre ?? ""}
            servicioInicial={servicio ?? null}
            deposito={
              typeof data.deposito_citas === "number" || typeof data.deposito_citas === "string"
                ? Number(data.deposito_citas)
                : null
            }
            sinpe={{
              numero: (data.sinpe_numero as string | null) ?? null,
              titular: (data.sinpe_titular as string | null) ?? null,
            }}
            resumen={{
              fotoUrl: data.foto_url,
              promedio: calif?.promedio ?? null,
              totalResenas: calif?.total ?? null,
              ubicacion: ubicacion || null,
            }}
          />
        </div>
      </section>
    </div>
  );
}
