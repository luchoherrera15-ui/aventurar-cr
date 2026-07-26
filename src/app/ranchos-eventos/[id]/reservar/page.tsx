import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingCalendar from "@/app/eventos-salon/booking-calendar";
import { NOMBRE_RANCHO_AVENTUREA } from "../../constants";
import type { DiaDisponibilidad, PrecioTier, ServicioAdicional } from "@/app/eventos-salon/types";
import type { PromocionDia, Rancho } from "@/app/mi-rancho/types";

export default async function ReservarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .eq("estado", "aprobado")
    .maybeSingle();

  if (!data) notFound();
  const rancho = data as Rancho;

  // El de Aventurea CR tiene su propia página dedicada.
  if (rancho.nombre === NOMBRE_RANCHO_AVENTUREA) {
    redirect("/eventos-salon");
  }

  if (rancho.categoria !== "salon") {
    redirect(`/ranchos-eventos/${id}`);
  }

  await supabase
    .from("reservas")
    .delete()
    .eq("rancho_id", rancho.id)
    .eq("estado", "temporal")
    .lt("expira_en", new Date().toISOString());

  const [dispRes, tiersRes, svcRes, promoRes] = await Promise.all([
    supabase
      .from("disponibilidad_rancho")
      .select("fecha, estado")
      .eq("rancho_id", rancho.id),
    supabase
      .from("precio_tiers")
      .select("min_invitados, max_invitados, precio")
      .eq("rancho_id", rancho.id)
      .order("min_invitados", { ascending: true }),
    supabase
      .from("servicios_adicionales")
      .select("id, nombre, precio, requisito_max_invitados")
      .eq("rancho_id", rancho.id)
      .eq("activo", true),
    supabase
      .from("promociones_dia")
      .select("*")
      .eq("rancho_id", rancho.id)
      .eq("activo", true),
  ]);

  const disponibilidad: Record<string, DiaDisponibilidad> = {};
  (dispRes.data ?? []).forEach((r) => {
    const dia = disponibilidad[r.fecha] ?? {
      confirmada: false,
      pendientes: 0,
      temporales: 0,
    };
    if (r.estado === "confirmada") dia.confirmada = true;
    else if (r.estado === "temporal") dia.temporales += 1;
    else dia.pendientes += 1;
    disponibilidad[r.fecha] = dia;
  });

  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-white">
              A
            </span>
            <span className="text-base font-bold text-aventurea-ink">AVENTUREA CR</span>
          </Link>
          <Link
            href={`/ranchos-eventos/${id}`}
            className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange"
          >
            ← Volver al espacio
          </Link>
        </div>
      </header>

      <BookingCalendar
        ranchoId={rancho.id}
        nombreRancho={rancho.nombre}
        disponibilidad={disponibilidad}
        tiers={(tiersRes.data ?? []) as PrecioTier[]}
        servicios={(svcRes.data ?? []) as ServicioAdicional[]}
        tarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 0}
        depositoReserva={rancho.deposito_reserva ?? 25000}
        promociones={(promoRes.data ?? []) as PromocionDia[]}
      />
    </div>
  );
}
