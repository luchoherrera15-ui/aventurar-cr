import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import ReservarCita from "./reservar-cita";
import { horarioDeDetalles } from "../../tipos";

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
    .select("id, nombre, slug, detalles")
    .eq("slug", slug)
    .eq("vertical", "citas")
    .eq("estado", "aprobado")
    .maybeSingle();
  if (!data && /^[0-9a-f-]{36}$/.test(slug)) {
    ({ data } = await supabase
      .from("ranchos")
      .select("id, nombre, slug, detalles")
      .eq("id", slug)
      .eq("vertical", "citas")
      .eq("estado", "aprobado")
      .maybeSingle());
  }
  if (!data) notFound();

  const [{ data: itemsData }, { data: equipoData }, { data: perfil }] = await Promise.all([
    supabase
      .from("rancho_items")
      .select("id, nombre, precio, duracion_minutos, grupo")
      .eq("rancho_id", data.id)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("equipo_rancho")
      .select("id, nombre, rol, foto_url")
      .eq("rancho_id", data.id)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    user
      ? supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rutaBase = `/citas/${data.slug ?? data.id}`;

  return (
    <div className="min-h-screen bg-[linear-gradient(175deg,#ffffff_0%,#f3fbfa_38%,#e9f6f5_100%)]">
      <SiteHeader breadcrumb="Reservar cita" />
      <section className="mx-auto max-w-[680px] px-6 py-8">
        <Link
          href={rutaBase}
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-[#1f7a74]"
        >
          ← {data.nombre}
        </Link>
        <h1 className="mt-2 text-[clamp(22px,3vw,28px)] font-black tracking-[-0.5px] text-aventurea-ink">
          Reservá tu cita
        </h1>

        <ReservarCita
          ranchoId={data.id}
          rutaBase={rutaBase}
          nombreNegocio={data.nombre}
          items={(itemsData ?? []) as never}
          equipo={(equipoData ?? []) as never}
          horario={horarioDeDetalles(data.detalles)}
          sesionActiva={!!user}
          nombreInicial={perfil?.nombre ?? ""}
          servicioInicial={servicio ?? null}
        />
      </section>
    </div>
  );
}
