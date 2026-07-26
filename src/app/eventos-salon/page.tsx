import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingCalendar from "./booking-calendar";
import { NOMBRE_RANCHO_AVENTUREA } from "@/app/ranchos-eventos/constants";
import type { DiaDisponibilidad, PrecioTier, ServicioAdicional } from "./types";
import type { PromocionDia } from "@/app/mi-rancho/types";

export default async function EventosSalonPage() {
  const supabase = await createClient();

  const { data: rancho } = await supabase
    .from("ranchos")
    .select("id, deposito_reserva, tarifa_diciembre_por_persona")
    .eq("nombre", NOMBRE_RANCHO_AVENTUREA)
    .maybeSingle();

  if (!rancho) notFound();

  // Limpieza oportunista: borra holds temporales ya vencidos antes de
  // calcular qué fechas están disponibles.
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
            <span className="text-zinc-500">/</span>
            <span className="text-[13px] font-light text-aventurea-ink-soft">
              Rancho de Eventos
            </span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link href="/" className="text-[13.5px] text-aventurea-ink-soft hover:text-aventurea-orange">
              Inicio
            </Link>
            <a href="#reservar" className="text-[13.5px] text-aventurea-ink-soft hover:text-aventurea-orange">
              Reservar
            </a>
            <a href="#rancho" className="text-[13.5px] text-aventurea-ink-soft hover:text-aventurea-orange">
              El rancho
            </a>
          </nav>
        </div>
      </header>

      <BookingCalendar
        ranchoId={rancho.id}
        nombreRancho="Aventurea CR · Rancho de Eventos"
        disponibilidad={disponibilidad}
        tiers={(tiersRes.data ?? []) as PrecioTier[]}
        servicios={(svcRes.data ?? []) as ServicioAdicional[]}
        tarifaDiciembre={rancho.tarifa_diciembre_por_persona ?? 3750}
        depositoReserva={rancho.deposito_reserva ?? 25000}
        promociones={(promoRes.data ?? []) as PromocionDia[]}
      />

      <section id="rancho" className="py-16">
        <div className="mx-auto max-w-[1080px] px-7">
          <p className="flex items-center gap-2 text-[11.5px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-5 before:bg-aventurea-orange">
            El espacio
          </p>
          <h2 className="mt-2.5 text-[27px] font-bold text-aventurea-ink">
            Lo que incluye el rancho
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-4.5 sm:grid-cols-2 md:grid-cols-3">
            {[
              ["Piscina", "Para el disfrute de los invitados durante el evento."],
              ["Parrilla para asar", "Zona de parrilla disponible para el catering del evento."],
              ["Área techada", "Rancho principal cubierto para la celebración."],
              ["Parqueo privado", "Espacio para los vehículos de los invitados."],
              ["Zona natural", "Jardines y entorno natural para fotografías y ambientación."],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5"
              >
                <h3 className="text-[15px] font-bold text-aventurea-ink">{title}</h3>
                <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">{desc}</p>
              </div>
            ))}
            <div className="relative rounded-2xl border border-aventurea-orange/40 bg-aventurea-surface p-5">
              <span className="absolute right-4 top-4 rounded-full bg-aventurea-orange/15 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide text-aventurea-orange">
                Costo adicional
              </span>
              <h3 className="text-[15px] font-bold text-aventurea-ink">
                Hospedaje (chalets)
              </h3>
              <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">
                Disponible solo en ciertos casos, sujeto a disponibilidad. Se
                elige como servicio adicional al reservar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-aventurea-line py-9 text-center">
        <p className="text-xs text-zinc-400">
          AVENTUREA CR — Costa Rica ·{" "}
          <Link href="/" className="font-bold text-aventurea-orange">
            Volver al inicio
          </Link>
        </p>
      </footer>
    </div>
  );
}
